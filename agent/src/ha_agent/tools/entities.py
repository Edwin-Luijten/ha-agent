from __future__ import annotations

from typing import Any

from .context import ToolContext


class EntityTools:
    def __init__(self, ctx: ToolContext) -> None:
        self._ctx = ctx

    async def search_entities(self, query: str, domain: str | None = None) -> dict[str, Any]:
        """Substring search entities by id, friendly name, or area. Optional domain filter."""
        try:
            hits = self._ctx.registry.keyword.search(query, domain=domain)
            return {
                "status": "ok",
                "entities": [e.model_dump() for e in hits],
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def semantic_search_entities(self, query: str, top_k: int = 5) -> dict[str, Any]:
        """Semantic (embedding-based) entity search. Use for fuzzy natural-language queries."""
        try:
            hits = self._ctx.registry.semantic.search(query, top_k=top_k)
            return {
                "status": "ok",
                "entities": [e.model_dump() for e in hits],
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def get_state(self, entity_id: str) -> dict[str, Any]:
        """Return the current state and attributes of a single entity."""
        try:
            snap = await self._ctx.ha.get_state(entity_id)
            return {"status": "ok", "state": snap.model_dump()}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def get_history(self, entity_id: str, hours: int = 24) -> dict[str, Any]:
        """Return recent state history for an entity."""
        try:
            history = await self._ctx.ha.get_history(entity_id, hours=hours)
            return {
                "status": "ok",
                "history": [s.model_dump() for s in history],
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}


def make_entity_tools(ctx: ToolContext) -> EntityTools:
    return EntityTools(ctx)
