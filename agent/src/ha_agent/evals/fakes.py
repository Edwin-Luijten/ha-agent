"""Minimal fakes for the eval harness — no network, no sentence-transformer."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import numpy as np

from ..ha.types import ServiceRef, StateSnapshot


class FakeHAClient:
    """Stand-in for HAClient that records calls instead of hitting HA."""

    def __init__(self, states: list[StateSnapshot], services: list[ServiceRef]) -> None:
        self._states = states
        self._services = services
        self.calls: list[dict[str, Any]] = []

    async def aclose(self) -> None:
        pass

    async def get_states(self) -> list[StateSnapshot]:
        return list(self._states)

    async def get_state(self, entity_id: str) -> StateSnapshot:
        for s in self._states:
            if s.entity_id == entity_id:
                return s
        raise KeyError(entity_id)

    async def get_services(self) -> list[ServiceRef]:
        return list(self._services)

    async def call_service(
        self, domain: str, service: str, data: dict[str, Any]
    ) -> list[dict[str, Any]]:
        self.calls.append({"domain": domain, "service": service, "data": data})
        return []

    async def get_history(self, entity_id: str, hours: int = 24) -> list[StateSnapshot]:
        return [s for s in self._states if s.entity_id == entity_id]


class ZeroEncoder:
    """Embedding encoder that maps everything to a constant unit vector.

    The semantic index degenerates to "any result wins" — fine for evals
    where we care about routing correctness, not embedding quality.
    """

    def encode(self, texts: list[str], normalize_embeddings: bool = True) -> np.ndarray:
        return np.tile(np.array([[0.0, 0.0, 0.0, 1.0]], dtype=np.float32), (len(texts), 1))


def build_fake_states(entities: list[dict[str, Any]]) -> list[StateSnapshot]:
    now = datetime.now(UTC).isoformat()
    out: list[StateSnapshot] = []
    for e in entities:
        out.append(
            StateSnapshot(
                entity_id=e["entity_id"],
                state=e.get("state", "unknown"),
                attributes=e.get("attributes", {}),
                last_changed=now,
                last_updated=now,
            )
        )
    return out


def build_fake_services(services: list[dict[str, Any]]) -> list[ServiceRef]:
    return [
        ServiceRef(
            domain=s["domain"],
            service=s["service"],
            description=s.get("description"),
            fields=s.get("fields", {}),
        )
        for s in services
    ]


def default_fake_entities() -> list[dict[str, Any]]:
    """A tiny test household: two rooms, three lights, two speakers, two weather sources."""
    return [
        {
            "entity_id": "light.living_room_ceiling",
            "state": "off",
            "attributes": {"friendly_name": "Woonkamer plafond", "brightness": 0},
        },
        {
            "entity_id": "light.living_room_floor",
            "state": "off",
            "attributes": {"friendly_name": "Woonkamer vloerlamp", "brightness": 0},
        },
        {
            "entity_id": "light.bedroom_ceiling",
            "state": "off",
            "attributes": {"friendly_name": "Slaapkamer plafond"},
        },
        {
            "entity_id": "media_player.living_room",
            "state": "off",
            "attributes": {"friendly_name": "Living Room"},
        },
        {
            "entity_id": "media_player.living_room_2",
            "state": "idle",
            "attributes": {"friendly_name": "Living Room (MA)"},
        },
        {
            "entity_id": "media_player.spotify_edwin",
            "state": "off",
            "attributes": {"friendly_name": "Spotify Edwin"},
        },
        {
            "entity_id": "media_player.spotify_sasha",
            "state": "off",
            "attributes": {"friendly_name": "Spotify Sasha"},
        },
        {
            "entity_id": "weather.buienradar",
            "state": "sunny",
            "attributes": {
                "friendly_name": "Buienradar",
                "temperature": 18,
                "humidity": 60,
            },
        },
        {
            "entity_id": "sensor.outdoor_temperature",
            "state": "17.2",
            "attributes": {"friendly_name": "Buiten temperatuur", "unit_of_measurement": "°C"},
        },
    ]


def default_fake_services() -> list[dict[str, Any]]:
    return [
        {"domain": "light", "service": "turn_on", "fields": {}},
        {"domain": "light", "service": "turn_off", "fields": {}},
        {"domain": "media_player", "service": "turn_on", "fields": {}},
        {"domain": "media_player", "service": "turn_off", "fields": {}},
        {"domain": "media_player", "service": "media_play", "fields": {}},
        {"domain": "media_player", "service": "media_pause", "fields": {}},
        {"domain": "media_player", "service": "play_media", "fields": {}},
        {"domain": "media_player", "service": "select_source", "fields": {}},
        {"domain": "weather", "service": "get_forecasts", "fields": {}},
    ]
