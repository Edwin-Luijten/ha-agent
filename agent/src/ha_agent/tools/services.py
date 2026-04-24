from __future__ import annotations

from typing import Any

from ..safety.limiter import RateLimitExceeded
from .context import ToolContext


class ServiceTools:
    def __init__(self, ctx: ToolContext, session_id: str, user_id: str) -> None:
        self._ctx = ctx
        self._session_id = session_id
        self._user_id = user_id

    async def list_services(self, domain: str | None = None) -> dict[str, Any]:
        """List HA services, optionally filtered by domain."""
        try:
            services = self._ctx.registry.services
            if domain:
                services = [s for s in services if s.domain == domain]
            return {
                "status": "ok",
                "services": [
                    {"domain": s.domain, "service": s.service, "description": s.description}
                    for s in services
                ],
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def get_service_schema(self, domain: str, service: str) -> dict[str, Any]:
        """Return the field schema for a specific service."""
        try:
            for s in self._ctx.registry.services:
                if s.domain == domain and s.service == service:
                    return {"status": "ok", "fields": s.fields, "description": s.description}
            return {"status": "error", "message": f"service {domain}.{service} not found"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def call_service(self, domain: str, service: str, data: dict[str, Any]) -> dict[str, Any]:
        """Call a Home Assistant service. Audited and rate-limited."""
        try:
            self._ctx.limiter.check(self._session_id)
        except RateLimitExceeded as exc:
            return {"status": "error", "message": f"rate limit exceeded, retry in {exc.retry_in}s"}
        try:
            result = await self._ctx.ha.call_service(domain, service, data)
            await self._ctx.audit.append(
                session_id=self._session_id,
                user_id=self._user_id,
                domain=domain,
                service=service,
                data=data,
                result="ok",
                confirmation_required=False,
                response=result,
            )
            return {"status": "ok", "result": result}
        except Exception as exc:
            await self._ctx.audit.append(
                session_id=self._session_id,
                user_id=self._user_id,
                domain=domain,
                service=service,
                data=data,
                result=f"error: {exc}",
                confirmation_required=False,
            )
            return {"status": "error", "message": str(exc)}


def make_service_tools(
    ctx: ToolContext, session_id: str = "unknown", user_id: str = "unknown"
) -> ServiceTools:
    return ServiceTools(ctx, session_id=session_id, user_id=user_id)
