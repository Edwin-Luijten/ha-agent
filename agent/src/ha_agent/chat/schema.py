from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

ComponentKind = Literal[
    "entity_card",
    "light_control",
    "media_player",
    "camera_snapshot",
    "confirmation",
    "quick_actions",
    "weather_card",
    "plan",
]


class Component(BaseModel):
    kind: ComponentKind
    props: dict[str, Any]


class ChatRequest(BaseModel):
    text: str
    conversation_id: str | None = None
    language: str = "nl"
    user_id: str | None = None


class ChatResponse(BaseModel):
    text: str
    components: list[Component] = []
    suggestions: list[str] = []
