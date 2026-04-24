import asyncio
import itertools
import json
import logging
import random
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

import websockets

logger = logging.getLogger(__name__)

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]

SUBSCRIBED_EVENTS = [
    "entity_registry_updated",
    "area_registry_updated",
    "device_registry_updated",
    "state_changed",
    "service_registered",
    "service_removed",
]


class HAEventSubscriber:
    def __init__(self, url: str, token: str, on_event: EventHandler) -> None:
        self._url = url
        self._token = token
        self._on_event = on_event
        # Observability surface — read by /healthz.
        self.connected: bool = False
        self.last_event_ts: datetime | None = None
        self.last_connected_ts: datetime | None = None
        self.reconnect_count: int = 0

    async def run(self) -> None:
        # Exponential backoff with jitter. Resets to 0 on a successful authed session.
        attempt = 0
        base = 1.0
        ceiling = 60.0
        while True:
            try:
                self._ids = itertools.count(1)
                async with websockets.connect(self._url) as ws:
                    await self._handshake(ws)
                    await self._subscribe(ws)
                    self.connected = True
                    self.last_connected_ts = datetime.now(UTC)
                    attempt = 0
                    try:
                        await self._pump(ws)
                    finally:
                        self.connected = False
            except asyncio.CancelledError:
                self.connected = False
                raise
            except Exception:
                self.connected = False
                attempt += 1
                self.reconnect_count += 1
                wait = min(base * (2 ** (attempt - 1)), ceiling) + random.uniform(0, 1.0)
                logger.exception(
                    "HA ws disconnected; reconnect attempt %d in %.1fs", attempt, wait
                )
                await asyncio.sleep(wait)

    async def _handshake(self, ws: websockets.ClientConnection) -> None:
        hello = json.loads(await ws.recv())
        if hello.get("type") != "auth_required":
            raise RuntimeError(f"Expected auth_required from HA, got: {hello!r}")
        await ws.send(json.dumps({"type": "auth", "access_token": self._token}))
        reply = json.loads(await ws.recv())
        if reply.get("type") == "auth_invalid":
            raise RuntimeError(
                f"HA rejected the access token (auth_invalid): {reply.get('message', '')}"
            )
        if reply.get("type") != "auth_ok":
            raise RuntimeError(f"Expected auth_ok from HA, got: {reply!r}")

    async def _subscribe(self, ws: websockets.ClientConnection) -> None:
        for event_type in SUBSCRIBED_EVENTS:
            await ws.send(
                json.dumps(
                    {
                        "id": next(self._ids),
                        "type": "subscribe_events",
                        "event_type": event_type,
                    }
                )
            )

    async def _pump(self, ws: websockets.ClientConnection) -> None:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "event":
                self.last_event_ts = datetime.now(UTC)
                await self._on_event(msg["event"])
