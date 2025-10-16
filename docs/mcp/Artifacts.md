# Artifact Framework v1

The artifact framework standardizes outputs from agent/tool runs, enabling reproducible builds and lightweight verification.

- Base directory: `artifacts/current-state/YYYY-MM-DD/`
- Core files:
  - `transcript.json` — redaction-friendly record of inputs/outputs
  - `diagnostics.json` — consolidated run summary (≤10 files/day goal)
- `bundle_index.json` — manifest with `name`, `purpose`, `sizeBytes`, `sha256`, and optional `openUrl` per file

## Schemas

JSON Schemas ship with `@oods/artifacts` and validate all writes:
- `transcript.schema.json`: versioned intent record with `schemaVersion`, `source`, `command`, `tool`, structured `args`, execution metadata, artifact hashes, redaction audit, and a `signature` block.
- `diagnostics.schema.json`: pins `schemaVersion: "1.0"` and requires `sprint`, `runId`, `tool`, `createdAt`, and the summary blocks (`brandA`, `vrt`, `inventory`, `tokens`, `packages`).
- `bundle-index.schema.json`: pins `schemaVersion: "1.0"`, timestamps `generatedAt`, and requires `files[]` entries with `path`, `name`, `sha256`, optional `purpose`, `sizeBytes`, and `openUrl`.

## Writer API

- `todayDir(base?)` → ensures `YYYY-MM-DD` directory
- `writeTranscript(dir, doc)` → canonicalises, signs, validates, and writes `transcript.json`
- `writeDiagnostics(dir, doc)` → auto-stamps `createdAt`, enforces schema, writes `diagnostics.json`
- `writeBundleIndex(dir, entries)` → normalises descriptors (strings or `{ path, purpose, sizeBytes, openUrl }`), hashes files, and writes `bundle_index.json`

## Verify API

- `validateTranscriptFile(path)` → schema validation + signature verification
- `readTranscriptFile(path)` → load + verify signed transcript payload
- `validateDiagnosticsFile(path)` → Ajv validation
- `validateBundleIndexFile(path)` → Ajv validation
- `verifyBundleIndexIntegrity(dir, bundleIndexPath)` → re-hash check

## Guidance

- Keep per-day artifacts ≤10 files by writing each run under a dated/tooled subdirectory.
- Only write within `artifacts/current-state/*`.
- Include `transcript.json` in every bundle; reference it in `bundle_index.json` alongside any diagnostics or generated assets.
