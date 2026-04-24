from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from google.adk.sessions import InMemorySessionService
from google.genai import types as gt
from pydantic import BaseModel

from .agent.runtime import build_agent, build_runner
from .chat.routes import build_chat_router
from .chat.schema import ChatRequest
from .config import Settings
from .ha.client import HAClient
from .ha.ws import HAEventSubscriber
from .index.semantic import load_sentence_transformer
from .logging import configure_logging
from .memory.aliases import AliasStore
from .observability.traces import TraceLog
from .registry import Registry
from .safety.audit import AuditLog
from .safety.limiter import RateLimiter
from .state import AppState
from .tools.context import ToolContext
from .tools.ui import UIBuffer

logger = logging.getLogger(__name__)


def create_app(*, skip_warmup: bool = False) -> FastAPI:
    settings = Settings()
    configure_logging(settings.log_level)
    state = AppState(settings=settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not skip_warmup:
            ha = HAClient(base_url=settings.ha_url, token=settings.supervisor_token)
            encoder = await asyncio.to_thread(load_sentence_transformer, settings.embedding_model)
            registry = Registry(ha_client=ha, encoder=encoder)
            await registry.refresh()
            audit = AuditLog(path=Path(settings.data_dir) / "audit.jsonl")
            traces = TraceLog(base_dir=Path(settings.data_dir) / "traces")
            limiter = RateLimiter(max_per_minute=settings.rate_limit_per_min)
            sessions = InMemorySessionService()
            aliases = AliasStore(path=Path(settings.data_dir) / "aliases.json")
            await aliases.load()
            subscriber = HAEventSubscriber(
                url=settings.ha_ws_url,
                token=settings.supervisor_token,
                on_event=registry.handle_event,
            )
            ws_task = asyncio.create_task(subscriber.run())
            maint_task = asyncio.create_task(
                _maintenance_loop(traces=traces, audit=audit, limiter=limiter)
            )
            state.ha = ha
            state.registry = registry
            state.audit = audit
            state.traces = traces
            state.limiter = limiter
            state.sessions = sessions
            state.subscriber = subscriber
            state.aliases = aliases
            state.warm = True
            try:
                yield
            finally:
                ws_task.cancel()
                maint_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await ws_task
                with contextlib.suppress(asyncio.CancelledError):
                    await maint_task
                await ha.aclose()
        else:
            yield

    app = FastAPI(lifespan=lifespan, title="HA Agent")
    app.state.agent_state = state

    @app.get("/healthz")
    async def healthz() -> dict:
        entities = 0
        last_refresh: str | None = None
        if state.registry is not None:
            entities = len(state.registry.keyword._entries)
            if state.registry.last_refreshed_at is not None:
                last_refresh = state.registry.last_refreshed_at.isoformat()
        ws: dict[str, object] = {"connected": False}
        sub = state.subscriber
        if sub is not None:
            ws = {
                "connected": sub.connected,
                "reconnect_count": sub.reconnect_count,
                "last_event_ts": sub.last_event_ts.isoformat() if sub.last_event_ts else None,
                "last_connected_ts": (
                    sub.last_connected_ts.isoformat() if sub.last_connected_ts else None
                ),
            }
        return {
            "status": "ok" if state.warm else "warming_up",
            "entities": entities,
            "last_refresh": last_refresh,
            "aliases": len(state.aliases.pairs()) if state.aliases else 0,
            "ws": ws,
        }

    @app.get("/audit")
    async def audit_tail(limit: int = 100) -> dict:
        audit = state.audit
        if audit is None:
            return {"entries": []}
        return {"entries": await audit.tail(n=limit)}

    @app.get("/traces")
    async def traces_tail(
        limit: int = 500,
        session_id: str | None = None,
        days: int = 7,
    ) -> dict:
        traces = state.traces
        if traces is None:
            return {"entries": []}
        entries = await traces.read_recent(days=days)
        if session_id:
            entries = [e for e in entries if e.get("session_id") == session_id]
        return {"entries": entries[:limit]}

    @app.get("/sessions")
    async def sessions_list(limit: int = 50, days: int = 14) -> dict:
        traces = state.traces
        if traces is None:
            return {"sessions": []}
        entries = await traces.read_recent(days=days)
        groups: dict[str, list[dict]] = {}
        for e in entries:
            sid = e.get("session_id")
            if not sid:
                continue
            groups.setdefault(sid, []).append(e)
        sessions: list[dict] = []
        for sid, items in groups.items():
            # items is newest-first; earliest is items[-1]
            first = items[-1]
            last = items[0]
            total_tokens = 0
            for ent in items:
                tokens = ent.get("tokens") or {}
                total_tokens += tokens.get("total", 0) or 0
            sessions.append(
                {
                    "session_id": sid,
                    "first_message": first.get("user_message", ""),
                    "first_ts": first.get("ts"),
                    "last_ts": last.get("ts"),
                    "turn_count": len(items),
                    "total_tokens": total_tokens,
                }
            )
        sessions.sort(key=lambda s: s["last_ts"] or "", reverse=True)
        return {"sessions": sessions[:limit]}

    @app.get("/entities")
    async def entities_search(
        prefix: str = "", domain: str | None = None, limit: int = 20
    ) -> dict:
        if state.registry is None:
            return {"entities": []}
        q = prefix.strip().lower()
        domain_prefix = f"{domain}." if domain else None
        starts: list[dict] = []
        contains: list[dict] = []
        for e in state.registry.keyword._entries.values():
            if domain_prefix and not e.entity_id.startswith(domain_prefix):
                continue
            eid = e.entity_id.lower()
            name = (e.friendly_name or "").lower()
            item = {
                "entity_id": e.entity_id,
                "friendly_name": e.friendly_name,
                "area": e.area,
                "state": e.state,
            }
            if not q:
                starts.append(item)
            elif eid.startswith(q) or name.startswith(q):
                starts.append(item)
            elif q in eid or q in name:
                contains.append(item)
            if len(starts) >= limit:
                break
        merged = (starts + contains)[:limit]
        merged.sort(key=lambda x: x["entity_id"])
        return {"entities": merged}

    @app.get("/state/{entity_id}")
    async def entity_state(entity_id: str) -> dict:
        if state.ha is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        try:
            snap = await state.ha.get_state(entity_id)
        except Exception as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return snap.model_dump()

    @app.get("/weather_forecast/{entity_id}")
    async def weather_forecast(entity_id: str, type: str = "daily") -> dict:
        if state.ha is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        base = settings.ha_url.rstrip("/")
        headers = {"Authorization": f"Bearer {settings.supervisor_token}"}
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(
                f"{base}/api/services/weather/get_forecasts?return_response",
                headers=headers,
                json={"entity_id": entity_id, "type": type},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="forecast fetch failed")
        payload = r.json()
        service_response = payload.get("service_response", {}) if isinstance(payload, dict) else {}
        entity_block = service_response.get(entity_id, {})
        forecast = entity_block.get("forecast", [])
        return {"forecast": forecast, "type": type}

    @app.get("/media_image/{entity_id}")
    async def media_image(entity_id: str) -> Response:
        if state.ha is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        try:
            snap = await state.ha.get_state(entity_id)
        except Exception as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        pic = snap.attributes.get("entity_picture")
        if not pic:
            raise HTTPException(status_code=404, detail="no entity_picture")
        base = settings.ha_url.rstrip("/")
        full = pic if str(pic).startswith("http") else f"{base}{pic}"
        headers = {"Authorization": f"Bearer {settings.supervisor_token}"}
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(full, headers=headers, follow_redirects=True)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="upstream fetch failed")
        return Response(
            content=r.content,
            media_type=r.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "private, max-age=30"},
        )

    @app.get("/aliases")
    async def aliases_list() -> dict:
        if state.aliases is None:
            return {"aliases": []}
        items = [
            {"alias": alias, "target": row["target"], "added_at": row.get("added_at")}
            for alias, row in sorted(state.aliases.all().items())
        ]
        return {"aliases": items}

    @app.post("/aliases")
    async def aliases_upsert(body: AliasUpsert) -> dict:
        if state.aliases is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        try:
            await state.aliases.set(body.alias, body.target)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"status": "ok"}

    @app.delete("/aliases/{alias}")
    async def aliases_delete(alias: str) -> dict:
        if state.aliases is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        removed = await state.aliases.delete(alias)
        if not removed:
            raise HTTPException(status_code=404, detail="alias not found")
        return {"status": "ok"}

    backend = AgentBackend(state)
    app.include_router(build_chat_router(backend=backend))

    # UI mount must come last — StaticFiles is a wildcard that would swallow API routes.
    ui_dir = Path(settings.ui_dist_dir)
    if ui_dir.is_dir():
        app.mount("/", StaticFiles(directory=ui_dir, html=True), name="ui")
    else:
        logger.warning("UI dist dir not found at %s; panel disabled", ui_dir)

    return app


