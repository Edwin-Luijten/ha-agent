# syntax=docker/dockerfile:1.7

# --- UI build stage ---
FROM node:24-alpine AS ui-build
WORKDIR /ui
RUN corepack enable
COPY ui/package.json ui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ui/ ./
RUN pnpm run build

# --- Python build stage ---
FROM ghcr.io/astral-sh/uv:0.11-python3.12-bookworm-slim AS py-build
ENV UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --compile-bytecode

# Pre-warm the HuggingFace model cache into the image.
ENV HF_HOME=/opt/hf-cache
RUN uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

# --- Final runtime stage ---
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/hf-cache \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=py-build /app/.venv /app/.venv
COPY --from=py-build /opt/hf-cache /opt/hf-cache
COPY --from=py-build /app/src /app/src
COPY --from=ui-build /ui/dist /app/ui/dist
COPY run.sh /run.sh
RUN chmod +x /run.sh
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/run.sh"]
