from dataclasses import dataclass

from ..ha.client import HAClient
from ..memory.aliases import AliasStore
from ..registry import Registry
from ..safety.audit import AuditLog
from ..safety.limiter import RateLimiter


@dataclass
class ToolContext:
    ha: HAClient
    registry: Registry
    audit: AuditLog
    limiter: RateLimiter
    aliases: AliasStore | None = None