class AgentBackend:
    def __init__(self, state: AppState) -> None:
        self._state = state

    async def stream(self, req: ChatRequest):
        import time

        if not (
            self._state.registry
            and self._state.ha
            and self._state.audit
            and self._state.limiter
            and self._state.sessions
        ):
            raise HTTPException(status_code=503, detail="agent not ready")
        ctx = ToolContext(
            ha=self._state.ha,
            registry=self._state.registry,
            audit=self._state.audit,
            limiter=self._state.limiter,
            aliases=self._state.aliases,
        )
        ui = UIBuffer()
        session_id = req.conversation_id or "anon"
        user_id = req.user_id or "anon"
        agent = build_agent(
            settings=self._state.settings,
            ctx=ctx,
            ui=ui,
            session_id=session_id,
            user_id=user_id,
        )
        runner, sessions = build_runner(agent, session_service=self._state.sessions)
        existing = await sessions.get_session(
            app_name="ha_agent", user_id=user_id, session_id=session_id
        )
        if existing is None:
            await sessions.create_session(
                app_name="ha_agent", user_id=user_id, session_id=session_id
            )
        full_text_chunks: list[str] = []
        tool_calls: list[dict] = []
        tokens = _TokenTotals()
        llm_calls = 0
        started = time.monotonic()
        error: str | None = None
        msg = gt.Content(parts=[gt.Part(text=req.text)])
        try:
            async for event in runner.run_async(
                user_id=user_id, session_id=session_id, new_message=msg
            ):
                if tokens.add_from(event):
                    llm_calls += 1
                    yield {
                        "type": "tokens_delta",
                        "prompt": tokens.prompt,
                        "completion": tokens.completion,
                        "thoughts": tokens.thoughts,
                        "cached": tokens.cached,
                        "total": tokens.total,
                        "llm_calls": llm_calls,
                    }
                for ev in _translate_event(event, ui):
                    yield ev
                    if ev["type"] == "text_delta":
                        full_text_chunks.append(ev["delta"])
                    elif ev["type"] == "tool_start":
                        tool_calls.append({"name": ev["tool"], "args": ev.get("args", {})})
        except Exception as exc:
            logger.exception("agent turn failed")
            error = type(exc).__name__
            full_text_chunks.append(_dutch_error_message(exc, req.language))
            yield {"type": "tool_end", "tool": "_internal", "result_summary": f"error: {error}"}
        final_text = "".join(full_text_chunks)
        yield {
            "type": "final",
            "full_text": final_text,
            "components": [c.model_dump() for c in ui.components],
            "error": error,
            "tokens": tokens.as_dict(llm_calls),
        }
        if self._state.traces is not None:
            await self._state.traces.write(
                session_id=session_id,
                user_message=req.text,
                tool_calls=tool_calls,
                response_text=final_text,
                total_latency_ms=int((time.monotonic() - started) * 1000),
                tokens=tokens.as_dict(llm_calls),
            )


