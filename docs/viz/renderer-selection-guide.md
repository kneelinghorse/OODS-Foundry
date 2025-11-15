# Renderer Selection Guide

The renderer selector (`src/viz/adapters/renderer-selector.ts`) centralizes when to render a normalized spec with **Vega-Lite** versus **ECharts**. This document pairs the selection heuristics with the performance evidence gathered in Mission B22.7.

---

## Decision Flow

1. **Explicit Preference**
   - User-specified `preferred` renderer in `RendererSelectionOptions` wins if it is part of the available pool.
   - Specs may also declare `portability.preferredRenderer`; this takes precedence when no user preference is provided.
2. **Data Volume Threshold**
   - Default threshold is **500 rows**. When a spec contains ≥500 data values and ECharts is available, the selector switches to ECharts.
   - Override via `minRowsForECharts` when a particular workflow tolerates larger Vega-Lite datasets.
3. **Temporal Bias**
   - Time-series specs (any encoding flagged as temporal) fall back to Vega-Lite when both renderers are eligible. This preserves Vega-Lite's tooling around time scales and annotations.
4. **Fallback & Validation**
   - If neither heuristic applies, the selector returns the first renderer in the normalized pool (`['vega-lite', 'echarts']` by default). Invalid pools throw `RendererSelectionError`.

---

## Performance-Informed Matrix

Results from `artifacts/performance/viz-benchmark-results.json` inform the practical thresholds.

| Chart Type | ≤100 pts | 100–999 pts | ≥1000 pts | Notes |
| --- | --- | --- | --- | --- |
| **Area/Line** | Vega-Lite | Vega-Lite | ECharts (line) / Vega-Lite (area) | Line charts cross the 500-row threshold earlier because highlight + tooltip interactions amplify Vega-Lite update cost. |
| **Bar** | Vega-Lite | Vega-Lite | ECharts | For dense histograms or stacked contributions, switch at ~800 rows to keep update latency under 50ms. |
| **Scatter** | ECharts | ECharts | ECharts | Interaction latency + dense tooltips heavily favor ECharts. Vega-Lite remains an accessible fallback when bundle budgets dominate. |
| **Heatmap** | Vega-Lite | Vega-Lite | Vega-Lite | Only jump to ECharts when matrices exceed roughly 10k cells or when live brushing is required. |

### Recommendations

- **Dashboards with hierarchical filtering** → Keep Vega-Lite as default to leverage its spec portability and smaller payloads. Only opt into ECharts for scatter/heatmap widgets that fetch raw event streams.
- **Analyst workbenches** → Start with ECharts when the UI can afford the larger bundle. Its hover/highlight stack is measurably more responsive for dense scatterplots and high-frequency updates.
- **Embed SDKs** → Honor `portability.preferredRenderer` so partners can ship a consistent renderer. When unspecified, use the selector with `minRowsForECharts` tuned to the partner’s bundle budget.

---

## Customizing `selectVizRenderer`

```ts
import { selectVizRenderer } from '@/viz/adapters/renderer-selector.js';

const { renderer, reason } = selectVizRenderer(spec, {
  available: ['vega-lite', 'echarts'],
  preferred: 'vega-lite',
  minRowsForECharts: 800,
});
```

- Adjust `available` to enforce environment-specific constraints (e.g., Storybook stories that should stay on Vega-Lite for Chromatic consistency).
- Use the returned `reason` (`'user-preference' | 'spec-preference' | 'data-volume' | 'temporal' | 'default'`) to annotate diagnostics or telemetry events.

---

## Pairing With Benchmarks

- Treat **`tools/perf/viz-budget.json`** as the contract for acceptable render/update/interaction latencies.
- When iterating on adapters, run `./scripts/perf/run-viz-benchmarks.mjs --charts <type>` to validate that any new heuristics actually improve the numbers in `artifacts/performance/viz-benchmark-results.json`.
- Feed the `recommendations` array from the artifact into onboarding docs so downstream teams can make renderer decisions without reading source code.
