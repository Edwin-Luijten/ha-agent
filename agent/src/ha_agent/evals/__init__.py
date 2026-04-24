"""Evaluation harness — run the real agent against a fake HA and assert outcomes.

Usage:

    uv run python -m ha_agent.evals.runner [--corpus PATH] [--filter ID]

Cases are defined in `corpus.yaml` (default next to the runner). Each case has
an `input` (user text), optional `setup` (alias store seed), and a list of
`assertions` checked against the captured tool calls and rendered components.
The harness uses a real Gemini call, so `GOOGLE_API_KEY` must be set and
expect non-deterministic wobble — these are regression canaries, not unit
tests.
"""
