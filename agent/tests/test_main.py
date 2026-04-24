import pytest
from fastapi.testclient import TestClient

from ha_agent.main import create_app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "t")
    app = create_app(skip_warmup=True)
    return TestClient(app)


def test_healthz(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"ok", "warming_up"}
    assert "entities" in body