class AliasUpsert(BaseModel):
    alias: str
    target: str


async def _maintenance_loop(
    *, traces: TraceLog, audit: AuditLog, limiter: RateLimiter
) -> None:
    """One-stop housekeeping: retention sweeps + stale-session GC.

    Runs every 10 minutes for the cheap GC; heavy retention sweeps run once on
    boot and then on a 24h cadence so we don't churn the disk.
    """
    trace_days = 14
    audit_days = 30
    limiter_age = 600.0  # 10 min idle → drop the session's counter
    heavy_every = 24 * 3600.0
    light_every = 600.0
    last_heavy = 0.0
    try:
        while True:
            now = asyncio.get_event_loop().time()
            if now - last_heavy >= heavy_every:
                try:
                    files = await traces.purge_older_than(days=trace_days)
                    dropped = await audit.purge_older_than(days=audit_days)
                    logger.info(
                        "retention sweep: traces=%d audit=%d", files, dropped
                    )
                except Exception:
                    logger.exception("retention sweep failed")
                last_heavy = now
            try:
                n = limiter.purge_stale(age_seconds=limiter_age)
                if n:
                    logger.debug("limiter gc dropped %d stale sessions", n)
            except Exception:
                logger.exception("limiter gc failed")
            await asyncio.sleep(light_every)
    except asyncio.CancelledError:
        raise


