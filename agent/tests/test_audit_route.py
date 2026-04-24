from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ha_agent.main import create_app
from ha_agent.safety.audit import AuditLog


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "t")
    app = create_app(skip_warmup=True)
    audit = AuditLog(path=tmp_path / "audit.jsonl")
    await audit.append(
        session_id="s",
        user_id="u",
        domain="light",
        service="turn_on",
        data={"entity_id": "light.x"},
        result="ok",
        confirmation_required=False,
    )
    app.state.agent_state.audit = audit
    return TestClient(app)


async def test_audit_endpoint_returns_tail(client: TestClient) -> None:
    r = client.get("/audit?limit=50")
    assert r.status_code == 200
    body = r.json()
    assert body["entries"][0]["service"] == "turn_on"
