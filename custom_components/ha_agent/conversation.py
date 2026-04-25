from __future__ import annotations

import json
import logging
import os
from collections.abc import AsyncGenerator
from typing import Any, Literal

import httpx
from homeassistant.components import conversation
from homeassistant.components.conversation import (
    ChatLog,
    ConversationEntity,
    ConversationInput,
    ConversationResult,
    async_get_result_from_chat_log,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_HOST, CONF_PORT, DOMAIN  # noqa: F401

_LOGGER = logging.getLogger(__name__)

ADDON_SLUG = "ha_agent"


async def _resolve_supervisor_hostname(client: httpx.AsyncClient) -> str | None:
    """Ask Supervisor for the add-on's actual DNS hostname."""
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return None
    try:
        r = await client.get(
            "http://supervisor/addons",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        r.raise_for_status()
        for addon in r.json()["data"]["addons"]:
            slug = addon.get("slug", "")
            if slug == ADDON_SLUG or slug.endswith(f"_{ADDON_SLUG}"):
                return slug.replace("_", "-")
    except Exception as err:
        _LOGGER.debug("Supervisor hostname lookup failed: %s", err)
    return None


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    client = httpx.AsyncClient(timeout=60.0)
    resolved = await _resolve_supervisor_hostname(client)
    if resolved:
        _LOGGER.info("Using Supervisor-resolved hostname for HA Agent: %s", resolved)
        host = resolved
    async_add_entities([HaAgentConversationEntity(entry, host, port, client)])


class HaAgentConversationEntity(ConversationEntity):
    """ConversationEntity that streams text deltas, enabling streaming TTS."""

    _attr_supports_streaming = True
    _attr_has_entity_name = True
    _attr_name = "HA Agent"

    def __init__(
        self,
        entry: ConfigEntry,
        host: str,
        port: int,
        client: httpx.AsyncClient,
    ) -> None:
        self._entry = entry
        self._base_url = f"http://{host}:{port}"
        self._client = client
        self._attr_unique_id = entry.entry_id

    @property
    def supported_languages(self) -> list[str] | Literal["*"]:
        return ["nl", "en"]

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        conversation.async_set_agent(self.hass, self._entry, self)

    async def async_will_remove_from_hass(self) -> None:
        conversation.async_unset_agent(self.hass, self._entry)
        await super().async_will_remove_from_hass()

    async def _async_handle_message(
        self,
        user_input: ConversationInput,
        chat_log: ChatLog,
    ) -> ConversationResult:
        payload: dict[str, Any] = {
            "text": user_input.text,
            "conversation_id": chat_log.conversation_id,
            "language": user_input.language or "nl",
            "user_id": (user_input.context.user_id if user_input.context else None),
        }
        async for _ in chat_log.async_add_delta_content_stream(
            self.entity_id,
            self._stream_deltas(payload, user_input.language or "nl"),
        ):
            pass
        return async_get_result_from_chat_log(user_input, chat_log)

    async def _stream_deltas(
        self, payload: dict[str, Any], language: str
    ) -> AsyncGenerator[dict[str, Any]]:
        """Translate the add-on's SSE stream into chat-log deltas."""
        first = True
        try:
            async with self._client.stream(
                "POST", f"{self._base_url}/chat", json=payload
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        evt = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue
                    etype = evt.get("type")
                    if etype == "text_delta":
                        delta = evt.get("delta", "")
                        if not delta:
                            continue
                        if first:
                            yield {"role": "assistant", "content": delta}
                            first = False
                        else:
                            yield {"content": delta}
                    elif etype == "final":
                        if first:
                            yield {"role": "assistant", "content": evt.get("full_text", "")}
                        return
            if first:
                yield {"role": "assistant", "content": ""}
        except Exception:
            _LOGGER.exception("HA Agent add-on unreachable")
            err_text = (
                "De agent is niet beschikbaar. Controleer de HA Agent add-on."
                if language.startswith("nl")
                else "The agent is unavailable. Check the HA Agent add-on."
            )
            if first:
                yield {"role": "assistant", "content": err_text}
            else:
                yield {"content": " " + err_text}
