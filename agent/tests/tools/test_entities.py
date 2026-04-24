from unittest.mock import AsyncMock

import pytest

from ha_agent.ha.types import EntityRef
from ha_agent.tools.context import ToolContext
from ha_agent.tools.entities import make_entity_tools


class IdentityEncoder:
    def encode(self, texts, normalize_embeddings=True):
        import numpy as np

        v = np.zeros((len(texts), 3), dtype="float32")
        for i, t in enumerate(texts):
            v[i, 0] = t.lower().count("hallway")
            v[i, 1] = t.lower().count("living")
            v[i, 2] = t.lower().count("spotify")
        norm = (v**2).sum(axis=1, keepdims=True) ** 0.5 + 1e-9
        return v / norm


@pytest.fixture
def ctx() -> ToolContext:
    from ha_agent.safety.audit import AuditLog
    from ha_agent.safety.limiter import RateLimiter

    ha = AsyncMock()
    ha.get_state.return_value.model_dump.return_value = {
        "entity_id": "light.hallway",
        "state": "on",
        "attributes": {"friendly_name": "Hallway"},
        "last_changed": "2026-04-19T12:00:00+00:00",
        "last_updated": "2026-04-19T12:00:00+00:00",
    }

    from ha_agent.registry import Registry

    registry = Registry(ha_client=ha, encoder=IdentityEncoder())
    registry.keyword.rebuild(
        [
            EntityRef(entity_id="light.hallway", friendly_name="Hallway"),
            EntityRef(entity_id="media_player.living_room", friendly_name="Living Room"),
            EntityRef(entity_id="media_player.spotify_edwin", friendly_name="Edwin Spotify"),
        ]
    )
    registry.semantic.rebuild(
        [
            EntityRef(entity_id="light.hallway", friendly_name="Hallway"),
            EntityRef(entity_id="media_player.living_room", friendly_name="Living Room"),
            EntityRef(entity_id="media_player.spotify_edwin", friendly_name="Edwin Spotify"),
        ]
    )
    return ToolContext(
        ha=ha, registry=registry, audit=AuditLog(path="/tmp/a.jsonl"), limiter=RateLimiter(100)
    )


async def test_search_entities_returns_matches(ctx: ToolContext) -> None:
    tools = make_entity_tools(ctx)
    result = await tools.search_entities("hallway")
    assert result["status"] == "ok"
    assert result["entities"][0]["entity_id"] == "light.hallway"


async def test_search_entities_filters_by_domain(ctx: ToolContext) -> None:
    tools = make_entity_tools(ctx)
    result = await tools.search_entities("hallway", domain="switch")
    assert result["entities"] == []


async def test_semantic_search_ranks(ctx: ToolContext) -> None:
    tools = make_entity_tools(ctx)
    result = await tools.semantic_search_entities("edwin spotify", top_k=1)
    assert result["entities"][0]["entity_id"] == "media_player.spotify_edwin"


async def test_get_state_returns_dict(ctx: ToolContext) -> None:
    from ha_agent.ha.types import StateSnapshot

    ctx.ha.get_state.return_value = StateSnapshot(
        entity_id="light.hallway",
        state="on",
        attributes={"friendly_name": "Hallway"},
        last_changed="2026-04-19T12:00:00+00:00",
        last_updated="2026-04-19T12:00:00+00:00",
    )
    tools = make_entity_tools(ctx)
    result = await tools.get_state("light.hallway")
    assert result["status"] == "ok"
    assert result["state"]["entity_id"] == "light.hallway"


async def test_get_state_handles_error(ctx: ToolContext) -> None:
    ctx.ha.get_state.side_effect = RuntimeError("boom")
    tools = make_entity_tools(ctx)
    result = await tools.get_state("light.nonexistent")
    assert result["status"] == "error"
    assert "boom" in result["message"]
