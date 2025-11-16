# Responsive Pattern Library v2

Mission **B23.6** expands the OODS pattern catalog from 11 atomic entries to 20 responsive-first compositions. Every pattern now ships with:

- **Spec artifacts** under `examples/viz/patterns-v2/*.spec.json`
- **Storybook coverage** via `Visualization/Patterns/Responsive Library`
- **Responsive guidance** produced by `scoreResponsiveStrategies()`
- **CLI support** – `pnpm viz:suggest` evaluates the v2 registry

Use this document as the single source of truth for pattern intents, responsive breakpoints, and authoring guardrails.

## Catalog Overview

| Pattern | Chart | Layout DNA | Primary Interactions | Spec |
| --- | --- | --- | --- | --- |
| Grouped Bar | Bar | Single + grouped | Hover highlight | `examples/viz/patterns-v2/grouped-bar.spec.json` |
| Stacked Bar | Bar | Stack | Tooltip totals | `examples/viz/patterns-v2/stacked-bar.spec.json` |
| 100% Stacked Bar | Bar | Stack normalize | Tooltip share | `examples/viz/patterns-v2/stacked-100-bar.spec.json` |
| Diverging Bar | Bar | Single | Tooltip delta | `examples/viz/patterns-v2/diverging-bar.spec.json` |
| Multi-series Line | Line | Layer | Hover highlight | `examples/viz/patterns-v2/multi-series-line.spec.json` |
| Target Band Line | Line | Layer | Hover target gap | `examples/viz/patterns-v2/target-band-line.spec.json` |
| Running Total Area | Area | Single | Tooltip cum. value | `examples/viz/patterns-v2/running-total-area.spec.json` |
| Bubble Distribution | Scatter | Single | Brush/filter | `examples/viz/patterns-v2/bubble-distribution.spec.json` |
| Correlation Scatter | Scatter | Single | Hover detail | `examples/viz/patterns-v2/correlation-scatter.spec.json` |
| Time Grid Heatmap | Heatmap | Grid | Hover cell | `examples/viz/patterns-v2/time-grid-heatmap.spec.json` |
| Correlation Matrix | Heatmap | Grid symmetric | Hover cell | `examples/viz/patterns-v2/correlation-matrix.spec.json` |
| Facet Small Multiples Line | Line | Facet grid | Click region focus | `examples/viz/patterns-v2/facet-small-multiples-line.spec.json` |
| Layered Actual vs Target | Area + Line | Layer | Tooltip deltas | `examples/viz/patterns-v2/layered-line-area.spec.json` |
| Stacked Channel Projection | Area | Layer + stack | Hover channel | `examples/viz/patterns-v2/stacked-area-projection.spec.json` |
| Linked Brush Scatter | Scatter | Single | Interval brush | `examples/viz/patterns-v2/linked-brush-scatter.spec.json` |
| Focus + Context Line | Line | Vertical concat | Hover sync | `examples/viz/patterns-v2/focus-context-line.spec.json` |
| Detail-overview Bar | Bar | Horizontal concat | Click drill | `examples/viz/patterns-v2/detail-overview-bar.spec.json` |
| Sparkline Grid | Line | Facet grid | Hover tooltip | `examples/viz/patterns-v2/sparkline-grid.spec.json` |
| Facet Target Band | Line + Area | Facet grid | Hover band delta | `examples/viz/patterns-v2/facet-target-band.spec.json` |
| Drill-down Stacked Bar | Bar | Facet + stack | Click drill | `examples/viz/patterns-v2/drilldown-stacked-bar.spec.json` |

## Responsive Recipes (generated via `scoreResponsiveStrategies`)

