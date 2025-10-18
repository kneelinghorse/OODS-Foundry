# Policy UX & Error Mapping

## Taxonomy
- `POLICY_DENIED`: tool not allowlisted for the role, approval token missing, or bridge-forbidden action.
- `APPROVAL_DENIED`: approval header matched a `tokens.denied` value (e.g. `"denied"`); show next steps.
- `INVALID_APPROVAL_TOKEN`: approval header supplied but not recognised; prompt for `tokens.granted`.
- `APPLY_FORBIDDEN`: tool only supports dry-run mode.
- `TIMEOUT`: MCP server did not respond before the bridge timeout.
- `RATE_LIMITED`: bridge or policy throttled the request rate.
- `VALIDATION_ERROR`: request failed schema/format/content-type validation.

## Dry-run → Apply Flow
- `scripts/agent/approval.ts --tool <name>` performs a dry run first and prints the preview/artifact set with an incident ID.
- Re-run with `--apply` to request execution; the helper automatically sends `X-Bridge-Approval: granted` (or a custom `--approval value`).
- Policy denials include `docs/mcp/Policy-UX.md` in the payload so panels/CLI can link directly to remediation guidance.

## Panel Messaging
- Storybook panel renders severity-aware notices sourced from `i18n/errors.json`, including friendly copy for the new approval codes.
- Metadata (code, HTTP status, incident ID) is surfaced inline; focus lands on the error heading.
- Structured guidance nudges designers to gather approval or adjust payloads without exposing sensitive detail.
- Task queue badges expose policy state transitions (`Queued` → `WaitingApproval` → `Running` → `Done`/`Denied`) and link the most recent `incidentId` or diagnostics entry for replay.

## CLI Behaviour
- `@oods/agent-cli` and `scripts/agent/approval.ts` share the taxonomy above; both echo incident IDs and docs hints to stderr.
- Exit codes: `0` success, `1` validation/usage issues, `2` policy, timeout, or rate limits.
- CLI output now highlights the shared `correlationId` alongside `incidentId` so downstream log scrapes and diagnostics align.

## Incident IDs & Correlation
- MCP server attaches a UUID incident id to errors; the bridge now adds one for every success as well.
- A second `correlationId` spans dry-run and apply pairs; panels, CLI transcripts, diagnostics, and soak reports use both identifiers to stitch timelines together.
