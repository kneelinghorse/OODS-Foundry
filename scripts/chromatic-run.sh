#!/usr/bin/env bash
set -euo pipefail

# Run Chromatic, loading CHROMATIC_PROJECT_TOKEN from .env.local (repo root) or apps/explorer/.env.local fallback.
# Usage: scripts/chromatic-run.sh [chromatic CLI args]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ROOT_ENV_FILE=".env.local"
EXPLORER_ENV_FILE="apps/explorer/.env.local"

if [ -f "$ROOT_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_ENV_FILE"
  set +a
elif [ -f "$EXPLORER_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$EXPLORER_ENV_FILE"
  set +a
fi

if [ -z "${CHROMATIC_PROJECT_TOKEN:-}" ]; then
  echo "::error title=Missing CHROMATIC_PROJECT_TOKEN::Create .env.local with CHROMATIC_PROJECT_TOKEN=your_token" >&2
  echo "Example: echo 'CHROMATIC_PROJECT_TOKEN=chpt_xxx' > .env.local" >&2
  exit 1
fi

exec pnpm dlx chromatic "$@"
