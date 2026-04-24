from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from ha_agent.ha.types import ServiceRef
from ha_agent.registry import Registry
from ha_agent.safety.audit import AuditLog
from ha_agent.safety.limiter import RateLimiter
from ha_agent.tools.context import ToolContext
from ha_agent.tools.services import make_service_tools


class Enc:
    def encode(self, texts, normalize_embeddings=True):
        import numpy as np

        return np.ones((len(texts), 2), dtype="float32") / 2


@pytest.fixture
def ctx(tmp_path: Path) -> ToolContext:
    ha = AsyncMock()
    ha.call_service.return_value = [{"entity_id": "light.hallway", "state": "on"}]
    registry = Registry(ha_client=ha, encoder=Enc())
    registry.services = [
        ServiceRef(
            domain="light", service="turn_on", description="Turn on", fields={"brightness_pct": {}}
        ),
        ServiceRef(domain="light", service="turn_off", description="Turn off", fields={}),
    ]
    return ToolContext(
        ha=ha,
        registry=registry,
        audit=AuditLog(path=tmp_path / "audit.jsonl"),
        limiter=RateLimiter(max_per_minute=3),
    )


async def test_list_services_filters_by_domain(ctx: ToolContext) -> None:
    tools = make_service_tools(ctx)
    result = await tools.list_services(domain="light")
    assert result["status"] == "ok"
    assert {s["service"] for s in result["services"]} == {"turn_on", "turn_off"}


async def test_get_service_schema_returns_fields(ctx: ToolContext) -> None:
    tools = make_service_tools(ctx)
    result = await tools.get_service_schema("light", "turn_on")
    assert result["status"] == "ok"
    assert "brightness_pct" in result["fields"]


async def test_get_service_schema_unknown_service_returns_error(ctx: ToolContext) -> None:
    tools = make_service_tools(ctx)
    result = await tools.get_service_schema("light", "does_not_exist")
    assert result["status"] == "error"


async def test_call_service_invokes_ha_and_audits(ctx: ToolContext) -> None:
    tools = make_service_tools(ctx, session_id="s1", user_id="u1")
    result = await tools.call_service("light", "turn_on", {"entity_id": "light.hallway"})
    assert result["status"] == "ok"
    ctx.ha.call_service.assert_awaited_once_with("light", "turn_on", {"entity_id": "light.hallway"})
    tail = await ctx.audit.tail(1)
    assert tail[0]["domain"] == "light"
    assert tail[0]["service"] == "turn_on"


async def test_call_service_enforces_rate_limit(ctx: ToolContext) -> None:
    tools = make_service_tools(ctx, session_id="s1", user_id="u1")
    for _ in range(3):
        await tools.call_service("light", "turn_on", {"entity_id": "light.x"})
    blocked = await tools.call_service("light", "turn_on", {"entity_id": "light.x"})
    assert blocked["status"] == "error"
    assert "rate" in blocked["message"].lower()
