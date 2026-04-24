#!/bin/sh
set -e

OPTIONS_FILE="${OPTIONS_FILE:-/data/options.json}"

if [ -f "$OPTIONS_FILE" ]; then
  set -a
  eval "$(python - <<'PY'
import json, os, shlex
with open(os.environ.get('OPTIONS_FILE', '/data/options.json')) as f:
    opts = json.load(f)
for key, value in opts.items():
    env_key = key.upper()
    if isinstance(value, (list, dict)):
        rendered = json.dumps(value)
    elif isinstance(value, bool):
        rendered = "true" if value else "false"
    else:
        rendered = str(value)
    print(f"export {env_key}={shlex.quote(rendered)}")
PY
)"
  set +a
fi

if [ -z "${GOOGLE_API_KEY:-}" ]; then
  echo "FATAL: google_api_key is not set. Open the add-on Configuration tab." >&2
  exit 1
fi

echo "Starting HA Agent on port 8000"
exec uvicorn ha_agent.main:create_app --factory --host 0.0.0.0 --port 8000
