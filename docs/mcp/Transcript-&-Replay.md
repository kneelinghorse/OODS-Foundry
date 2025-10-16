# Transcript & Replay

## Transcript Schema v1.0

Every run emits `transcript.json` that follows the `TRANSCRIPT_SCHEMA_VERSION` of **1.0**. Key fields:

- `schemaVersion` — semantic schema identifier.
- `source` — `cli`, `panel`, or `mcp-server`.
- `command` — `plan` or `apply` representing the user action.
- `tool` — tool name executed (e.g., `tokens.build`).
- `args.payload` — sanitized input arguments with `apply` stripped.
- `args.apply` — whether the originating run executed writes.
- `args.options` — approval/role metadata captured at execution time.
- `user` / `hostname` — execution origin metadata.
- `startTime` / `endTime` — ISO timestamps bounding the run.
- `exitCode` — process exit code (`0` on success).
- `artifacts[]` — relative path + `sha256` hash for each referenced artifact, tagged as `input` or `output`.
- `redactions[]` — audit trail for configured replacements (`configured_string` / `configured_path`).
- `signature` — `{ algo: "sha256", hash }` signing the canonical subset.

The canonical subset that feeds the signature includes `schemaVersion`, `tool`, `args`, `user`, `startTime`, and each artifact's `path`/`sha256`. Any mutation to intent, actor, or recorded artifacts invalidates the hash.

## Signing & Verification

`packages/artifacts` provides the signing surface:

- `finalizeTranscript` canonicalises the draft and signs with SHA-256.
- `writeTranscript` validates the schema, applies signing, and persists JSON.
- `readTranscriptFile` validates + verifies signatures when loading from disk.

Canonicalisation follows RFC 8785 (JCS): objects are deep-sorted, whitespace removed, and primitives stringified deterministically before hashing. Replay flows refuse transcripts whose hash does not match the canonical subset.

## CLI Replay Workflow

`oods replay <transcriptPath> [--approve] [--role <role>]` now performs:

1. Validate schema + signature via `readTranscriptFile`.
2. Recompute hashes for declared `input` artifacts; missing or mismatched inputs block replay.
3. Display warnings for missing `output` artifacts.
4. Run a fresh `plan` preview with the recorded payload.
5. If the original run applied changes, a second `apply` pass is only triggered when `--approve` is present.

Each replay is logged as a new CLI transcript (`source: "cli"`) referencing the replayed transcript as an `input` artifact. Bundle indices and summaries are also regenerated.

## MCP Server Transcripts

Server tools now emit signed transcripts through the shared artifacts writer. Payloads are sanitised against configured redaction tokens, artifacts are hashed, and intent metadata matches the CLI schema. Resulting docs live beside the tool artifacts and feed Storybook/bridge consumers.

## Panel Replay Entry Point

The Storybook Agent panel exposes a "Replay this run" action in the summary view. Selecting it:

1. Fetches the transcript via the bridge and parses the schema v1.0 payload.
2. Automatically loads the recorded inputs, runs a new preview, and announces replay intent.
3. Requires the user to use the existing approval flow to apply writes; previews remain read-only without approval.

Replay state is announced to assistive tech and the Apply button remains gated behind the standard approval dialog.
