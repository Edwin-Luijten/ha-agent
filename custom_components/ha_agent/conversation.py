from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from homeassistant.components import conversation
from homeassistant.components.conversation import (
    AbstractConversationAgent,
    ConversationInput,
    ConversationResult,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.intent import IntentResponse

from .const import CONF_HOST, CONF_PORT, DOMAIN  # noqa: F401  (DOMAIN used elsewhere)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    agent = HaAgentConversationAgent(hass, entry.entry_id, host, port)
    conversation.async_set_agent(hass, entry, agent)


class HaAgentConversationAgent(AbstractConversationAgent):
    def __init__(self, hass: HomeAssistant, entry_id: str, host: str, port: int) -> None:
        self._hass = hass
        self._entry_id = entry_id
        self._base_url = f"http://{host}:{port}"
        self._client = httpx.AsyncClient(timeout=30.0)

    @property
    def supported_languages(self) -> list[str]:
        return ["nl", "en"]

    async def async_process(self, user_input: ConversationInput) -> ConversationResult:
        payload: dict[str, Any] = {
            "text": user_input.text,
            "conversation_id": user_input.conversation_id,
            "language": user_input.language or "nl",
            "user_id": (user_input.context.user_id if user_input.context else None),
        }
        try:
            r = await self._client.post(f"{self._base_url}/chat", json=payload)
            r.raise_for_status()
            final_text = _coalesce_final_text(r.text)
        except Exception:
            _LOGGER.exception("HA Agent add-on unreachable")
            final_text = (
                "De agent is niet beschikbaar. Controleer de HA Agent add-on."
                if (user_input.language or "nl").startswith("nl")
                else "The agent is unavailable. Check the HA Agent add-on."
            )

        response = IntentResponse(language=user_input.language or "nl")
        response.async_set_speech(final_text)
        return ConversationResult(
            response=response,
            conversation_id=user_input.conversation_id,
        )


def _coalesce_final_text(sse_body: str) -> str:
    """Walk an SSE body, return the `final.full_text` field (or concatenated text_delta fallback)."""
    text = ""
    for line in sse_body.splitlines():
        if not line.startswith("data:"):
            continue
        try:
            evt = json.loads(line[5:].strip())
        except json.JSONDecodeError:
            continue
        if evt.get("type") == "final":
            return evt.get("full_text", "")
        if evt.get("type") == "text_delta":
            text += evt.get("delta", "")
    return text
