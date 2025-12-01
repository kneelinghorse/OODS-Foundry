# Spatial Patterns

How to choose and configure spatial visualizations across OODS. Use this guide to map datasets to the right component, projection, color scale, and interaction model.

## Choropleth maps (region fills)
- Best for: bounded regions (states, counties, countries) with numeric values.
- Data: GeoJSON/TopoJSON with region identifiers; tabular data with matching keys (`geoJoinKey` ↔ `dataJoinKey`/`valueField`).
- Components: `SpatialContainer` + `ChoroplethMap` + `MapLegend` + `AccessibleMapFallback`.
- Encoding: sequential or diverging color scales; set `fitToData: true` to auto-fit projection to features.
- Use when: comparing rates/ratios across areas; showing hotspots; rendering thresholds.

## Bubble / symbol maps (points)
- Best for: discrete locations with magnitude or category.
- Data: `longitudeField` + `latitudeField` (numbers), optional `sizeField` and `colorField`.
- Components: `SpatialContainer` + `BubbleMap` + `MapLegend` (size + color) + `MapControls` for zoom/toggles.
- Options: `cluster.enabled` for dense point sets; `sizeScale` (`linear`/`sqrt`/`log`) and `colorType` (`categorical`|`continuous`).
- Use when: store locations, incidents, capacity, flows between discrete coordinates.

## Projection selection
- **mercator**: Web default; works for local/regional maps; distorts area at poles.
- **albersUsa**: US-focused with Alaska/Hawaii insets; use for US choropleths.
- **equalEarth**: Global comparisons where area fairness matters.
- **orthographic**: Globe-style presentations; limit for overview, not precise comparison.
- **conicEqualArea/conicConformal**: Regional focus (e.g., EU, APAC) with reduced distortion.

## Color scale selection
- Sequential (`quantize`/`quantile`): monotonic low→high values. Default ranges: `var(--oods-viz-scale-sequential-01|03|05|07)`.
- Diverging (`threshold` with neutral midpoint): centered metrics (variance from baseline, positive/negative change).
- Threshold vs quantile vs quantize:
  - `threshold`: explicit domain breakpoints you control.
  - `quantile`: equal-count buckets from data distribution.
  - `quantize`: equal-size numeric buckets across min/max range.
- Always pair with `MapLegend` and avoid color-only encoding; add numeric labels or tooltips.

## Common mistakes to avoid
- Using Mercator for area comparisons (switch to Equal Earth or Albers variants).
- Mismatched join keys (case/whitespace differences). Normalize before join; validate with `geo-data-joiner` diagnostics.
- Placeholder rectangles for demos. Use real GeoJSON/TopoJSON fixtures (see `src/components/viz/spatial/fixtures`).
- Missing token prefix. Use `--oods-viz-*` or `--sys-*`; avoid raw hex literals.
- Creating new projections inside layers instead of consuming `projectionInstance` from SpatialContext (Pattern 1 from Appendix B).

## Quick checklist
- [ ] Geo data and tabular data share the same join keys.
- [ ] Projection selected for geography and distortion tolerance.
- [ ] Color scale type matches the metric (sequential vs diverging) and includes a legend.
- [ ] a11y description + table fallback + narrative populated (see [`spatial-accessibility.md`](./spatial-accessibility.md)).
- [ ] Real geo fixtures in docs/stories; verify renders visually across light/dark themes.
