import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from ha_agent.chat.routes import ChatBackend, build_chat_router
from ha_agent.chat.schema import Component


class FakeBackend(ChatBackend):
    async def stream(self, req):
        yield {
            "type": "tool_start",
            "tool": "semantic_search_entities",
            "args": {"query": "woonkamer"},
        }
        yield {
            "type": "tool_end",
            "tool": "semantic_search_entities",
            "result_summary": "1 match",
        }
        yield {
            "type": "component",
            "component": Component(kind="entity_card", props={"entity_id": "light.x"}).model_dump(),
        }
        yield {"type": "text_delta", "delta": "Oké, "}
        yield {"type": "text_delta", "delta": "het is gedaan."}
        yield {"type": "final", "full_text": "Oké, het is gedaan."}


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(build_chat_router(backend=FakeBackend()))
    return TestClient(app)


def test_chat_streams_sse_events(client: TestClient) -> None:
    with client.stream(
        "POST",
        "/chat",
        json={"text": "zet de lamp aan", "conversation_id": "c1", "user_id": "u"},
    ) as r:
        assert r.status_code == 200
        events = [line for line in r.iter_lines() if line.startswith("data:")]
    assert len(events) == 6
    assert '"type":"final"' in events[-1].replace(" ", "")
