# Spatial Migration Guide

Move existing map implementations to the OODS Spatial module. Follow this guide to audit current maps, map props to ChoroplethMap/BubbleMap, add accessibility, and verify parity.

## Pre-migration audit
- Inventory geo sources (GeoJSON vs TopoJSON), file locations, and licensing.
- Capture current prop/interface shape for maps, legends, and controls.
- List join keys and verify they match geo properties (case/whitespace).
- Note accessibility gaps (no table fallback, missing aria labels, keyboard paths).
- Check color usage for token compliance (`--oods-`/`--sys-` only).

## Step-by-step migration

### 1) Audit geo data sources
- Validate GeoJSON/TopoJSON structure; convert TopoJSON via `topojson-client feature(...)`.
- Decide join keys up front (`geoJoinKey` ↔ `dataJoinKey`); normalize keys to lowercase/trim.
- Use `resolveGeoData` or `useSpatialSpec` to surface `unmatchedFeatures` / `unmatchedData`.

### 2) Map props to OODS components

**ChoroplethMap**
| Existing | ChoroplethMap | Notes |
| --- | --- | --- |
| region id | `geoJoinKey` | Feature property name (e.g., `properties.name`) |
| value field | `valueField` | Numeric field to color by |
| data join key (optional) | `dataJoinKey` | Use when data key differs from `geoJoinKey` |
| color scale | `colorScale` / `colorRange` / `thresholds` | Default quantize + sequential tokens |
| projection | `projection` / `fitToData` | Prefer `fitToData: true` when geo bounds are known |
| renderer | `preferredRenderer` | `svg` default; `vega-lite` or `echarts` when needed |

**BubbleMap**
| Existing | BubbleMap | Notes |
| --- | --- | --- |
| longitude/latitude | `longitudeField` / `latitudeField` | Required numeric fields |
| size field | `sizeField` + `sizeScale` + `sizeRange` | `linear` default; `sqrt` for wide ranges |
| color field | `colorField` + `colorType` + `colorRange` | `categorical` or `continuous` |
| clustering | `cluster.enabled` + `radius` + `minPoints` | Enable for dense point clouds |
| projection | `projection` | Defaults to container projection |
| renderer | `preferredRenderer` | Align with performance/portability goals |

### 3) Add accessibility fields
- Required: `a11y.description` (what the map shows) and `tableFallback.enabled` + `caption`.
- Narrative: `a11y.narrative.summary` + 2–3 `keyFindings` mirroring the map’s insight.
- Keyboard: ensure MapControls/SpatialContainer focus path works; verify Tab/Enter/Escape/+- navigation.
- Screen reader: rely on SpatialContainer live regions; announce layer toggles via MapControls.

### 4) Replace custom components
- Custom legend → `MapLegend` (auto derives from SpatialContext or accepts explicit scales).
- Custom controls → `MapControls` (zoom + layer toggles with announcements).
- Custom table → `AccessibleMapFallback` (respects `tableFallback.columns` + `aria-sort`).
- Custom map renderer → `ChoroplethMap` or `BubbleMap` inside `SpatialContainer`.

### 5) Verification checklist
- [ ] Geo data loads; `resolveGeoData` reports zero `unmatchedFeatures` and `unmatchedData`.
- [ ] Joins verified visually (hover values match expected data).
- [ ] Interactions fire: region/point click + hover callbacks.
- [ ] Accessibility: axe passes; keyboard navigation works; narrative + table rendered.
- [ ] Tokens: only `--oods-viz-*` / `--sys-*` referenced.
- [ ] Renderer parity: Vega-Lite vs ECharts outputs match for the chosen spec.

## Common migration issues
- Join key mismatches: normalize to lowercase/trim; log warnings for missing keys.
- Projection misfit: reuse `projectionInstance` from SpatialContext instead of creating new projections per layer.
- Token prefix drift: `--oods-viz-*` required; avoid hex literals that bypass guardrails.
- Placeholder data: use real GeoJSON/TopoJSON fixtures for validation (`src/components/viz/spatial/fixtures`).
- Missing fallbacks: always enable `tableFallback` and narratives for screen readers; pair with [`spatial-accessibility.md`](./spatial-accessibility.md).

## References
- [`spatial-module.md`](./spatial-module.md) for module overview and examples.
- [`spatial-dashboard-integration.md`](./spatial-dashboard-integration.md) for cross-filters and renderer selection.
- [`spatial-patterns.md`](./spatial-patterns.md) to choose choropleth vs bubble and projection/color scales.
