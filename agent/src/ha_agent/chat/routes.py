from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Protocol

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from .schema import ChatRequest


class ChatBackend(Protocol):
    def stream(self, req: ChatRequest) -> AsyncIterator[dict]: ...


def build_chat_router(backend: ChatBackend) -> APIRouter:
    router = APIRouter()

    @router.post("/chat")
    async def chat(req: ChatRequest) -> EventSourceResponse:
        async def generator():
            async for event in backend.stream(req):
                yield {"data": json.dumps(event, ensure_ascii=False)}

        return EventSourceResponse(generator())

    return router
