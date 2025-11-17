# Performance Optimization Checklist

This checklist codifies the renderer and layout performance lessons from Sprints 22 and 23. Use it whenever you create or modify visualization specs so performance conversations remain evidence-based.

## Pre-flight Checklist

1. **Define budgets** - confirm the target latency numbers from `tools/perf/viz-budget.json` apply to your scenario (render time, update time, interaction latency, payload size, bundle impact).
2. **Shape the dataset** - pre-aggregate when possible, and trim fields that do not show up in encodings or narratives. Aim for <=20 columns and <=10k rows before paging.
3. **Pick a renderer intentionally** - start with Vega-Lite for low-density specs. Switch to ECharts when any of the following is true:
   - Highlight/tooltip latency exceeds 50 ms.
   - Data rows >500 for bar/line, >5k for scatter, or matrix cells >10k.
   - You need zoom/brush interactions that the Vega-Lite runtime cannot express.
4. **Plan for interaction cost** - each interaction trait adds DOM/event work. Keep the stack to highlight + tooltip for simple charts, and layer filter/brush only when the story requires discovery workflows.
5. **Model layouts with intent** - facets duplicate datasets; concat duplicates component shells. Store derived datasets in the adapter rather than re-fetching them inside components.
6. **Record proof** - every renderer switch or budget change must include a JSON artifact from `./scripts/perf/run-viz-benchmarks.mjs` under `artifacts/performance/`.

## Bottleneck Playbook

| Symptom | Root Cause | Fix | Validation |
| --- | --- | --- | --- |
| Adapter time spikes (>5 ms) | Layout trait triggering redundant transformations | Reuse normalized spec fragments and share cloned datasets; profile with `node --trace-opt` if custom transforms exist. | `pnpm test --filter=viz --runInBand` to capture deterministic timings. |
| Interaction latency > 65 ms | Vega-Lite tooltip/highlight signals on large datasets | Switch to ECharts or reduce mark count via sampling. Configure `interactionPropagation` only when hover sync is required. | Benchmark scenario with `--renderers both --interactions highlight,tooltip`. |
| Memory/payload bloat | Inline datasets inside layout sections without filters | Apply filters before layout mapping, or move to dataset references + transforms. Avoid spreading entire data arrays across each facet. | Inspect adapter output size in artifacts; target <200 KB per dashboard. |
| Bundle impact warnings | Loading both Vega-Lite and ECharts unnecessarily | Run the renderer selector (`selectVizRenderer`) so components lazy-load only the winning adapter. Document why both are required if you override it. | CI budgets catch >25% regressions; attach diff to PR. |
| Jank when resizing | Layout recalculations happening during React render | Use `useLayoutEffect` + `ResizeObserver` inside `<VizContainer>` (already implemented) and keep expensive calculations (binning, aggregation) outside render. | `pnpm vrt:layouts` for responsive coverage + browser profiling when needed. |

## Renderer Threshold Reference

| Chart | Default Renderer | Switch When | Evidence |
| --- | --- | --- | --- |
| Bar / Column | Vega-Lite | Rows > 500 or highlight latency > 60 ms | Sprint 22 benchmark scenario `bar-large`. |
| Line / Area | Vega-Lite | Rows > 500 per series or stacked interactions on | Scenario `line-multi-series`. |
| Scatter / Bubble | ECharts | Default; switch to Vega-Lite only for <=200 points with no interactions | Scenario `scatter-low-density`. |
| Heatmap / Matrix | Vega-Lite | Cells > 10k or custom brush interactions requested | Scenario `heatmap-wide`. |
| Layered banded charts | ECharts | Always (band layering uses runtime hooks) | Scenario `trend-target-band`. |

## Workflow Integration

1. Run the targeted benchmark suite locally whenever you change renderer logic or add a layout with >4 panels:

```bash
./scripts/perf/run-viz-benchmarks.mjs --charts line,bar --renderers both --dataPoints 100,1000
```

2. Capture the JSON artifact under `artifacts/performance/` and reference it in docs or PRs.
3. Update `tools/perf/viz-budget.json` only after two consecutive benchmark runs confirm the new baseline.
4. Add a short summary to `docs/viz/best-practices.md` or mission notes so downstream teams inherit the rationale.

Following this loop keeps renderer debates grounded in data and prevents regressions from sneaking past CI.
