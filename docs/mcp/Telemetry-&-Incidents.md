# MCP Telemetry & Incident Flow

## Overview

- Every MCP tool run now carries a single `correlationId` that threads through the CLI, bridge, server, transcripts, and diagnostics.
- Errors continue to emit a unique `incidentId`; the pair (`correlationId`, `incidentId`) is surfaced anywhere the run is rendered.
- Structured JSONL telemetry is appended to `artifacts/current-state/<date>/telemetry/mcp-server.jsonl` (server), `.../mcp-bridge.jsonl` (bridge), and `.../pipeline.jsonl` (pipelines & agent actions) using the schema in `configs/logging/telemetry.schema.json`.

## Correlation IDs

- CLI generates a `correlationId` per run and passes it to the server. The console output now prints the ID on success and folds it into error metadata.
- Storybook Agent Panel and the HTTP bridge bubble the ID into summaries and error cards. The bridge also returns it via the `x-correlation-id` header and response body (`telemetry.correlationId`).
- MCP transcripts (both server and CLI) embed the ID under `meta.telemetry.correlationId`, alongside any `incidentId` when present.

## Telemetry Logs

- Server emits `tool.run.started/completed/failed` events with durations, exit codes, policy codes, and counts of emitted artifacts. Logs are written to stderr and to the daily JSONL file.
- Bridge emits `bridge.run.started/completed/failed` events for every `/run` request, capturing approval status, HTTP responses, and correlation IDs.
- Pipeline and agent workflows run through `scripts/logging/instrument.ts`, which wraps commands, generates correlation IDs, and appends lifecycle events (start/complete) to `telemetry/pipeline.jsonl` with optional incident IDs on failure.
- Storybook Agent Panel queue instrumentation writes `panel.queue.enqueued/approved/denied/completed` events so diagnostics can summarise task throughput and denial reasons per mission.
- Diagnostics snapshot (`diag.snapshot`) reads the server log for the current day and writes an aggregated `telemetry` block into `diagnostics.json` summarising run counts, average/max duration, exit codes, and policy codes. Pipeline summaries are surfaced under `diagnostics.json.telemetry`.

## Pipeline & Agent Workflows

- Use `pnpm exec tsx scripts/logging/instrument.ts --mission <Bxx.x> --job <name> -- <command>` to instrument any pipeline step or agent automation.
- The helper guarantees directory creation under `artifacts/current-state/<date>/telemetry/` and writes JSON lines that validate against `configs/logging/telemetry.schema.json`.
- Soak runs (`tools/soak-runner`) now log the overall session plus per-tool invocations; each line includes `metadata.runId` to cross-link with reliability summaries and incident IDs.
- Downstream tooling can filter by `job`, `outcome`, or `correlationId` to reconstruct full execution timelines.

## Incident IDs

- Incident IDs remain unique per failure and are generated where the error originates (`TypedError.incidentId`).
- The bridge preserves the incident when normalising errors and the panel/CLI display it with the correlation ID for quick cross-referencing.

## Access Patterns

- To inspect a recent run, grab the correlation ID from the CLI or panel, then:
  - `rg <correlationId> artifacts/current-state/<date>/telemetry/mcp-server.jsonl` for detailed log trails.
  - Open the CLI or server transcript under `artifacts/current-state/<date>/<tool>/<stamp>/` and check `meta.telemetry`.
- For pipeline jobs, search `artifacts/current-state/<date>/telemetry/pipeline.jsonl` by `correlationId` or `metadata.runId` to locate the start/finish pair and any incidents.
- Diagnostics telemetry is available in the latest `diagnostics.json` as `telemetry`, keeping the daily roll-up under source control.
