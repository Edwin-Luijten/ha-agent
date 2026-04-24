from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from .types import ServiceRef, StateSnapshot


class HAClient:
    def __init__(self, base_url: str, token: str, timeout: float = 10.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {token}"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_states(self) -> list[StateSnapshot]:
        r = await self._client.get("/api/states")
        r.raise_for_status()
        return [StateSnapshot.model_validate(item) for item in r.json()]

    async def get_state(self, entity_id: str) -> StateSnapshot:
        r = await self._client.get(f"/api/states/{entity_id}")
        r.raise_for_status()
        return StateSnapshot.model_validate(r.json())

    async def get_services(self) -> list[ServiceRef]:
        r = await self._client.get("/api/services")
        r.raise_for_status()
        services: list[ServiceRef] = []
        for block in r.json():
            domain = block["domain"]
            for name, meta in block.get("services", {}).items():
                services.append(
                    ServiceRef(
                        domain=domain,
                        service=name,
                        description=meta.get("description"),
                        fields=meta.get("fields", {}),
                    )
                )
        return services

    async def call_service(
        self, domain: str, service: str, data: dict[str, Any]
    ) -> list[dict[str, Any]]:
        r = await self._client.post(f"/api/services/{domain}/{service}", json=data)
        r.raise_for_status()
        return r.json()

    async def get_history(self, entity_id: str, hours: int = 24) -> list[StateSnapshot]:
        start = (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat()
        r = await self._client.get(
            f"/api/history/period/{start}",
            params={"filter_entity_id": entity_id, "minimal_response": "true"},
        )
        r.raise_for_status()
        payload = r.json()
        if not payload:
            return []
        return [StateSnapshot.model_validate(item) for item in payload[0]]
