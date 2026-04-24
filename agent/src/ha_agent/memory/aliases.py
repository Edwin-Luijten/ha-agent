"""Persistent alias store: user vocabulary → HA targets.

An alias is a natural-language key (lowercased) mapped to a target string —
typically an `entity_id`, or a comma-separated list if the user thinks of the
alias as a group ("sfeerverlichting beneden"). The agent reads these on every
turn so phrasing like "edwin's spotify" resolves without re-asking.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path


class AliasStore:
    def __init__(self, path: Path) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._data: dict[str, dict] = {}
        self._loaded = False

    async def load(self) -> None:
        if not self._path.exists():
            self._loaded = True
            return
        raw = await asyncio.to_thread(self._path.read_text, encoding="utf-8")
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                # Accept both legacy `{alias: "entity_id"}` and rich `{alias: {target, ...}}`.
                normalized: dict[str, dict] = {}
                for k, v in parsed.items():
                    key = _normalize(str(k))
                    if not key:
                        continue
                    if isinstance(v, str):
                        normalized[key] = {"target": v, "added_at": None}
                    elif isinstance(v, dict) and isinstance(v.get("target"), str):
                        normalized[key] = {
                            "target": v["target"],
                            "added_at": v.get("added_at"),
                        }
                self._data = normalized
        except json.JSONDecodeError:
            self._data = {}
        self._loaded = True

    def get(self, alias: str) -> str | None:
        row = self._data.get(_normalize(alias))
        return row["target"] if row else None

    def all(self) -> dict[str, dict]:
        return {k: dict(v) for k, v in self._data.items()}

    def pairs(self) -> list[tuple[str, str]]:
        """Sorted (alias, target) pairs — convenient for the instruction context."""
        return sorted((k, v["target"]) for k, v in self._data.items())

    async def set(self, alias: str, target: str) -> None:
        key = _normalize(alias)
        if not key:
            raise ValueError("alias must be non-empty")
        cleaned_target = target.strip()
        if not cleaned_target:
            raise ValueError("target must be non-empty")
        async with self._lock:
            self._data[key] = {
                "target": cleaned_target,
                "added_at": datetime.now(UTC).isoformat(),
            }
            await self._save()

    async def delete(self, alias: str) -> bool:
        key = _normalize(alias)
        async with self._lock:
            if key not in self._data:
                return False
            self._data.pop(key, None)
            await self._save()
            return True

    async def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        payload = json.dumps(self._data, ensure_ascii=False, indent=2, sort_keys=True)
        await asyncio.to_thread(tmp.write_text, payload, encoding="utf-8")
        await asyncio.to_thread(tmp.replace, self._path)


def _normalize(alias: str) -> str:
    return " ".join(alias.strip().lower().split())
