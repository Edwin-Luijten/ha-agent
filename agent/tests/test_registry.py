from unittest.mock import AsyncMock

import pytest

from ha_agent.ha.types import StateSnapshot
from ha_agent.registry import Registry


class FakeEncoder:
    def encode(self, texts, normalize_embeddings=True):
        import numpy as np

        return np.ones((len(texts), 4), dtype="float32") / 2


@pytest.fixture
def ha_client() -> AsyncMock:
    client = AsyncMock()
    client.get_states.return_value = [
        StateSnapshot(
            entity_id="light.hallway",
            state="on",
            attributes={"friendly_name": "Hallway"},
            last_changed="2026-04-19T12:00:00+00:00",
            last_updated="2026-04-19T12:00:00+00:00",
        )
    ]
    client.get_services.return_value = []
    return client


async def test_refresh_populates_indices(ha_client: AsyncMock) -> None:
    registry = Registry(ha_client=ha_client, encoder=FakeEncoder())
    await registry.refresh()
    assert registry.keyword.search("hallway")[0].entity_id == "light.hallway"


async def test_handle_event_state_changed_updates_entity(ha_client: AsyncMock) -> None:
    registry = Registry(ha_client=ha_client, encoder=FakeEncoder())
    await registry.refresh()
    await registry.handle_event(
        {
            "event_type": "state_changed",
            "data": {
                "entity_id": "light.hallway",
                "new_state": {
                    "state": "off",
                    "attributes": {"friendly_name": "Hallway"},
                },
            },
        }
    )
    assert registry.keyword._entries["light.hallway"].state == "off"


async def test_handle_event_entity_registry_updated_triggers_refresh(
    ha_client: AsyncMock,
) -> None:
    registry = Registry(ha_client=ha_client, encoder=FakeEncoder())
    await registry.refresh()
    ha_client.get_states.reset_mock()
    await registry.handle_event({"event_type": "entity_registry_updated", "data": {}})
    ha_client.get_states.assert_awaited_once()
