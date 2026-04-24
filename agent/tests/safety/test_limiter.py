import pytest
from freezegun import freeze_time

from ha_agent.safety.limiter import RateLimiter, RateLimitExceeded


def test_allows_up_to_n_per_minute() -> None:
    limiter = RateLimiter(max_per_minute=3)
    with freeze_time("2026-04-19T10:00:00Z"):
        for _ in range(3):
            limiter.check("session-1")
        with pytest.raises(RateLimitExceeded) as exc:
            limiter.check("session-1")
        assert "retry_in" in str(exc.value) or exc.value.retry_in > 0


def test_separate_sessions_are_independent() -> None:
    limiter = RateLimiter(max_per_minute=2)
    with freeze_time("2026-04-19T10:00:00Z"):
        limiter.check("a")
        limiter.check("a")
        limiter.check("b")
        limiter.check("b")


def test_window_expires() -> None:
    limiter = RateLimiter(max_per_minute=1)
    with freeze_time("2026-04-19T10:00:00Z") as frozen:
        limiter.check("s")
        frozen.tick(61)
        limiter.check("s")
