# Visualization Performance Guide

Sprint 22 (Mission B22.7) introduced a reproducible benchmark suite that compares Vega-Lite and ECharts across chart families, interaction layers, and data sizes. This guide explains how to run the automation, interpret the metrics, and consume the resulting artifacts when planning renderer choices.

---

## Quick Start

```bash
# Full matrix (all chart types, renderers, and data sizes)
./scripts/perf/run-viz-benchmarks.mjs

# Focused subset
./scripts/perf/run-viz-benchmarks.mjs \
  --charts scatter,line \
  --renderers echarts \
  --dataPoints 1000,10000 \
  --output artifacts/performance/scatter-large.json
```

### CLI Flags

| Flag | Description |
| --- | --- |
| `--charts` | Comma-separated chart types (`bar,line,scatter,area,heatmap`). Defaults to all. |
| `--renderers` | Comma-separated renderer IDs (`vega-lite,echarts`). |
| `--dataPoints` | Comma-separated data sizes (`10,100,1000,10000`). |
| `--output` | Target JSON artifact path (default `artifacts/performance/viz-benchmark-results.json`). |
| `--no-strict` | Keep exit code `0` even if a budget is exceeded (useful for local triage). |

Each run writes a JSON artifact that contains raw measurements, budget checks, and the recommendation matrix. The script exits with code `2` whenever a metric exceeds its budget (unless `--no-strict` is provided), making it safe to wire into CI or pre-push hooks.

---

## Metrics & Budgets

Budgets are stored in [`tools/perf/viz-budget.json`](../../tools/perf/viz-budget.json) and include five dimensions:

| Metric | Description | Source |
| --- | --- | --- |
| `renderTimeMs` | Adapter time to convert a normalized spec into renderer payloads. | `node:perf_hooks` samples, lowest run. |
| `updateTimeMs` | Time to apply data refreshes & re-run adapter pipelines. | Mutated copies of each spec. |
| `interactionLatencyMs` | Highlight/tooltip binding latency. | ECharts uses stub runtime, Vega-Lite serializes predicates. |
| `memoryBytes` | UTF-8 byte length of adapter output (proxy for payload size). | `Buffer.byteLength(JSON.stringify(option))`. |
| `bundleImpactBytes` | Minified library footprint pulled from `node_modules`. | Static lookup (`vega-lite.min.js`, `echarts.min.js`). |

Budgets intentionally include generous headroom (4–5× observed values plus a constant) so that CI only fails on meaningful regressions. To update budgets:

1. Ensure `pnpm install` has been run (adapters rely on `vega-lite` and `echarts`).
2. Execute `./scripts/perf/run-viz-benchmarks.mjs` to produce the latest artifact in `artifacts/performance/viz-benchmark-results.json`.
3. If the new measurements warrant budget updates, regenerate `tools/perf/viz-budget.json` using the helper snippet in this guide or by re-running `runVizBenchmarks()` inside a REPL.
4. Commit both the updated budgets and the refreshed artifact so downstream consumers can review the delta.

---

## Latest Snapshot (Sprint 22)

The current artifact (generated at `artifacts/performance/viz-benchmark-results.json`) recommends the following renderer per chart type and data size. `VL` = Vega-Lite, `EC` = ECharts.

| Chart | 10 pts | 100 pts | 1k pts | 10k pts |
| --- | --- | --- | --- | --- |
| **Area** | VL | VL | VL | VL |
| **Bar** | VL | VL | EC | EC |
| **Line** | VL | VL | EC | VL |
| **Scatter** | EC | EC | EC | EC |
| **Heatmap** | VL | VL | VL | EC |

Additional highlights:

- **Scatter** is consistently faster on ECharts once highlighting/tooltips are enabled, even for small datasets. Vega-Lite is kept as a fallback for purely declarative specs when bundle size is constrained.
- **Bar** and **Line** charts benefit from Vega-Lite up to ~500 rows, then ECharts pulls ahead when raw point counts exceed the default threshold used by `selectVizRenderer`.
- **Heatmap** switches to ECharts only when matrices exceed ~10k cells; smaller grids stay in Vega-Lite to minimize bundle impact.

You can inspect the full recommendation payload under the `"recommendations"` array in the artifact, which also reports the delta (`advantageMs`) between the top two options per scenario.

---

## Deterministic Test Mode

Unit tests run the benchmark suite in a deterministic mode (`process.env.VIZ_BENCHMARK_MODE=deterministic`). In this mode the adapters still execute, but timing measurements are replaced with synthetic values derived from the data-point count. This keeps Vitest runs stable while CI/CLI executions continue to rely on real measurements.

If you need to troubleshoot deterministic values locally:

```bash
VIZ_BENCHMARK_MODE=deterministic ./scripts/perf/run-viz-benchmarks.mjs --charts bar --dataPoints 10
```

---

## CI Integration & Handoffs

- Add `./scripts/perf/run-viz-benchmarks.mjs` to `pipeline:push` or a dedicated GitHub Action to detect renderer regressions alongside accessibility and VRT checks.
- Attach the generated artifact to release notes so downstream teams can track how renderer performance evolves between sprints.
- Use the `artifacts/performance/viz-benchmark-results.json` output as the canonical handoff for Mission B22.8 (Sprint close) so reviewers can audit the comparison matrix without re-running the suite.
