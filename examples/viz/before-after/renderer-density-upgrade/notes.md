# Renderer Density Upgrade Notes

- **Before**: Vega-Lite handled the grouped bar but highlight latency spiked to 92 ms with 1.8k rows and three interaction layers.
- **After**: ECharts handles the density, brush interaction was dropped (unused) to save cycles, and we captured evidence in `artifacts/performance/renderer-density-upgrade.json`.
- **Guardrail evidence**: `./scripts/perf/run-viz-benchmarks.mjs --charts bar --renderers both --dataPoints 100,1000,5000`.
