"""Declarative assertion DSL for eval cases.

Each assertion is a small dict the YAML corpus mirrors 1:1, e.g.:

    - must_call_service: {domain: light, service: turn_on, entity_id: "^light\\.living_room"}
    - must_not_call_service: {domain: media_player, service: play_media}
    - must_render: plan
    - response_contains: "woonkamer"
    - max_llm_calls: 4
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class Outcome:
    tool_calls: list[dict[str, Any]]
    components: list[dict[str, Any]]
    response_text: str
    llm_calls: int


@dataclass
class AssertionResult:
    ok: bool
    name: str
    message: str


def check(assertion: dict[str, Any] | str, outcome: Outcome) -> AssertionResult:
    """Check a single assertion against an outcome."""
    name, value = _normalize(assertion)
    checker = _CHECKS.get(name)
    if checker is None:
        return AssertionResult(False, name, f"unknown assertion: {name!r}")
    return checker(value, outcome)


def _normalize(a: dict[str, Any] | str) -> tuple[str, Any]:
    if isinstance(a, str):
        return a, True
    if not isinstance(a, dict) or len(a) != 1:
        raise ValueError(f"assertion must be {{name: value}}, got: {a!r}")
    (name, value), = a.items()
    return name, value


def _must_call_service(value: Any, outcome: Outcome) -> AssertionResult:
    if not isinstance(value, dict):
        return AssertionResult(False, "must_call_service", f"expected dict, got {value!r}")
    domain = value.get("domain")
    service = value.get("service")
    entity_rx = value.get("entity_id")
    for call in outcome.tool_calls:
        if call.get("name") != "call_service":
            continue
        args = call.get("args") or {}
        if domain and args.get("domain") != domain:
            continue
        if service and args.get("service") != service:
            continue
        if entity_rx:
            data = args.get("data") or {}
            eid = data.get("entity_id")
            ids = eid if isinstance(eid, list) else [eid] if eid else []
            if not any(isinstance(e, str) and re.search(entity_rx, e) for e in ids):
                continue
        return AssertionResult(True, "must_call_service", f"matched {domain}.{service}")
    return AssertionResult(
        False, "must_call_service", f"no call matched {domain}.{service} entity={entity_rx}"
    )


def _must_not_call_service(value: Any, outcome: Outcome) -> AssertionResult:
    if not isinstance(value, dict):
        return AssertionResult(False, "must_not_call_service", f"expected dict, got {value!r}")
    domain = value.get("domain")
    service = value.get("service")
    entity_rx = value.get("entity_id")
    for call in outcome.tool_calls:
        if call.get("name") != "call_service":
            continue
        args = call.get("args") or {}
        if domain and args.get("domain") != domain:
            continue
        if service and args.get("service") != service:
            continue
        if entity_rx:
            data = args.get("data") or {}
            eid = data.get("entity_id")
            ids = eid if isinstance(eid, list) else [eid] if eid else []
            if not any(isinstance(e, str) and re.search(entity_rx, e) for e in ids):
                continue
        return AssertionResult(
            False,
            "must_not_call_service",
            f"unexpectedly called {domain}.{service} entity={entity_rx}",
        )
    return AssertionResult(True, "must_not_call_service", "no forbidden calls")


def _must_render(value: Any, outcome: Outcome) -> AssertionResult:
    kind = value if isinstance(value, str) else value.get("kind")
    for c in outcome.components:
        if c.get("kind") == kind:
            return AssertionResult(True, "must_render", f"rendered {kind}")
    return AssertionResult(False, "must_render", f"no component of kind {kind!r}")


def _must_not_render(value: Any, outcome: Outcome) -> AssertionResult:
    kind = value if isinstance(value, str) else value.get("kind")
    for c in outcome.components:
        if c.get("kind") == kind:
            return AssertionResult(
                False, "must_not_render", f"unexpectedly rendered {kind}"
            )
    return AssertionResult(True, "must_not_render", f"no {kind} rendered")


def _response_contains(value: Any, outcome: Outcome) -> AssertionResult:
    needle = str(value).lower()
    if needle in outcome.response_text.lower():
        return AssertionResult(True, "response_contains", f"found {needle!r}")
    return AssertionResult(
        False, "response_contains", f"{needle!r} not in response (got: {outcome.response_text!r})"
    )


def _response_matches(value: Any, outcome: Outcome) -> AssertionResult:
    if re.search(str(value), outcome.response_text):
        return AssertionResult(True, "response_matches", f"matched {value!r}")
    return AssertionResult(
        False, "response_matches", f"response did not match {value!r}: {outcome.response_text!r}"
    )


def _max_llm_calls(value: Any, outcome: Outcome) -> AssertionResult:
    n = int(value)
    if outcome.llm_calls <= n:
        return AssertionResult(True, "max_llm_calls", f"{outcome.llm_calls} <= {n}")
    return AssertionResult(
        False, "max_llm_calls", f"{outcome.llm_calls} LLM calls exceeded budget {n}"
    )


_CHECKS = {
    "must_call_service": _must_call_service,
    "must_not_call_service": _must_not_call_service,
    "must_render": _must_render,
    "must_not_render": _must_not_render,
    "response_contains": _response_contains,
    "response_matches": _response_matches,
    "max_llm_calls": _max_llm_calls,
}
