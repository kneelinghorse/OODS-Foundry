# Reliability Soak Testing

This guide documents the MCP reliability harness delivered in Sprint 13 Mission B13.7 and the telemetry expansion in Sprint 14 Mission B14.7. It covers the soak runner, how to execute it against the local bridge, and how to interpret the resulting telemetry and SLO metrics.

## Scope

- Exercises read-only MCP tools `a11y.scan`, `purity.audit`, `vrt.run`, and `diag.snapshot`.
- Includes one gated write cycle for `brand.apply` (24 dry runs + 1 approved apply).
- Collects duration, exit codes, rate-limit policy codes, retry attempts, and incident IDs for each invocation.
- Emits `artifacts/current-state/YYYY-MM-DD/soak-report.md` (markdown roll-up) and updates `artifacts/current-state/YYYY-MM-DD/diagnostics.json.reliability` plus `diagnostics.json.telemetry`.

## Prerequisites

1. Build the MCP server and bridge:
   ```bash
   pnpm --filter @oods/mcp-server build
   pnpm --filter @oods/mcp-bridge build
   ```
2. Start the bridge (spawns the stdio MCP server under the hood):
   ```bash
   pnpm --filter @oods/mcp-bridge start
   ```
3. Ensure the bridge is reachable at `http://127.0.0.1:4466`. Override via `BRIDGE_URL` if needed.

## Running the Soak Harness

Execute the runner via `pnpm`:

```bash
pnpm --filter @oods/soak-runner run run
```

Environment overrides (optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SOAK_RUNS_PER_TOOL` | `25` | Number of invocations per tool. |
| `SOAK_BACKOFF_MS` | `250` | Base backoff for retries (exponential with jitter). |
| `SOAK_MAX_RETRIES` | `3` | Retry attempts for transient failures (429 / 503 / timeouts). |
| `SOAK_GLOBAL_RATE_LIMIT_MS` | `2500` | Minimum spacing between any two bridge calls (aligns with `/run` 30 req/min). |
| `BRIDGE_URL` | `http://127.0.0.1:4466` | Bridge origin. |
| `BRIDGE_TOKEN` | _(unset)_ | Optional token if bridge auth is enabled. |
| `BRIDGE_APPROVAL` | `granted` | Approval header for the single `brand.apply` write run. |

The runner enforces per-tool pacing drawn from policy (`diag.snapshot` & `brand.apply` respect 12 req/min, others default to slower than bridge globals) and surfaces rate-limit or timeout incidents in-line.

## Outputs

- `artifacts/current-state/YYYY-MM-DD/soak-report.md`
  - Markdown summary with mission id, configuration, aggregated totals, and per-tool SLO metrics. Each row links back to telemetry via `metadata.runId`.
  - Serves as the authoritative log for reliability analysis and trending while keeping artifacts human-readable.
- `artifacts/current-state/YYYY-MM-DD/diagnostics.json`
  - `reliability` section appended with the latest mission id, timestamp, soak report reference, and SLO summaries (total, pass, fail, flake%, p95, p99).
  - `telemetry` section captures the correlation ID for the overall soak session plus per-tool run counts derived from `telemetry/pipeline.jsonl`.

Both paths are relative to the repository root and stay within the existing evidence budget (≤ 10 files/day).

## Latest Baseline (2025-10-16)

| Tool | Runs | Pass | Fail | Flake % | p95 (ms) | p99 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `a11y.scan` | 25 | 25 | 0 | 0.00 | 11 | 19 |
| `purity.audit` | 25 | 25 | 0 | 0.00 | 8 | 9 |
| `vrt.run` | 25 | 25 | 0 | 0.00 | 8 | 9 |
| `diag.snapshot` | 25 | 25 | 0 | 0.00 | 13 | 16 |
| `brand.apply` *(1 apply)* | 25 | 25 | 0 | 0.00 | 10 | 684† |

† `p99` captures the gated apply path (≈ 0.7 s) while dry runs remain sub‑10 ms.

## Operational Notes

- Retries are limited to rate-limit, timeout, or transport issues. Persistent policy denials terminate immediately to avoid masking configuration errors.
- Jittered backoff, combined with the global 2.5 s floor, eliminates cascading 429s observed in earlier drafts.
- `soak-report.md` pairs with the JSONL telemetry (`telemetry/pipeline.jsonl`); each row’s `metadata.runId` matches the correlation lines emitted by the logging helper.
- The reliability summary is intentionally concise so diagnostics stays lightweight; for deeper analysis use the full soak report.

## Next Steps

- Feed soak metrics into the planned observability mission (B13.8/B14.7) to attach incident IDs and bridge/pipeline telemetry.
- Extend the runner to cover connector tools once approved writes are available for remote MCP flows.
