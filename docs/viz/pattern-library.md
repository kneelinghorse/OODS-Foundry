# Chart Pattern Library

Mission **B22.6** establishes the authoritative catalog for OODS visualization
patterns. Each entry combines a schema blueprint, trait composition, and
confidence signal derived from the RDS.7 research corpus. Specs live under
`examples/viz/patterns-v2/` and are rendered inside Storybook at
`Visualization/Patterns/Library`.

## Quick Reference

| Pattern | Chart | Schema Blueprint | Confidence | Spec |
| --- | --- | --- | --- | --- |
| Grouped Bar | Bar | 1Q + 2N (category × comparison) | 0.93 (High) | `examples/viz/patterns-v2/grouped-bar.spec.json` |
| Stacked Bar | Bar | 1Q + 2N (part-to-whole) | 0.90 (High) | `examples/viz/patterns-v2/stacked-bar.spec.json` |
| 100% Stacked Bar | Bar | 1Q% + 2N (normalized mix) | 0.88 (High) | `examples/viz/patterns-v2/stacked-100-bar.spec.json` |
| Diverging Bar | Bar | 1Q (±) + 1N | 0.82 (Medium) | `examples/viz/patterns-v2/diverging-bar.spec.json` |
| Multi-series Line | Line | 1Q + 1T + 1N | 0.95 (High) | `examples/viz/patterns-v2/multi-series-line.spec.json` |
| Trend vs Target Band | Line | 3Q + 1T | 0.86 (Medium) | `examples/viz/patterns-v2/target-band-line.spec.json` |
| Running Total Area | Area | 1Q + 1T | 0.91 (High) | `examples/viz/patterns-v2/running-total-area.spec.json` |
| Bubble Distribution | Scatter | 3Q + 1N | 0.84 (Medium) | `examples/viz/patterns-v2/bubble-distribution.spec.json` |
| Correlation Scatter | Scatter | 2Q + 1N | 0.90 (High) | `examples/viz/patterns-v2/correlation-scatter.spec.json` |
| Time Grid Heatmap | Heatmap | 1Q + 2N | 0.92 (High) | `examples/viz/patterns-v2/time-grid-heatmap.spec.json` |
| Correlation Matrix | Heatmap | 1Q + 2N (symmetric) | 0.85 (Medium) | `examples/viz/patterns-v2/correlation-matrix.spec.json` |

## Patterns

### Grouped Bar (High confidence)
- **Schema**: 1 quantitative metric aggregated by a primary category and a
  comparison dimension (e.g., quarter × segment).
- **Traits**: `MarkBar`, `EncodingPositionX`, `EncodingPositionY`,
  `EncodingColor` (categorical palette) + optional highlight tooltip traits.
- **Best for**: showing relative changes across cohorts, pipeline coverage, OKR
  attainment by segment.
- **Avoid when**: comparison dimension exceeds five values or totals require a
  part-to-whole story (switch to stacked).
- **Spec**: `examples/viz/patterns-v2/grouped-bar.spec.json`

### Stacked Bar
- Highlights magnitude *and* composition by stacking categories inside each bar.
- Use for workload mixes, spend allocation, inventory breakdowns.
- Keep contributions ≤4 to prevent illegible stacks; label totals in tooltip.
- Spec: `examples/viz/patterns-v2/stacked-bar.spec.json`

### 100% Stacked Bar
- Normalizes stacks to 100% to emphasize mix shift and share-of-voice stories.
- Works best when audience cares about distribution more than absolute totals.
- Pair with sparkline (or table) when totals also matter.
- Spec: `examples/viz/patterns-v2/stacked-100-bar.spec.json`

### Diverging Bar
- Single dimension with positive/negative values centered on zero.
- Use semantic tokens for colors (`--sys-status-success/critical`).
- Annotate what “zero” represents (baseline, SLA, parity) in the narrative.
- Spec: `examples/viz/patterns-v2/diverging-bar.spec.json`

### Multi-series Line
- Time-series comparison for ≤4 cohorts; smoothing (`curve: monotone`) keeps
  telemetry readable.
- Provide hover highlight in Storybook to make a specific series stand out.
- Spec: `examples/viz/patterns-v2/multi-series-line.spec.json`

### Trend vs Target Band
- Combines `MarkArea` (lower/upper bound) with an overlay line for the actual
  metric. Communicates SLA compliance windows, forecast envelopes, or
  confidence bands.
- Requires data fields for `slaLow`/`slaHigh`; the CLI will flag missing
  multi-metric intents.
- Spec: `examples/viz/patterns-v2/target-band-line.spec.json`

### Running Total Area
- Filled single-series area for cumulative progress (burn-up/burn-down, ARR
  goals, adoption curves).
- Keep the baseline anchored to zero and narrate increments in the table
  fallback.
- Spec: `examples/viz/patterns-v2/running-total-area.spec.json`

### Bubble Distribution
- Quadrant prioritization chart. Encodes X/Y (impact vs effort) plus bubble
  area for audience size.
- Use sqrt size scale to avoid exaggeration; label only the top bubbles and let
  tooltips carry the rest.
- Spec: `examples/viz/patterns-v2/bubble-distribution.spec.json`

### Correlation Scatter
- Classic scatterplot for highlighting positive/negative correlations.
- Add quadrant annotations or regression overlays when needed; the spec already
  handles hover tooltips and color legends.
- Spec: `examples/viz/patterns-v2/correlation-scatter.spec.json`

### Time-grid Heatmap
- Two discrete axes (day × hour) with a linear color scale describing
  intensity. Great for staffing, reliability, utilisation.
- Keep palette within OKLCH guardrails and describe extremes in the narrative.
- Spec: `examples/viz/patterns-v2/time-grid-heatmap.spec.json`

### Correlation Matrix
- Symmetric heatmap for metric-to-metric relationships. Uses diverging palette
  anchored at 0.
- Works for up to ~10 metrics before requiring interactivity; document the top
  positive/negative values in text.
- Spec: `examples/viz/patterns-v2/correlation-matrix.spec.json`

## Storybook Gallery
Every pattern has a live render in Storybook under
`Visualization/Patterns/Library`. The MDX story drives each component (`BarChart`,
`LineChart`, `AreaChart`, `BubbleChart`, `ScatterChart`, `Heatmap`) with the
exact specs above plus accessibility fallbacks.

## CLI + Decision Tree
Use the schema-aware helper to choose a pattern from the command line:

```bash
pnpm viz:suggest "1Q+2N goal=comparison grouping=true"
```

The CLI calls `src/viz/patterns/suggest-chart.ts` to score each pattern against
measure/dimension counts, temporal fields, density, and part-to-whole intent.
See `docs/viz/chart-selection-guide.md` for the complete decision tree.
