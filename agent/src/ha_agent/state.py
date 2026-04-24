from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from google.adk.sessions import InMemorySessionService

    from .ha.client import HAClient
    from .ha.ws import HAEventSubscriber
    from .memory.aliases import AliasStore
    from .observability.traces import TraceLog
    from .registry import Registry
    from .safety.audit import AuditLog
    from .safety.limiter import RateLimiter


@dataclass
class AppState:
    settings: object  # pydantic Settings
    ha: HAClient | None = None
    registry: Registry | None = None
    audit: AuditLog | None = None
    limiter: RateLimiter | None = None
    traces: TraceLog | None = None
    sessions: InMemorySessionService | None = None
    subscriber: HAEventSubscriber | None = None
    aliases: AliasStore | None = None
    warm: bool = False
    last_refresh: datetime | None = None
