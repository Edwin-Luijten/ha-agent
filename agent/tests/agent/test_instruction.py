from ha_agent.agent.instruction import build_system_instruction
from ha_agent.config import Settings


def make_settings(**overrides) -> Settings:
    base = {
        "GOOGLE_API_KEY": "k",
        "SUPERVISOR_TOKEN": "t",
    }
    import os

    for key, val in base.items():
        os.environ[key] = val
    return Settings(**overrides)


def test_instruction_includes_adults_and_language() -> None:
    s = make_settings(adults=["alice", "bob"], language="nl")
    prompt = build_system_instruction(s)
    assert "alice" in prompt and "bob" in prompt
    assert "nederlands" in prompt.lower() or "dutch" in prompt.lower()


def test_instruction_lists_confirmation_domains() -> None:
    s = make_settings()
    prompt = build_system_instruction(s)
    for domain in ["alarm_control_panel", "lock", "homeassistant", "hassio"]:
        assert domain in prompt


def test_instruction_mentions_semantic_first_rule() -> None:
    s = make_settings()
    prompt = build_system_instruction(s)
    assert "semantic_search_entities" in prompt
