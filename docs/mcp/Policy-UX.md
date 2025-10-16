# Policy UX & Error Mapping

## Taxonomy
- `POLICY_DENIED`: tool not allowed for the role, missing approval token, or bridge forbids the action.
- `TIMEOUT`: MCP server did not respond before the bridge timeout.
- `RATE_LIMITED`: bridge or policy throttled the request rate.
- `VALIDATION_ERROR`: request failed schema/format/content-type validation.

## Panel Messaging
- Storybook panel renders a severity-aware error notice sourced from `i18n/errors.json`.
- Metadata (code, HTTP status, incident ID) is surfaced inline; focus lands on the error heading.
- Structured guidance nudges designers to gather approval or adjust payloads without exposing sensitive detail.

## CLI Behaviour
- `@oods/agent-cli` maps errors with the same taxonomy and emits human-readable guidance.
- Exit codes: `0` success, `1` validation/usage issues, `2` policy, timeout, or rate limits.
- Incident IDs and normalized codes are echoed to stderr for follow-up.

## Incident IDs
- MCP server attaches a UUID incident id to every error; bridge preserves or generates one.
- Panels, CLI transcripts, and bridge responses share the same identifier for cross-surface debugging.