| Pattern | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Grouped Bar | Single layout, collapse legend, tap-to-isolate series | Two-column grouped bars | Baseline grouped columns + hover focus |
| Stacked Bar | Single stacked, table fallback emphasized | Dual-column stack with legend | Default stacked layout |
| 100% Stacked Bar | Single stack, share labels inline | 2-column grid, legend pins to top | Full stack with hover detail |
| Diverging Bar | Single column with neutral baseline label | 2-column grid when comparing cohorts | Desktop retains paired axes + annotations |
| Multi-series Line | Single sparkline with toggle to isolate cohorts | Layered view with brush zoom | Layered lines plus hover highlight |
| Target Band Line | Single line + band, summary callout | Layered chart with slider controls | Full line + band with interactive focus |
| Running Total Area | Full-width sparkline and textual totals | Area chart with optional brush | Desktop area + annotations |
| Bubble Distribution | List view with key KPIs, no overlapping glyphs | Scatter with pinch zoom | Full scatter + brush |
| Correlation Scatter | Single quadrant with minified axes | Scatter + brush | Full scatter + optional regression overlay |
| Time Grid Heatmap | Collapse to list/table fallback | 2×2 grid with zoom | Full heatmap grid |
| Correlation Matrix | Table fallback, highlight top 3 cells | 2×2 split panels | Full symmetric matrix |
| Facet Small Multiples Line | Single stack of panels (vertical) | 2 column grid | Full facet grid |
| Layered Actual vs Target | Single area + target numeric summary | Full layered chart | Layered area + multiple reference lines |
| Stacked Channel Projection | Single stacked area, legend toggles | 2-column grid (channel × month) | Full stacked area with hover |
| Linked Brush Scatter | KPI cards + sorted table | Scatter with simplified brush | Scatter with full linked brush |
| Focus + Context Line | Only focus panel visible, context summarized textually | Context + focus stacked vertically | Overview + focus simultaneously |
| Detail-overview Bar | Overview panel only with select control | Overview + active detail panel | Overview plus two detail panels |
| Sparkline Grid | Sequential stack of sparks, caption per KPI | Two-column grid, independent y-scales | Full grid (3 column wrap) |
| Facet Target Band | Single panel per region with toggles | 2-column facets with shared axes | Full grid + hover band deltas |
| Drill-down Stacked Bar | One region visible at a time, segmented table fallback | 2-column facet layout | Full facet grid + interactive drill |

Use the **viewport control** in Storybook or call `scoreResponsiveStrategies(patternId, schemaIntent)` to regenerate these recipes programmatically.

## Applying Responsive Guidance Programmatically

```ts
import { scoreResponsiveStrategies } from '@/viz/patterns/responsive-scorer';

const schema = {
  measures: 1,
  dimensions: 2,
  goal: ['comparison'],
  requiresGrouping: true,
};

const bundle = scoreResponsiveStrategies('facet-small-multiples-line', schema);
// => { recipes: [{ breakpoint: 'mobile', layout: 'single', adjustments: [...] }, ...] }
```

Integrate these recommendations inside layout-aware components (e.g., drive Storybook toolbar controls, CLI scaffolds, or runtime breakpoints).

## Pattern Notes

### Composition & Value Patterns

- **Layered Actual vs Target**: Keep actual as area fill and reserves target/capacity for strokes. Use semantic tokens for threshold lines and ensure the legend order matches stack order.
- **Stacked Channel Projection**: Works best for ≤5 channels. When cardinality exceeds this range, fall back to the sparkline grid or detail-overview bar.
- **Facet Target Band**: Provide lower/upper bound columns for every record. The responsive scorer recommends stacking panels on mobile; never rely on horizontal scrolling.

### Layout & Dashboard Patterns

- **Facet Small Multiples Line**: Each region × segment pair occupies its own panel. Mobile stacks are limited to one column while desktop uses a grid with shared axes.
- **Sparkline Grid**: Designed for high-density Chromatic baselines (1k+ datapoints). Highlights the densest delta and collapses to table fallback on mobile.
- **Focus + Context Line**: The responsive scorer swaps to `facet` on tablet and keeps the `concat` treatment on desktop.
- **Detail-overview Bar**: Section filters drive each panel; use `LayoutConcat.sections[]` to define overview + detail pairings.

### Interaction Patterns

- **Linked Brush Scatter**: Ships with interval brush + hover tooltip. Responsive scorer disables brush on mobile and exposes tap-to-isolate.
- **Drill-down Stacked Bar**: Uses click handlers to expose stage totals. Provide textual hints for keyboard users.

### Heatmaps & Matrices

- **Time Grid Heatmap** and **Correlation Matrix** now live inside `patterns-v2`. They still feed chromatic baselines but inherit the new responsive guidance (table fallback + 2×2 layout for tablets).

## Anti-pattern Reminders

See `docs/viz/anti-patterns.md` for color, stacking, and interaction pitfalls. Highlights updated for v2:

1. Avoid **horizontal scrolling** inside small multiples—stack vertically on mobile.
2. Do not expose **simultaneous brush + legend toggles** on touch breakpoints; prefer tap-to-isolate.
3. Never mix **units** (USD vs %) inside the sparkline grid; create separate grids when units differ.

## Storybook & Chromatic

- Story: `Visualization/Patterns/Responsive Library`
- Run `pnpm chromatic --exit-zero-on-changes` after modifying specs or responsive recipes to refresh high-density baselines.

## CLI & Testing

- `pnpm viz:suggest` automatically includes v2 patterns thanks to the updated registry.
- Tests: `tests/viz/patterns/pattern-library-v2.test.ts` ensure every spec exists and responsive scoring behaves as expected.
