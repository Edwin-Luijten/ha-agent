from __future__ import annotations

from typing import Any, get_args

from ..chat.schema import Component, ComponentKind

REQUIRED_PROPS: dict[str, set[str]] = {
    "entity_card": {"entity_id"},
    "light_control": set(),
    "media_player": {"entity_id"},
    "camera_snapshot": {"entity_id"},
    "confirmation": {"prompt", "action_id"},
    "quick_actions": {"chips"},
    "weather_card": set(),
    "plan": {"steps", "action_id"},
}

VALID_KINDS = set(get_args(ComponentKind))


class UIBuffer:
    def __init__(self) -> None:
        self.components: list[Component] = []

    def reset(self) -> None:
        self.components = []


class UITools:
    def __init__(self, buffer: UIBuffer) -> None:
        self._buffer = buffer

    def render_ui(self, kind: str, props: dict[str, Any]) -> dict[str, Any]:
        """Append a UI component to the current response.

        Valid kinds: entity_card, light_control, media_player,
        camera_snapshot, confirmation, quick_actions, weather_card.
        """
        if kind not in VALID_KINDS:
            return {"status": "error", "message": f"unknown kind {kind!r}"}
        required = REQUIRED_PROPS[kind]
        missing = required - set(props.keys())
        if missing:
            return {"status": "error", "message": f"missing required props: {sorted(missing)}"}
        self._buffer.components.append(Component(kind=kind, props=props))  # type: ignore[arg-type]
        return {"status": "ok"}


def make_ui_tools(buffer: UIBuffer) -> UITools:
    return UITools(buffer)
