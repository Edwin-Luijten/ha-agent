import pytest
from pydantic import ValidationError

from ha_agent.config import Settings


def test_settings_loads_required_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "supervisor-token")
    settings = Settings()
    assert settings.google_api_key == "test-key"
    assert settings.supervisor_token == "supervisor-token"
    assert settings.model == "gemini-flash-latest"
    assert settings.language == "nl"
    assert settings.rate_limit_per_min == 20
    assert settings.adults == ["edwin", "ilona"]


def test_settings_fails_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setenv("SUPERVISOR_TOKEN", "supervisor-token")
    with pytest.raises(ValidationError):
        Settings()
