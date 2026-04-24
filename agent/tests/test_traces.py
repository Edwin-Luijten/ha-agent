import json
from pathlib import Path

from freezegun import freeze_time

from ha_agent.observability.traces import TraceLog


@freeze_time("2026-04-19T10:00:00Z")
async def test_write_creates_daily_file(tmp_path: Path) -> None:
    log = TraceLog(base_dir=tmp_path)
    await log.write(
        session_id="s",
        user_message="zet de lamp aan",
        tool_calls=[{"name": "call_service", "args": {}, "latency_ms": 12}],
        response_text="oké",
        total_latency_ms=150,
    )
    f = tmp_path / "2026-04-19.jsonl"
    assert f.exists()
    entry = json.loads(f.read_text().strip())
    assert entry["user_message"] == "zet de lamp aan"
    assert entry["total_latency_ms"] == 150
    assert entry["tool_calls"][0]["name"] == "call_service"
