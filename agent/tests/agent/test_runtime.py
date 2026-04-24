from unittest.mock import AsyncMock

import pytest

from ha_agent.agent.runtime import build_agent
from ha_agent.config import Settings
from ha_agent.tools.context import ToolContext
from ha_agent.tools.ui import UIBuffer


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "t")
    return Settings()


def test_build_agent_registers_all_tools(settings: Settings) -> None:
    ctx = ToolContext(
        ha=AsyncMock(),
        registry=None,  # type: ignore[arg-type]
        audit=None,  # type: ignore[arg-type]
        limiter=None,  # type: ignore[arg-type]
    )
    buf = UIBuffer()
    agent = build_agent(settings=settings, ctx=ctx, ui=buf, session_id="s", user_id="u")
    tool_names = {t.__name__ for t in agent.tools}
    assert tool_names == {
        "search_entities",
        "semantic_search_entities",
        "get_state",
        "get_history",
        "list_services",
        "get_service_schema",
        "call_service",
        "render_ui",
    }
    assert agent.model == settings.model
