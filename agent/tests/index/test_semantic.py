import numpy as np
import pytest

from ha_agent.ha.types import EntityRef
from ha_agent.index.semantic import SemanticIndex


class FakeEncoder:
    """Deterministic encoder: text -> word-count vector over a fixed vocab."""

    def __init__(self) -> None:
        self.vocab = [
            "hallway",
            "kitchen",
            "living",
            "room",
            "light",
            "speaker",
            "edwin",
            "spotify",
            "media",
        ]

    def encode(self, texts: list[str], normalize_embeddings: bool = True) -> np.ndarray:
        vecs = np.zeros((len(texts), len(self.vocab)), dtype=np.float32)
        for i, t in enumerate(texts):
            lower = t.lower()
            for j, w in enumerate(self.vocab):
                vecs[i, j] = lower.count(w)
        if normalize_embeddings:
            norms = np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-9
            vecs = vecs / norms
        return vecs


@pytest.fixture
def entities() -> list[EntityRef]:
    return [
        EntityRef(entity_id="light.hallway", friendly_name="Hallway Light", area="Hallway"),
        EntityRef(
            entity_id="media_player.living_room",
            friendly_name="Living Room Speaker",
            area="Living Room",
        ),
        EntityRef(
            entity_id="media_player.spotify_edwin",
            friendly_name="Edwin Spotify",
            area=None,
        ),
    ]


def test_search_returns_nearest_entity(entities: list[EntityRef]) -> None:
    idx = SemanticIndex(encoder=FakeEncoder())
    idx.rebuild(entities)
    hits = idx.search("edwin spotify", top_k=1)
    assert [h.entity_id for h in hits] == ["media_player.spotify_edwin"]


def test_search_ranks_multiple_hits(entities: list[EntityRef]) -> None:
    idx = SemanticIndex(encoder=FakeEncoder())
    idx.rebuild(entities)
    hits = idx.search("living room speaker", top_k=3)
    assert hits[0].entity_id == "media_player.living_room"


def test_upsert_updates_embedding(entities: list[EntityRef]) -> None:
    idx = SemanticIndex(encoder=FakeEncoder())
    idx.rebuild(entities)
    idx.upsert(EntityRef(entity_id="light.hallway", friendly_name="Kitchen Light", area="Kitchen"))
    hits = idx.search("kitchen", top_k=1)
    assert [h.entity_id for h in hits] == ["light.hallway"]
