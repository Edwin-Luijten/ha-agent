from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def _reset_state() -> Iterator[None]:
    """Placeholder for future shared-state resets."""
    yield
