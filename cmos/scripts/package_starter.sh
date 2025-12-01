#!/usr/bin/env bash
# Packages cmos/ directory contents into a distributable tarball.
# Run from anywhere: ./cmos/scripts/package_starter.sh
set -euo pipefail

# Find cmos/ directory (script is in cmos/scripts/)
CMOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${CMOS_DIR}/dist"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARCHIVE_NAME="cmos-starter-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"

mkdir -p "${DIST_DIR}"

EXCLUDES=(
  "--exclude=dist"
  "--exclude=.git"
  "--exclude=.gitignore"
  "--exclude=SESSIONS.jsonl"
  "--exclude=*.log"
  "--exclude=telemetry/events/*.tmp"
  "--exclude=telemetry/archive"
  "--exclude=PHASE1_INVENTORY.md"
)

cd "${CMOS_DIR}"
tar -czf "${ARCHIVE_PATH}" "${EXCLUDES[@]}" \
  AGENTS.md \
  cli.py \
  README.md \
  context \
  db \
  docs \
  foundational-docs \
  missions \
  PROJECT_CONTEXT.json \
  runtime \
  scripts \
  templates \
  telemetry \
  tests \
  workers

echo "Starter package created at ${ARCHIVE_PATH}"
