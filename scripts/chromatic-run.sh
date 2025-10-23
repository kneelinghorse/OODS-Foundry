#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  echo "This script requires bash. Re-run as 'bash $0 …'." >&2
  exit 1
fi

# Run Chromatic, loading CHROMATIC_PROJECT_TOKEN from .env.local (repo root) or apps/explorer/.env.local fallback.
# Usage: scripts/chromatic-run.sh [chromatic CLI args]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ROOT_ENV_FILE=".env.local"
EXPLORER_ENV_FILE="apps/explorer/.env.local"
STATE_DIR="$ROOT_DIR/artifacts/state"

mkdir -p "$STATE_DIR"

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

SPLIT_BRANDS=1
ARGS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-brand-split)
      SPLIT_BRANDS=0
      shift
      ;;
    --brand-split)
      SPLIT_BRANDS=1
      shift
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

if [ "${OODS_CHROMATIC_SPLIT_BRANDS:-1}" = "0" ]; then
  SPLIT_BRANDS=0
fi

HAS_DIAGNOSTICS=0
HAS_LOG=0
HAS_SB_LOG=0
HAS_JSON=0
HAS_OUTPUT_FILE=0
HAS_DIAGNOSTICS_FLAG=0

if [ "${#ARGS[@]}" -gt 0 ]; then
  for ((i = 0; i < ${#ARGS[@]}; i++)); do
    arg="${ARGS[$i]}"
    case "$arg" in
      --diagnostics-file)
        HAS_DIAGNOSTICS=1
        i=$((i + 1))
        ;;
      --diagnostics-file=*|--no-diagnostics-file)
        HAS_DIAGNOSTICS=1
        ;;
      --log-file)
        HAS_LOG=1
        i=$((i + 1))
        ;;
      --log-file=*|--no-log-file)
        HAS_LOG=1
        ;;
      --storybook-log-file)
        HAS_SB_LOG=1
        i=$((i + 1))
        ;;
      --storybook-log-file=*|--no-storybook-log-file)
        HAS_SB_LOG=1
        ;;
      --json|--no-json)
        HAS_JSON=1
        ;;
      --output-file)
        HAS_OUTPUT_FILE=1
        i=$((i + 1))
        ;;
      --output-file=*|--no-output-file)
        HAS_OUTPUT_FILE=1
        ;;
      --diagnostics|--no-diagnostics)
        HAS_DIAGNOSTICS_FLAG=1
        ;;
    esac
  done
fi

if [ "$SPLIT_BRANDS" -eq 0 ]; then
  EXTRA_ARGS=()
  if [ "${#ARGS[@]}" -gt 0 ]; then
    EXTRA_ARGS+=("${ARGS[@]}")
  fi
  if [ "$HAS_JSON" -eq 0 ]; then
    EXTRA_ARGS+=(--json)
  fi
  if [ "$HAS_OUTPUT_FILE" -eq 0 ]; then
    EXTRA_ARGS+=(--output-file "$STATE_DIR/chromatic.json")
  fi
  if [ "$HAS_DIAGNOSTICS_FLAG" -eq 0 ]; then
    EXTRA_ARGS+=(--diagnostics)
  fi
  if [ "$HAS_DIAGNOSTICS" -eq 0 ]; then
    EXTRA_ARGS+=(--diagnostics-file "$STATE_DIR/chromatic-diagnostics.json")
  fi
  if [ "$HAS_LOG" -eq 0 ]; then
    EXTRA_ARGS+=(--log-file "$STATE_DIR/chromatic.log")
  fi
  if [ "$HAS_SB_LOG" -eq 0 ]; then
    EXTRA_ARGS+=(--storybook-log-file "$STATE_DIR/storybook-build.log")
  fi
  exec pnpm dlx chromatic "${EXTRA_ARGS[@]}"
fi

BRAND_SPEC="${OODS_CHROMATIC_BRANDS:-A,B}"
IFS=',' read -r -a BRAND_LIST <<< "$BRAND_SPEC"

BASELINE_ROOT="$ROOT_DIR/chromatic-baselines"
mkdir -p "$BASELINE_ROOT"

for raw_brand in "${BRAND_LIST[@]}"; do
  brand_trim="$(echo "$raw_brand" | tr -d '[:space:]')"
  if [ -z "$brand_trim" ]; then
    continue
  fi

  brand_upper="$(echo "$brand_trim" | tr '[:lower:]' '[:upper:]')"
  if [[ "$brand_upper" != "A" && "$brand_upper" != "B" ]]; then
    echo "Skipping unsupported brand token \"$brand_trim\"" >&2
    continue
  fi

  slug="$(echo "$brand_upper" | tr '[:upper:]' '[:lower:]')"
  brand_dir="$BASELINE_ROOT/brand-$slug"
  mkdir -p "$brand_dir"
  json_output="$STATE_DIR/chromatic-brand-$slug.json"

  EXTRA_ARGS=()
  if [ "${#ARGS[@]}" -gt 0 ]; then
    EXTRA_ARGS+=("${ARGS[@]}")
  fi
  if [ "$HAS_JSON" -eq 0 ]; then
    EXTRA_ARGS+=(--json)
  fi
  if [ "$HAS_OUTPUT_FILE" -eq 0 ]; then
    EXTRA_ARGS+=(--output-file "$json_output")
  fi
  if [ "$HAS_DIAGNOSTICS_FLAG" -eq 0 ]; then
    EXTRA_ARGS+=(--diagnostics)
  fi
  if [ "$HAS_DIAGNOSTICS" -eq 0 ]; then
    EXTRA_ARGS+=(--diagnostics-file "$brand_dir/chromatic-diagnostics.json")
  fi
  if [ "$HAS_LOG" -eq 0 ]; then
    EXTRA_ARGS+=(--log-file "$brand_dir/chromatic.log")
  fi
  if [ "$HAS_SB_LOG" -eq 0 ]; then
    EXTRA_ARGS+=(--storybook-log-file "$brand_dir/storybook-build.log")
  fi

  echo "▶︎ Running Chromatic for brand $brand_upper"
  STORYBOOK_BRAND="$brand_upper" pnpm dlx chromatic "${EXTRA_ARGS[@]}"
done

exit 0
