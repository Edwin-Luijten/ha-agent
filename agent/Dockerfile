# syntax=docker/dockerfile:1
# HA Agent Add-on
# Multi-stage build: node for UI, uv for dependency resolution, slim Python for runtime
# Python 3.13 - Security support until 2029-10

FROM node:24-alpine AS ui-build
WORKDIR /ui
RUN corepack enable
COPY ui/package.json ui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ui/ ./
RUN pnpm run build

FROM ghcr.io/astral-sh/uv:0.11.0-python3.13-trixie-slim@sha256:5b216b72b3bc10f983f82b39b5386455bfa08d2139afb4cb3f6c9f060484ea5d AS builder

WORKDIR /app

# Compile bytecode for faster startup; copy mode required with cache mounts
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

# Install dependencies first (cached separately from source changes)
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-dev

# Copy source and install the project itself
COPY src/ ./src/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

# Pre-warm the HuggingFace model cache into the image.
ENV HF_HOME=/opt/hf-cache
RUN uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

FROM python:3.13-slim@sha256:3de9a8d7aedbb7984dc18f2dff178a7850f16c1ae7c34ba9d7ecc23d0755e35f

WORKDIR /app

# Copy the virtual environment, source, UI build, and HF cache from builder stages
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /opt/hf-cache /opt/hf-cache
COPY --from=ui-build /ui/dist /app/ui/dist
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Activate virtual environment via PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    HF_HOME=/opt/hf-cache

# Labels
ARG BUILD_VERSION
ARG BUILD_ARCH
LABEL \
    io.hass.name="HA Agent" \
    io.hass.description="Gemini-backed action-taking agent for Home Assistant" \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.type="addon" \
    io.hass.arch="${BUILD_ARCH}"

CMD ["/run.sh"]
