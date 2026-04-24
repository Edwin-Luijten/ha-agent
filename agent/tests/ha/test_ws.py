import asyncio
import contextlib
import json

import pytest
import websockets

from ha_agent.ha.ws import HAEventSubscriber


@pytest.fixture
async def ws_server():
    received: list[dict] = []

    async def handler(ws: websockets.ServerConnection) -> None:
        await ws.send(json.dumps({"type": "auth_required"}))
        auth = json.loads(await ws.recv())
        received.append(auth)
        await ws.send(json.dumps({"type": "auth_ok"}))
        subscribe = json.loads(await ws.recv())
        received.append(subscribe)
        await ws.send(
            json.dumps(
                {
                    "id": subscribe["id"],
                    "type": "event",
                    "event": {"event_type": "entity_registry_updated", "data": {}},
                }
            )
        )
        await asyncio.sleep(0.05)

    server = await websockets.serve(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        yield f"ws://127.0.0.1:{port}", received
    finally:
        server.close()
        await server.wait_closed()


async def test_subscriber_authenticates_and_emits_events(ws_server) -> None:
    url, received = ws_server
    events: list[dict] = []

    async def on_event(evt: dict) -> None:
        events.append(evt)

    sub = HAEventSubscriber(url=url, token="abc", on_event=on_event)
    task = asyncio.create_task(sub.run())
    await asyncio.sleep(0.3)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

    assert received[0] == {"type": "auth", "access_token": "abc"}
    assert received[1]["type"] == "subscribe_events"
    assert events and events[0]["event_type"] == "entity_registry_updated"


@pytest.fixture
async def ws_server_bad_auth():
    received: list[dict] = []

    async def handler(ws: websockets.ServerConnection) -> None:
        await ws.send(json.dumps({"type": "auth_required"}))
        auth = json.loads(await ws.recv())
        received.append(auth)
        await ws.send(json.dumps({"type": "auth_invalid", "message": "Invalid access token"}))
        await asyncio.sleep(0.05)

    server = await websockets.serve(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        yield f"ws://127.0.0.1:{port}", received
    finally:
        server.close()
        await server.wait_closed()


async def test_auth_invalid_is_logged_and_retried(
    ws_server_bad_auth, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    url, _received = ws_server_bad_auth
    events: list[dict] = []

    async def on_event(evt: dict) -> None:
        events.append(evt)

    sub = HAEventSubscriber(url=url, token="bad-token", on_event=on_event)
    task = asyncio.create_task(sub.run())

    with caplog.at_level(logging.ERROR, logger="ha_agent.ha.ws"):
        await asyncio.sleep(0.3)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    assert events == []
    assert any(
        "auth_invalid" in record.message or "auth_invalid" in str(record.exc_info)
        for record in caplog.records
    )
