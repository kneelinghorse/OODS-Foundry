#!/usr/bin/env bash
set -euo pipefail

# Run Chromatic, loading CHROMATIC_PROJECT_TOKEN from app/.env.local if present.
# Usage: scripts/chromatic-run.sh [chromatic CLI args]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.local"
if [ -f "$ENV_FILE" ]; then
  # Export variables defined in .env.local into the environment
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ -z "${CHROMATIC_PROJECT_TOKEN:-}" ]; then
  echo "::error title=Missing CHROMATIC_PROJECT_TOKEN::Create app/.env.local with CHROMATIC_PROJECT_TOKEN=your_token" >&2
  echo "Example: echo 'CHROMATIC_PROJECT_TOKEN=chpt_xxx' > app/.env.local" >&2
  exit 1
fi

exec pnpm dlx chromatic "$@"
