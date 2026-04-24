from __future__ import annotations

from typing import Any

from ..memory.aliases import AliasStore


class AliasTools:
    def __init__(self, store: AliasStore) -> None:
        self._store = store

    async def remember_alias(self, alias: str, target: str) -> dict[str, Any]:
        """Save a natural-language alias → HA target mapping. Target is typically an
        entity_id (or comma-separated list for groups). Use when the user teaches a
        nickname ("noem deze lamp voortaan 'leeslamp'")."""
        try:
            await self._store.set(alias, target)
            return {"status": "ok", "alias": alias.strip().lower(), "target": target}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def forget_alias(self, alias: str) -> dict[str, Any]:
        """Remove a saved alias."""
        try:
            removed = await self._store.delete(alias)
            return {"status": "ok" if removed else "not_found", "alias": alias}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    async def list_aliases(self) -> dict[str, Any]:
        """Return all saved aliases. Usually unnecessary — the set is already in your
        system prompt."""
        return {"status": "ok", "aliases": self._store.all()}


def make_alias_tools(store: AliasStore) -> AliasTools:
    return AliasTools(store)
