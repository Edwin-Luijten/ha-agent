from fastapi import FastAPI
from fastapi.testclient import TestClient

from ha_agent.chat.routes import ChatBackend, build_chat_router
from ha_agent.chat.schema import Component


class ScriptedBackend(ChatBackend):
    async def stream(self, req):
        yield {
            "type": "tool_start",
            "tool": "semantic_search_entities",
            "args": {"query": "woonkamer"},
        }
        yield {
            "type": "tool_end",
            "tool": "semantic_search_entities",
            "result_summary": "ok",
        }
        yield {
            "type": "tool_start",
            "tool": "call_service",
            "args": {"domain": "media_player", "service": "play_media"},
        }
        yield {
            "type": "tool_end",
            "tool": "call_service",
            "result_summary": "ok",
        }
        yield {
            "type": "component",
            "component": Component(
                kind="media_player",
                props={"entity_id": "media_player.living_room"},
            ).model_dump(),
        }
        yield {"type": "text_delta", "delta": "Muziek speelt nu in de woonkamer."}
        yield {"type": "final", "full_text": "Muziek speelt nu in de woonkamer."}


def test_chat_e2e_music_example() -> None:
    app = FastAPI()
    app.include_router(build_chat_router(backend=ScriptedBackend()))
    client = TestClient(app)
    with client.stream(
        "POST",
        "/chat",
        json={
            "text": "zet muziek aan op edwin's spotify in de woonkamer",
            "conversation_id": "c",
        },
    ) as r:
        assert r.status_code == 200
        lines = [line for line in r.iter_lines() if line.startswith("data:")]
    assert '"type":"final"' in lines[-1].replace(" ", "")
    assert any('"type":"component"' in line.replace(" ", "") for line in lines)
