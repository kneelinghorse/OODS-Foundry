# Layout Adapter Guide

Mission **B23.2 – Layout Adapter Support** adds first-class view-composition
support to both Vega-Lite and ECharts adapters. This guide explains how layout
traits (`LayoutFacet`, `LayoutLayer`, `LayoutConcat`) flow through the adapter
pipeline, where shared scale logic lives, and how to validate new specs.

## Modules & Responsibilities

| File | Purpose |
| --- | --- |
| `src/viz/adapters/vega-lite-layout-mapper.ts` | Wraps primitive specs in `facet`, `concat`, or layer-aware nodes, keeping sizing and `resolve.scale` metadata aligned with the normalized spec. |
| `src/viz/adapters/echarts-layout-mapper.ts` | Builds multi-grid options by cloning datasets/series per panel, applies dataset filters, and annotates `usermeta.oods.layoutRuntime`. |
| `src/viz/adapters/scale-resolver.ts` | Converts `sharedScales` declarations into renderer-specific configs (Vega-Lite `resolve.scale`, ECharts sharing flags). |
| `src/viz/adapters/interaction-propagator.ts` | Computes panel count + sync plan so interaction runtimes (e.g., `bindEChartsInteractions`) can broadcast highlights across layouts. |

## Vega-Lite Mapping

1. `toVegaLiteSpec` converts marks + encodings into a primitive spec.
2. `buildVegaLiteSpec` inspects `spec.layout`:
   - **LayoutFacet** → emits `{ facet, spec, resolve }` with `spacing = gap`.
   - **LayoutConcat** → emits `hconcat`, `vconcat`, or `concat` arrays with
     per-section filters.
   - **LayoutLayer** → enforces `order` hints and scale resolution while
     reusing the existing layered spec semantics.
3. Sizing (`width`, `height`, `padding`) is attached to the inner `spec` so
   each panel inherits the same footprint.

### Key Behaviors

- `resolve.scale` mirrors `sharedScales` declarations channel-by-channel.
- Section filters translate to Vega-Lite expression filters so each
  dashboard panel can target a subset of the normalized data.
- Layer ordering prefers explicit IDs (`mark.options.id`) before falling back
  to the trait name, keeping multi-layer blends stable.

## ECharts Mapping

1. `applyEChartsLayout` runs after the base option is assembled.
2. For **LayoutFacet**:
   - Unique row/column values are derived from inline `data.values`.
   - Each panel receives a derived dataset (`fromDatasetId`) with filter
     transforms, a dedicated grid cell, and cloned series referencing the
     correct `datasetId`.
3. For **LayoutConcat**:
   - Each section generates a panel using `section.filters`.
   - Direction (`horizontal`, `vertical`, `grid`) controls grid placement.
4. Metadata (`usermeta.oods.layoutRuntime`) captures trait name, panel count, and
   whether x/y/color channels remain shared.

### Interaction Propagation

`bindEChartsInteractions` now consults the propagation plan to broadcast point
highlights. When layouts request synced interactions, hover events will call
`dispatchAction('highlight')` for each panel’s series so the same data row
lights up across the grid.

## Testing & Validation

New unit suites live under `tests/viz/adapters/`:

- `layout-adapter.test.ts` – Ensures Vega-Lite facet specs and ECharts options
  contain the correct structure, derived datasets, and metadata.
- `layout-parity.test.ts` – Guards parity between renderer outputs (panel
  counts, shared scale semantics).
- `echarts-interactions.test.ts` – Verifies highlight events fan out across
  layout panels.

Run the targeted suites via:

```bash
pnpm vitest tests/viz/adapters/layout-adapter.test.ts
pnpm vitest tests/viz/adapters/layout-parity.test.ts
pnpm vitest tests/viz/echarts-interactions.test.ts
```

## Authoring Tips

- Always prefer inline data when exercising facets in unit tests—derived
  dataset filters rely on actual row values.
- Set `mark.options.id` when layering multiple marks so `LayoutLayer.order`
  hints remain deterministic.
- Include `sharedScales` inside layout traits whenever downstream renderers
  must keep domains aligned; the scale resolver enforces these bindings.
- When adding new layout traits, implement renderer-specific mapping functions
  in the respective layout mapper and extend `scale-resolver.ts` if additional
  channels appear.
