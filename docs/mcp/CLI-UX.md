# OODS Agent CLI

The OODS Agent CLI gives maintainers a local harness for running MCP tools with the same guardrails as the sandbox server. It wraps the stdio MCP server, produces signed transcripts (using the artifact framework), and enforces a plan → approve → execute flow with replay support.

## Quick start

```bash
# Dry-run a tool (no writes)
pnpm exec tsx tools/oods-agent-cli/src/index.ts plan tokens.build '{"theme":"dark"}'

# Apply writes (requires explicit approval)
pnpm exec tsx tools/oods-agent-cli/src/index.ts apply tokens.build '{"theme":"dark"}' --approve

# Replay a previous transcript
pnpm exec tsx tools/oods-agent-cli/src/index.ts replay artifacts/current-state/<date>/cli/tokens.build/<timestamp>-apply/transcript.json --approve
```

The script uses the built MCP server at `packages/mcp-server/dist/index.js`. Run `pnpm --filter @oods/mcp-server build` if the dist output is missing.

## Commands

- `plan <tool> [jsonArgs] [--role <role>]`  
  Spawns the MCP server in DRY-RUN (`apply=false`), prints bundle/transcript locations, and emits a signed CLI transcript under `artifacts/current-state/<date>/cli/<tool>/`.

- `apply <tool> [jsonArgs] --approve [--role <role>]`  
  Requires `--approve` before forwarding the request with `apply=true`. On success, lists all artifacts written and records the signed transcript/bundle pair.

- `replay <transcriptPath> [--approve] [--role <role>]`  
  Verifies the transcript signature, re-hashes declared input artifacts, and runs a fresh plan preview. If the original run applied writes, the apply step is re-issued only when `--approve` is supplied. Every replay produces a new signed CLI transcript that references the source transcript as an input artifact.

JSON arguments can be provided inline (`'{"key":"value"}'`) or via file reference (`@path/to/payload.json`).

## Outputs

Each invocation produces:

- The server’s own `transcript.json` and `bundle_index.json` inside `artifacts/current-state/<date>/<tool>/`.
- A CLI transcript (`cli.<command>`) plus `summary.json`, with a `bundle_index.json` that signs both files. These records capture role, arguments, result paths, and replay provenance.

Policy failures (role denial, validation errors, rate limits) exit with status code `2`; usage mistakes exit with `1`. Successful runs exit `0`.

## Roles and approvals

- `--role <role>` sets the MCP role for the request (defaults to `designer` via server policy).
- `--approve` is mandatory for any action that would write artifacts, including replays of previous apply runs.

## Future hooks

The CLI is intentionally minimal: it does not yet stream tool output or diff artifact contents. The transcript format leaves room for richer previews and for integrating with the Storybook Agent panel once write flows are enabled.
