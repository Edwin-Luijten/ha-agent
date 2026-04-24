from __future__ import annotations

from typing import Protocol

import numpy as np

from ..ha.types import EntityRef


class Encoder(Protocol):
    def encode(self, texts: list[str], normalize_embeddings: bool = True) -> np.ndarray: ...


def _entity_sentence(e: EntityRef) -> str:
    parts = [e.friendly_name]
    if e.area:
        parts.append(f"in the {e.area}")
    parts.append(e.entity_id.replace("_", " ").replace(".", " "))
    return " ".join(parts)


class SemanticIndex:
    def __init__(self, encoder: Encoder) -> None:
        self._encoder = encoder
        self._entity_ids: list[str] = []
        self._entities: dict[str, EntityRef] = {}
        self._matrix: np.ndarray | None = None

    def rebuild(self, entities: list[EntityRef]) -> None:
        self._entity_ids = [e.entity_id for e in entities]
        self._entities = {e.entity_id: e for e in entities}
        if entities:
            self._matrix = self._encoder.encode(
                [_entity_sentence(e) for e in entities], normalize_embeddings=True
            )
        else:
            self._matrix = None

    def upsert(self, entity: EntityRef) -> None:
        new_vec = self._encoder.encode([_entity_sentence(entity)], normalize_embeddings=True)
        self._entities[entity.entity_id] = entity
        if entity.entity_id in self._entity_ids:
            i = self._entity_ids.index(entity.entity_id)
            assert self._matrix is not None
            self._matrix[i] = new_vec[0]
        else:
            self._entity_ids.append(entity.entity_id)
            if self._matrix is None:
                self._matrix = new_vec
            else:
                self._matrix = np.vstack([self._matrix, new_vec])

    def remove(self, entity_id: str) -> None:
        if entity_id not in self._entities:
            return
        i = self._entity_ids.index(entity_id)
        self._entity_ids.pop(i)
        self._entities.pop(entity_id)
        assert self._matrix is not None
        self._matrix = np.delete(self._matrix, i, axis=0)

    def search(self, query: str, top_k: int = 5) -> list[EntityRef]:
        if self._matrix is None or len(self._entity_ids) == 0:
            return []
        q_vec = self._encoder.encode([query], normalize_embeddings=True)[0]
        scores = self._matrix @ q_vec
        top = np.argsort(-scores)[:top_k]
        return [self._entities[self._entity_ids[i]] for i in top]


def load_sentence_transformer(model_name: str) -> Encoder:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name)

    class _Adapter:
        def encode(self, texts: list[str], normalize_embeddings: bool = True) -> np.ndarray:
            return model.encode(
                texts, normalize_embeddings=normalize_embeddings, convert_to_numpy=True
            )

    return _Adapter()
