from typing import Any

from pydantic import BaseModel


class EntityRef(BaseModel):
    entity_id: str
    friendly_name: str
    area: str | None = None
    state: str | None = None


class ServiceRef(BaseModel):
    domain: str
    service: str
    description: str | None = None
    fields: dict[str, Any] = {}


class StateSnapshot(BaseModel):
    entity_id: str
    state: str
    attributes: dict[str, Any] = {}
    last_changed: str
    last_updated: str
