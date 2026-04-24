import re

import pytest
from pytest_httpx import HTTPXMock

from ha_agent.ha.client import HAClient


@pytest.fixture
def client() -> HAClient:
    return HAClient(base_url="http://ha", token="t")


async def test_get_states_returns_snapshots(client: HAClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://ha/api/states",
        json=[
            {
                "entity_id": "light.hallway",
                "state": "on",
                "attributes": {"friendly_name": "Hallway"},
                "last_changed": "2026-04-19T12:00:00+00:00",
                "last_updated": "2026-04-19T12:00:00+00:00",
            }
        ],
    )
    states = await client.get_states()
    assert len(states) == 1
    assert states[0].entity_id == "light.hallway"
    assert states[0].state == "on"
    assert states[0].attributes["friendly_name"] == "Hallway"


async def test_call_service_posts_to_service_endpoint(
    client: HAClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        url="http://ha/api/services/light/turn_on",
        method="POST",
        match_json={"entity_id": "light.hallway", "brightness_pct": 60},
        json=[],
    )
    await client.call_service(
        "light", "turn_on", {"entity_id": "light.hallway", "brightness_pct": 60}
    )


async def test_get_history_returns_list_of_snapshots(
    client: HAClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        url=re.compile(r"http://ha/api/history/period/"),
        json=[
            [
                {
                    "entity_id": "light.hallway",
                    "state": "on",
                    "attributes": {},
                    "last_changed": "2026-04-19T11:00:00+00:00",
                    "last_updated": "2026-04-19T11:00:00+00:00",
                }
            ]
        ],
    )
    history = await client.get_history("light.hallway", hours=1)
    assert len(history) == 1
    assert history[0].entity_id == "light.hallway"


async def test_get_history_handles_minimal_response(
    client: HAClient, httpx_mock: HTTPXMock
) -> None:
    """HA's history API omits 'attributes' when minimal_response=true."""
    import re

    httpx_mock.add_response(
        url=re.compile(r"http://ha/api/history/period/"),
        json=[
            [
                {
                    "entity_id": "light.hallway",
                    "state": "on",
                    "last_changed": "2026-04-19T11:00:00+00:00",
                    "last_updated": "2026-04-19T11:00:00+00:00",
                }
            ]
        ],
    )
    history = await client.get_history("light.hallway", hours=1)
    assert len(history) == 1
    assert history[0].attributes == {}
