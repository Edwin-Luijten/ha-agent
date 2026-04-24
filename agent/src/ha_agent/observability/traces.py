from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


class TraceLog:
    def __init__(self, base_dir: Path) -> None:
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    async def write(
        self,
        *,
        session_id: str,
        user_message: str,
        tool_calls: list[dict[str, Any]],
        response_text: str,
        total_latency_ms: int,
        tokens: dict[str, Any] | None = None,
    ) -> None:
        now = datetime.now(UTC)
        entry: dict[str, Any] = {
            "ts": now.isoformat(),
            "session_id": session_id,
            "user_message": user_message,
            "tool_calls": tool_calls,
            "response_text": response_text,
            "total_latency_ms": total_latency_ms,
        }
        if tokens is not None:
            entry["tokens"] = tokens
        path = self._base / f"{now.date().isoformat()}.jsonl"
        line = json.dumps(entry, ensure_ascii=False) + "\n"
        async with self._lock:
            await asyncio.to_thread(self._append_sync, path, line)

    def _append_sync(self, path: Path, line: str) -> None:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line)

    async def read_recent(self, *, days: int = 7) -> list[dict[str, Any]]:
        """Return all trace entries from the last `days` days, newest first."""
        today = datetime.now(UTC).date()
        paths = [self._base / f"{(today - timedelta(days=i)).isoformat()}.jsonl" for i in range(days)]
        existing = [p for p in paths if p.exists()]
        entries = await asyncio.to_thread(self._read_files, existing)
        entries.sort(key=lambda e: e.get("ts", ""), reverse=True)
        return entries

    def _read_files(self, paths: list[Path]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for path in paths:
            try:
                with path.open("r", encoding="utf-8") as fh:
                    for line in fh:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            out.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
            except OSError:
                continue
        return out

    async def purge_older_than(self, *, days: int) -> int:
        """Delete per-day trace files older than `days`. Returns file count removed."""
        cutoff = (datetime.now(UTC) - timedelta(days=days)).date()
        async with self._lock:
            return await asyncio.to_thread(self._purge_sync, cutoff)

    def _purge_sync(self, cutoff: Any) -> int:
        removed = 0
        for path in self._base.glob("*.jsonl"):
            try:
                file_date = datetime.fromisoformat(path.stem).date()
            except ValueError:
                continue
            if file_date < cutoff:
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    continue
        return removed
