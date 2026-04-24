from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from .ha.client import HAClient
from .ha.types import EntityRef, ServiceRef
from .index.keyword import KeywordIndex
from .index.semantic import Encoder, SemanticIndex

logger = logging.getLogger(__name__)


REFRESHING_EVENTS = {
    "entity_registry_updated",
    "area_registry_updated",
    "device_registry_updated",
    "service_registered",
    "service_removed",
}


class Registry:
    def __init__(self, ha_client: HAClient, encoder: Encoder) -> None:
        self._ha = ha_client
        self._encoder = encoder
        self.keyword = KeywordIndex()
        self.semantic = SemanticIndex(encoder=encoder)
        self.services: list[ServiceRef] = []
        self.last_refreshed_at: datetime | None = None
        self._refresh_lock = asyncio.Lock()

    async def refresh(self) -> None:
        async with self._refresh_lock:
            states = await self._ha.get_states()
            entities = [
                EntityRef(
                    entity_id=s.entity_id,
                    friendly_name=s.attributes.get("friendly_name", s.entity_id),
                    area=s.attributes.get("area"),
                    state=s.state,
                )
                for s in states
            ]
            self.keyword.rebuild(entities)
            self.semantic.rebuild(entities)
            self.services = await self._ha.get_services()
            self.last_refreshed_at = datetime.now(UTC)
            logger.info(
                "registry refreshed",
                extra={"entities": len(entities), "services": len(self.services)},
            )

    async def handle_event(self, event: dict) -> None:
        # No lock held here: refresh() and handle_event() both run in the same
        # asyncio loop, and neither yields control mid-mutation. Races are only
        # possible if a future caller hands these off to a threadpool.
        etype = event.get("event_type")
        data = event.get("data", {})
        if etype == "state_changed":
            eid = data.get("entity_id")
            new = data.get("new_state")
            if not eid or not new:
                # Entity removed (new_state=None): deferred cleanup via the next
                # entity_registry_updated event triggers a full refresh.
                return
            ref = EntityRef(
                entity_id=eid,
                friendly_name=new.get("attributes", {}).get("friendly_name", eid),
                area=new.get("attributes", {}).get("area"),
                state=new.get("state"),
            )
            self.keyword.upsert(ref)
            self.semantic.upsert(ref)
        elif etype in REFRESHING_EVENTS:
            await self.refresh()
