"""Eval runner — iterates a corpus YAML and reports pass/fail per case.

    uv run python -m ha_agent.evals.runner
    uv run python -m ha_agent.evals.runner --filter alias --verbose
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import yaml
from google.adk.sessions import InMemorySessionService
from google.genai import types as gt

from ..agent.runtime import build_agent, build_runner
from ..config import Settings
from ..memory.aliases import AliasStore
from ..registry import Registry
from ..safety.audit import AuditLog
from ..safety.limiter import RateLimiter
from ..tools.context import ToolContext
from ..tools.ui import UIBuffer
from .assertions import AssertionResult, Outcome, check
from .fakes import (
    FakeHAClient,
    ZeroEncoder,
    build_fake_services,
    build_fake_states,
    default_fake_entities,
    default_fake_services,
)

CORPUS_PATH = Path(__file__).parent / "corpus.yaml"


@dataclass
class CaseResult:
    id: str
    passed: bool
    results: list[AssertionResult]
    outcome: Outcome
    error: str | None = None


async def run_case(case: dict[str, Any], *, settings: Settings, tmp_dir: Path) -> CaseResult:
    case_id = case["id"]
    entities = case.get("entities") or default_fake_entities()
    services = case.get("services") or default_fake_services()
    aliases_seed = case.get("aliases") or {}

    ha = FakeHAClient(
        states=build_fake_states(entities),
        services=build_fake_services(services),
    )
    registry = Registry(ha_client=cast(Any, ha), encoder=ZeroEncoder())
    await registry.refresh()

    audit = AuditLog(path=tmp_dir / f"{case_id}-audit.jsonl")
    limiter = RateLimiter(max_per_minute=60)
    aliases = AliasStore(path=tmp_dir / f"{case_id}-aliases.json")
    await aliases.load()
    for alias, target in aliases_seed.items():
        await aliases.set(alias, target)

    ctx = ToolContext(
        ha=cast(Any, ha),
        registry=registry,
        audit=audit,
        limiter=limiter,
        aliases=aliases,
    )
    ui = UIBuffer()
    session_service = InMemorySessionService()
    session_id = f"eval-{case_id}"
    user_id = "eval"
    agent = build_agent(
        settings=settings,
        ctx=ctx,
        ui=ui,
        session_id=session_id,
        user_id=user_id,
    )
    runner, _ = build_runner(agent, session_service=session_service)
    await session_service.create_session(app_name="ha_agent", user_id=user_id, session_id=session_id)

    tool_calls: list[dict[str, Any]] = []
    full_text: list[str] = []
    llm_calls = 0
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=gt.Content(parts=[gt.Part(text=case["input"])]),
        ):
            meta = getattr(event, "usage_metadata", None) or getattr(event, "usageMetadata", None)
            if meta is not None:
                llm_calls += 1
            content = getattr(event, "content", None)
            parts = getattr(content, "parts", None) if content else None
            for part in parts or []:
                fn_call = getattr(part, "function_call", None)
                if fn_call is not None:
                    tool_calls.append(
                        {
                            "name": fn_call.name,
                            "args": dict(fn_call.args) if fn_call.args else {},
                        }
                    )
                elif getattr(part, "text", None):
                    full_text.append(part.text)
    except Exception as exc:
        return CaseResult(
            id=case_id,
            passed=False,
            results=[],
            outcome=Outcome(tool_calls, [c.model_dump() for c in ui.components], "", llm_calls),
            error=f"{type(exc).__name__}: {exc}",
        )

    outcome = Outcome(
        tool_calls=tool_calls,
        components=[c.model_dump() for c in ui.components],
        response_text="".join(full_text),
        llm_calls=llm_calls,
    )
    results = [check(a, outcome) for a in case.get("assertions", [])]
    passed = all(r.ok for r in results)
    return CaseResult(id=case_id, passed=passed, results=results, outcome=outcome)


async def run_all(
    *, corpus_path: Path, filter_id: str | None, verbose: bool
) -> list[CaseResult]:
    raw = yaml.safe_load(corpus_path.read_text(encoding="utf-8"))
    cases = raw["cases"]
    if filter_id:
        cases = [c for c in cases if filter_id in c["id"]]

    settings = Settings()  # expects GOOGLE_API_KEY etc. in env
    tmp_dir = Path("/tmp") / "ha-agent-evals"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    results: list[CaseResult] = []
    for case in cases:
        print(f"→ {case['id']} …", end="", flush=True)
        r = await run_case(case, settings=settings, tmp_dir=tmp_dir)
        results.append(r)
        tag = "PASS" if r.passed else "FAIL"
        print(f" {tag}")
        if verbose or not r.passed:
            for ar in r.results:
                mark = "  ✓" if ar.ok else "  ✗"
                print(f"{mark} {ar.name}: {ar.message}")
            if r.error:
                print(f"  ! {r.error}")
            if not r.passed and verbose:
                print("  outcome.tool_calls:")
                for c in r.outcome.tool_calls:
                    print(f"    - {c.get('name')} {json.dumps(c.get('args', {}), ensure_ascii=False)}")
    return results


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    p.add_argument("--filter", dest="filter_id", default=None, help="substring match on case id")
    p.add_argument("--verbose", "-v", action="store_true")
    args = p.parse_args()

    results = asyncio.run(
        run_all(corpus_path=args.corpus, filter_id=args.filter_id, verbose=args.verbose)
    )
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    print(f"\n{passed}/{total} cases passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
