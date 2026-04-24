# HA Agent

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://hacs.xyz/)
[![Add-on version](https://img.shields.io/badge/add--on-v0.1.0-0091EA.svg?style=flat-square&logo=home-assistant&logoColor=white)](./agent/config.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square)](./LICENSE)

[![Open your Home Assistant instance and add this repository to HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Edwin-Luijten&repository=ha-agent&category=integration)
[![Open your Home Assistant instance and add this add-on repository.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FEdwin-Luijten%2Fha-agent)

A Home Assistant conversation agent built on Google's ADK + Gemini.
Resolves compositional Dutch / English queries the built-in Assist
can't, and renders inline UI (lights, media, weather, confirmations)
in its replies.

> "speel jazz af in de woonkamer" → picks the right `media_player`,
> calls `play_media`, renders a now-playing widget.

## Install

1. **Add-on repository** — Settings → Add-ons → Store → ⋮ →
   Repositories → add this repo, then install **HA Agent**.
2. **Configure** the add-on: set `google_api_key`
   ([get one](https://aistudio.google.com/apikey)), optionally
   `language` and `adults`. Start it.
3. **Integration** — HACS → ⋮ → Custom repositories → add this repo
   as *Integration* → install → restart HA → Settings →
   Devices & Services → Add Integration → **HA Agent**
   (host `ha_agent`, port `8000`).
4. **Wire to voice** — Settings → Voice Assistants → pick **HA Agent**
   as the conversation agent.

## Safety

Unrestricted `call_service` access by design. Every call is audited to
`/data/audit.jsonl`, rate-limited to 20/min per session, and
alarm/lock/homeassistant/hassio domains require an in-chat
confirmation. Tighten via `CONFIRMATION_DOMAINS` in
[`agent/src/ha_agent/agent/instruction.py`](./agent/src/ha_agent/agent/instruction.py).

## Development

```bash
cd agent && uv sync
cp .env.local.example .env.local   # fill in tokens
uv run uvicorn ha_agent.main:create_app --factory --reload

cd agent/ui && pnpm install && pnpm run dev
```

Tests: `uv run pytest` (backend), `pnpm test` (UI).  
See [`agent/README.md`](./agent/README.md) for internals.