def _dutch_error_message(exc: Exception, language: str) -> str:
    """Short user-visible message for fatal turn failures. Language-aware."""
    name = type(exc).__name__
    is_nl = (language or "nl").lower().startswith("nl")
    if "ResourceExhausted" in name or "429" in str(exc):
        return (
            "De assistent zit tijdelijk op de quota-limiet. Probeer het over een minuut opnieuw."
            if is_nl
            else "The assistant hit a rate limit. Try again in a minute."
        )
    return (
        "Er ging iets mis bij het uitvoeren van je vraag. "
        "Probeer het opnieuw of stel het iets anders."
        if is_nl
        else "Something went wrong while handling your request. Please try again."
    )


class _TokenTotals:
    """Sum Gemini token counts across a turn's LLM calls."""

    __slots__ = ("cached", "completion", "prompt", "thoughts", "total")

    def __init__(self) -> None:
        self.prompt = 0
        self.completion = 0
        self.thoughts = 0
        self.cached = 0
        self.total = 0

    def add_from(self, event) -> bool:
        """Returns True iff the event carried usage metadata we consumed."""
        meta = getattr(event, "usage_metadata", None) or getattr(event, "usageMetadata", None)
        if meta is None:
            return False
        p = _first_int(meta, "prompt_token_count", "promptTokenCount")
        c = _first_int(meta, "candidates_token_count", "candidatesTokenCount")
        th = _first_int(meta, "thoughts_token_count", "thoughtsTokenCount")
        ca = _first_int(meta, "cached_content_token_count", "cachedContentTokenCount")
        t = _first_int(meta, "total_token_count", "totalTokenCount")
        if not any((p, c, th, ca, t)):
            return False
        self.prompt += p
        self.completion += c
        self.thoughts += th
        self.cached += ca
        self.total += t or (p + c + th)
        return True

    def as_dict(self, llm_calls: int) -> dict:
        return {
            "prompt": self.prompt,
            "completion": self.completion,
            "thoughts": self.thoughts,
            "cached": self.cached,
            "total": self.total,
            "llm_calls": llm_calls,
        }


def _first_int(obj, *names: str) -> int:
    for n in names:
        v = getattr(obj, n, None)
        if isinstance(v, int):
            return v
    return 0


def _translate_event(event, ui: UIBuffer) -> list[dict]:
    """Map ADK Runner events into our SSE types."""
    out: list[dict] = []
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return out
    for part in parts:
        fn_call = getattr(part, "function_call", None)
        fn_resp = getattr(part, "function_response", None)
        if fn_call is not None:
            out.append(
                {
                    "type": "tool_start",
                    "tool": fn_call.name,
                    "args": dict(fn_call.args) if fn_call.args else {},
                }
            )
        elif fn_resp is not None:
            resp = fn_resp.response
            s = resp.get("status", "ok") if isinstance(resp, dict) else "ok"
            out.append({"type": "tool_end", "tool": fn_resp.name, "result_summary": s})
        elif getattr(part, "text", None):
            out.append({"type": "text_delta", "delta": part.text})
    return out
