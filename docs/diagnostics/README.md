# Diagnostics & Performance Baselines

Design system diagnostics rely on a single set of state artifacts and helper metrics. This guide explains the refreshed performance budgets, how to regenerate evidence, and where guardrail outputs live for reviewer handoff.

## Performance budgets

- **Compositor updates:** React `actualDuration` <= **7 ms** (p95 currently 0.7 ms). Source snapshots live in `diagnostics/perf-results.json` with the summary in `artifacts/state/performance.json`.
- **List & table demo:** React `actualDuration` <= **150 ms** (p95 currently 14 ms). Filter/tabs scenarios share the same budget and surface under the `List.*` entries.
- **Token transforms:** User Timing `duration` <= **3000 ms** (p95 currently 30.5 ms). This budget covers brand/theme toggles and multi-token resolution.

> Note: React `commitTime` remains noisy during harness runs because the profiler keeps instrumentation costs; we track `actualDuration` / User Timing metrics instead so reviewers see the actionable work units.

## Regenerating performance evidence

1. Build and serve Storybook: `pnpm run build-storybook` then `pnpm dlx serve storybook-static -l 6006` (or run `pnpm perf:harness:ci` which automates both).
2. Capture snapshots: `pnpm perf:harness --scenario all --output diagnostics/perf-results.json`.
3. Update state artifacts: `node scripts/state-assessment.mjs --performance` (or `--all` to refresh every check). This writes `artifacts/state/performance.json` and updates the `diagnostics.helpers.performance` history.
4. Commit refreshed artifacts alongside any new baseline diffs so reviewers have a reproducible trace.

## Guardrails & tokens snapshots

- Metadata and tenancy guardrails surface via `artifacts/state/guardrails.json` and flow into `diagnostics.helpers.guardrails`.
- Token governance diffs (brands A & B) land under `artifacts/state/governance/` with summaries in `diagnostics.tokens.governance`.
- The state assessment ties these outputs together; running `node scripts/state-assessment.mjs --guardrails --tokens` replays just the guardrail suite when you do not need the full diagnostics pass.

## Troubleshooting

- **Harness timeouts:** ensure the served Storybook includes `performance-*-harness` stories; rerun `pnpm run build-storybook` if you see `No story files found` warnings.
- **Skewed metrics:** clear `diagnostics/perf-results.json` before re-running if you suspect stale values; the assessment writes new history entries each time.
- **Missing artifacts:** delete `artifacts/state/performance.json` and rerun the assessment to regenerate it with the latest helper outputs.
