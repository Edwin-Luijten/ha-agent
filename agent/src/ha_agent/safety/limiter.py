from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimitExceeded(Exception):
    def __init__(self, retry_in: int) -> None:
        super().__init__(f"rate limit exceeded, retry_in={retry_in}s")
        self.retry_in = retry_in


class RateLimiter:
    def __init__(self, max_per_minute: int) -> None:
        self._max = max_per_minute
        self._window = 60.0
        self._calls: dict[str, deque[float]] = defaultdict(deque)

    def check(self, session_id: str) -> None:
        now = time.time()
        q = self._calls[session_id]
        while q and now - q[0] > self._window:
            q.popleft()
        if len(q) >= self._max:
            retry_in = int(self._window - (now - q[0])) + 1
            raise RateLimitExceeded(retry_in=retry_in)
        q.append(now)

    def purge_stale(self, *, age_seconds: float = 600.0) -> int:
        """Drop per-session deques whose most recent call is older than age_seconds (or empty)."""
        now = time.time()
        stale: list[str] = []
        for sid, q in self._calls.items():
            if not q or now - q[-1] > age_seconds:
                stale.append(sid)
        for sid in stale:
            self._calls.pop(sid, None)
        return len(stale)
