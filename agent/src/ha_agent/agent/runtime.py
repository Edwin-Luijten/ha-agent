from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from ..config import Settings
from ..tools.aliases import make_alias_tools
from ..tools.context import ToolContext
from ..tools.entities import make_entity_tools
from ..tools.services import make_service_tools
from ..tools.ui import UIBuffer, make_ui_tools
from .instruction import build_system_instruction


def build_agent(
    *,
    settings: Settings,
    ctx: ToolContext,
    ui: UIBuffer,
    session_id: str,
    user_id: str,
) -> LlmAgent:
    entity_tools = make_entity_tools(ctx)
    service_tools = make_service_tools(ctx, session_id=session_id, user_id=user_id)
    ui_tools = make_ui_tools(ui)

    tools = [
        entity_tools.search_entities,
        entity_tools.semantic_search_entities,
        entity_tools.get_state,
        entity_tools.get_history,
        service_tools.list_services,
        service_tools.get_service_schema,
        service_tools.call_service,
        ui_tools.render_ui,
    ]
    aliases_pairs = ctx.aliases.pairs() if ctx.aliases is not None else []
    if ctx.aliases is not None:
        alias_tools = make_alias_tools(ctx.aliases)
        tools.extend(
            [alias_tools.remember_alias, alias_tools.forget_alias, alias_tools.list_aliases]
        )
    return LlmAgent(
        name="ha_agent",
        model=settings.model,
        description="Home Assistant action-taking agent",
        instruction=build_system_instruction(settings, aliases=aliases_pairs),
        tools=tools,
    )


def build_runner(
    agent: LlmAgent,
    *,
    session_service: InMemorySessionService | None = None,
    app_name: str = "ha_agent",
) -> tuple[Runner, InMemorySessionService]:
    if session_service is None:
        session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name=app_name, session_service=session_service)
    return runner, session_service
