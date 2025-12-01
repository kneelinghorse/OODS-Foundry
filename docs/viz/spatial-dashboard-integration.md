## Spatial Dashboard Integration

Use the spatial dashboard helpers to embed maps into dashboard layouts with consistent renderer selection, cross-filters, and tooltips.

### Renderer selection
- `selectVizRenderer` now understands `SpatialSpec` and applies spatial heuristics: >10k points → `echarts`; streaming → `echarts`; portability priority `high` → `vega-lite`; default → `vega-lite`.
- Keep `portability.priority` set when you need to force portability-first rendering.
- Verify with `tests/viz/integration/renderer-selection-spatial.test.ts`.

### Dashboard layout
- Register widgets with `registerSpatialDashboardWidgets` from `src/viz/contexts/dashboard-spatial-context.tsx`.
- Default grid span for maps is 2×2; `resolveGridSpan` collapses to 1 column on narrow viewports.
- Each wrapper emits `data-dashboard-widget="spatial"` plus `data-spatial-kind` and grid span attributes for layout engines.

### Cross-filtering
- Action creators live in `src/viz/interactions/spatial-filter-actions.ts`:
  - `createRegionFilterAction(sourceId, feature, datum)`
  - `createPointFilterAction(sourceId, datum, radiusKm?)`
  - `createClearSpatialFilterAction(sourceId?)`
- Reducer: `spatialFilterReducer` + `summarizeFilters` for quick debug strings.
- Bind handlers via `createSpatialInteractionBindings(sourceId, dispatch)` to wire map clicks into your dashboard store.

### Tooltips
- `src/viz/tooltip/spatial-tooltip-config.ts` provides shared tooltip fields and formatters for Vega-Lite + ECharts.
- Choropleth + bubble adapters now consume these helpers to keep labels and formatting consistent.

### Example + tests
- Example dashboard: `examples/dashboards/spatial-dashboard.tsx` (choropleth + bubble map with linked table).
- Integration tests:
  - `tests/viz/integration/spatial-dashboard.test.tsx` (layout + spans)
  - `tests/viz/integration/spatial-crossfilter.test.ts`
  - `tests/viz/integration/renderer-selection-spatial.test.ts`

### Validation checklist
- Maps use real GeoJSON/TopoJSON data (US states fixture) with matching join keys.
- Grid spans adapt to viewport width.
- Region click → filter propagated to linked widgets; clear filter resets state.
- Tooltips show the same fields across renderers.
