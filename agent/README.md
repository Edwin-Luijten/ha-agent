# HA Agent — Home Assistant add-on

Action-taking conversation agent built on Google ADK (Gemini 2.5 Flash) with
live tool access to Home Assistant's entity registry, service catalog, and
state/history.

## Install

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store → ⋮ →
   Repositories** and add this git repository.
2. Install **HA Agent**.
3. Open **Configuration**, set `google_api_key`, review defaults, save.
4. Start the add-on. The first boot takes ~30s to load the MiniLM model; check
   the log for `registry refreshed`.
5. Install the companion integration: **Settings → Devices & services → Add
   integration → HA Agent**. Accept the default host/port.
6. In an Assist pipeline, select **HA Agent** as the conversation agent.

## UI

Open the add-on panel (robot icon in the sidebar) for a chat surface with
streaming tool-call badges and inline interactive components. The Activity
tab tails the audit log.

## Configuration

| Option | Default | Notes |
|---|---|---|
| `google_api_key` | _required_ | From Google AI Studio. |
| `model` | `gemini-flash-latest` | Any Gemini model ADK supports. |
| `language` | `nl` | System-prompt default language. |
| `rate_limit_per_min` | 20 | `call_service` cap per session. |
| `session_idle_minutes` | 30 | Reserved (session TTL not yet enforced). |
| `embedding_model` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Local embedding model for entity search. |
| `adults` | `[edwin, ilona]` | Names injected into the system prompt. |

## Safety

- Every `call_service` invocation is written to `/data/audit.jsonl` (viewable
  in the ingress UI's Activity tab).
- `alarm_control_panel.*`, `lock.*`, `homeassistant.*`, and `hassio.*`
  services require a **Yes** confirmation through the Confirmation UI
  component before execution.
- The agent has unrestricted service access otherwise — this is an
  intentional v1 decision.

## Development

Python backend:

```bash
cd agent
uv sync
uv run uvicorn ha_agent.main:create_app --factory --reload
```

Frontend:

```bash
cd agent/ui
pnpm install
pnpm run dev   # proxies /chat /audit /healthz to http://localhost:8000
```

Tests:

```bash
uv run pytest               # backend
pnpm test                   # UI
```

Lint:

```bash
uv run ruff check && uv run ruff format
```

## Gemini quota

Each user turn makes one Gemini request per tool call. A realistic
household query (_"zet muziek aan op edwin's spotify in de woonkamer"_)
typically uses 5–8 calls. The **free-tier Gemini API is capped at 5
requests/minute per model**, so even a single compositional query will
usually exhaust it. Options:

- **Paid Gemini tier** — Flash is ~$0.30 per 1M input tokens at the time of
  writing; trivially cheap for home-scale usage. Create a billing-enabled
  key at `https://aistudio.google.com/apikey`.
- **Vertex AI** — same models, project-level quotas.
- **Another model** — if a cheaper or more generous tier exists, change
  `model` in the add-on config.

Symptom of quota exhaustion: the agent answers _"De assistent zit
tijdelijk op de quota-limiet. Probeer het over een minuut opnieuw."_ and
the turn aborts mid-chain. The backend itself stays healthy; the audit
log records any partial `call_service` invocations that did land before
the limit hit.

## Troubleshooting

- **"De agent is niet beschikbaar"** — the custom_component can't reach the
  add-on. Check the add-on is running and the configured host matches the
  add-on slug (default: `ha_agent`).
- **"De assistent zit tijdelijk op de quota-limiet"** — Gemini rate limit
  (see above). Free tier is 5 req/min per model.
- **Slow first turn** — MiniLM warmup. Subsequent turns are fast.
- **Wrong entity picked** — adjust the entity's **friendly name** or **area**
  in HA to give the semantic index better signal.
- **`call_service` rate limit hit** — the default is 20 `call_service`
  calls per minute per session. Raise `rate_limit_per_min` in the add-on
  config if you need bulk operations.

## Deferred / v1.1

- 30-day rolling cleanup for `audit.jsonl` and 14-day for `/data/traces/` —
  manual cleanup for v1.
- Long-term / cross-session memory.
- Multi-agent / sub-agent delegation.
- HACS packaging.
- Evals / benchmark harness.
