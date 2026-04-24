from collections.abc import Iterable

from ..ha.types import EntityRef


class KeywordIndex:
    def __init__(self) -> None:
        self._entries: dict[str, EntityRef] = {}

    def rebuild(self, entities: Iterable[EntityRef]) -> None:
        self._entries = {e.entity_id: e for e in entities}

    def upsert(self, entity: EntityRef) -> None:
        self._entries[entity.entity_id] = entity

    def remove(self, entity_id: str) -> None:
        self._entries.pop(entity_id, None)

    def search(self, query: str, domain: str | None = None, limit: int = 20) -> list[EntityRef]:
        q = query.lower().strip()
        if not q:
            return []
        out: list[EntityRef] = []
        for e in self._entries.values():
            if domain and not e.entity_id.startswith(f"{domain}."):
                continue
            haystack = f"{e.entity_id} {e.friendly_name} {e.area or ''}".lower()
            if q in haystack:
                out.append(e)
                if len(out) >= limit:
                    break
        return out
