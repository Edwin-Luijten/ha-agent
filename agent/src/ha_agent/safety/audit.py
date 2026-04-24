from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


class AuditLog:
    def __init__(self, path: Path) -> None:
        self._path = Path(path)
        self._lock = asyncio.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    async def append(
        self,
        *,
        session_id: str,
        user_id: str,
        domain: str,
        service: str,
        data: dict[str, Any],
        result: str,
        confirmation_required: bool,
        response: Any | None = None,
    ) -> None:
        entry: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "session_id": session_id,
            "user_id": user_id,
            "domain": domain,
            "service": service,
            "data": data,
            "result": result,
            "confirmation_required": confirmation_required,
        }
        if response is not None:
            entry["response"] = response
        line = json.dumps(entry, ensure_ascii=False, default=str) + "\n"
        async with self._lock:
            await asyncio.to_thread(self._append_sync, line)

    def _append_sync(self, line: str) -> None:
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(line)

    async def tail(self, n: int = 100) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        lines = await asyncio.to_thread(self._read_all)
        return [json.loads(line) for line in lines[-n:]]

    def _read_all(self) -> list[str]:
        return self._path.read_text(encoding="utf-8").splitlines()

    async def purge_older_than(self, *, days: int) -> int:
        """Rewrite the audit file keeping only entries newer than the cutoff. Returns dropped count."""
        if not self._path.exists():
            return 0
        cutoff = datetime.now(UTC) - timedelta(days=days)
        async with self._lock:
            return await asyncio.to_thread(self._purge_sync, cutoff.isoformat())

    def _purge_sync(self, cutoff_iso: str) -> int:
        kept: list[str] = []
        dropped = 0
        with self._path.open("r", encoding="utf-8") as fh:
            for line in fh:
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    entry = json.loads(stripped)
                except json.JSONDecodeError:
                    # Keep malformed rather than silently delete — investigator-friendly.
                    kept.append(line if line.endswith("\n") else line + "\n")
                    continue
                if (entry.get("ts") or "") >= cutoff_iso:
                    kept.append(line if line.endswith("\n") else line + "\n")
                else:
                    dropped += 1
        if dropped == 0:
            return 0
        tmp = self._path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            fh.writelines(kept)
        tmp.replace(self._path)
        return dropped
