import json
from pathlib import Path

from freezegun import freeze_time

from ha_agent.safety.audit import AuditLog


@freeze_time("2026-04-19T10:00:00Z")
async def test_append_writes_jsonl(tmp_path: Path) -> None:
    log = AuditLog(path=tmp_path / "audit.jsonl")
    await log.append(
        session_id="s1",
        user_id="u1",
        domain="light",
        service="turn_on",
        data={"entity_id": "light.hallway"},
        result="ok",
        confirmation_required=False,
    )
    lines = (tmp_path / "audit.jsonl").read_text().splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry == {
        "ts": "2026-04-19T10:00:00+00:00",
        "session_id": "s1",
        "user_id": "u1",
        "domain": "light",
        "service": "turn_on",
        "data": {"entity_id": "light.hallway"},
        "result": "ok",
        "confirmation_required": False,
    }


async def test_tail_returns_last_n(tmp_path: Path) -> None:
    log = AuditLog(path=tmp_path / "audit.jsonl")
    for i in range(5):
        await log.append(
            session_id="s",
            user_id="u",
            domain="light",
            service="turn_on",
            data={"entity_id": f"light.{i}"},
            result="ok",
            confirmation_required=False,
        )
    tail = await log.tail(n=2)
    assert len(tail) == 2
    assert tail[-1]["data"]["entity_id"] == "light.4"
