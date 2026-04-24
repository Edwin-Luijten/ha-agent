from ha_agent.ha.types import EntityRef
from ha_agent.index.keyword import KeywordIndex


def make(entity_id: str, friendly: str, area: str | None = None) -> EntityRef:
    return EntityRef(entity_id=entity_id, friendly_name=friendly, area=area)


def test_search_matches_entity_id_substring() -> None:
    idx = KeywordIndex()
    idx.rebuild(
        [
            make("light.hallway", "Hallway"),
            make("media_player.living_room", "Living Room"),
        ]
    )
    hits = idx.search("hallway")
    assert [h.entity_id for h in hits] == ["light.hallway"]


def test_search_matches_friendly_name_case_insensitive() -> None:
    idx = KeywordIndex()
    idx.rebuild([make("light.x", "Keukenlamp", area="Kitchen")])
    hits = idx.search("KEUKEN")
    assert [h.entity_id for h in hits] == ["light.x"]


def test_search_filters_by_domain() -> None:
    idx = KeywordIndex()
    idx.rebuild(
        [
            make("light.hallway", "Hallway"),
            make("switch.hallway_switch", "Hallway Switch"),
        ]
    )
    hits = idx.search("hallway", domain="light")
    assert [h.entity_id for h in hits] == ["light.hallway"]


def test_upsert_replaces_existing_entry() -> None:
    idx = KeywordIndex()
    idx.rebuild([make("light.x", "Oldname")])
    idx.upsert(make("light.x", "Newname"))
    assert [h.entity_id for h in idx.search("newname")] == ["light.x"]
    assert idx.search("oldname") == []


def test_remove_drops_entry() -> None:
    idx = KeywordIndex()
    idx.rebuild([make("light.x", "Keep")])
    idx.remove("light.x")
    assert idx.search("keep") == []


def test_search_empty_query_returns_empty() -> None:
    idx = KeywordIndex()
    idx.rebuild([make("light.hallway", "Hallway")])
    assert idx.search("") == []
    assert idx.search("   ") == []


def test_search_respects_limit() -> None:
    idx = KeywordIndex()
    idx.rebuild([make(f"light.room_{i}", f"Room {i}", area="Living") for i in range(10)])
    hits = idx.search("living", limit=3)
    assert len(hits) == 3
