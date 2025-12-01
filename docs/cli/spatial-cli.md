# Spatial CLI

CLI helpers for the Spatial module. Extends `viz:suggest` with spatial detection and adds `viz:scaffold-spatial` for ready-to-use scaffolds.

## Commands

- `pnpm viz:suggest --type spatial --data ./my-geo-data.json [--scaffold]`
  - Detects lat/lon, region, or geometry fields.
  - Recommends `bubble` vs `choropleth` with confidence and detected fields.
  - Optional `--scaffold` prints a TypeScript starter (spec + component usage) with a11y defaults.

- `pnpm viz:scaffold-spatial --type <choropleth|bubble> [options]`
  - Generates a component snippet with sample data, spec, and accessibility fields.
  - Options: `--geo` (join source), `--value` (metric), `--region`, `--lat`, `--lon`, `--size`, `--color`.

## Detection Heuristics

- Bubble: lat/lon/latitude/longitude/lng + optional x/y pairing.
- Choropleth: region identifiers (country, state, province, region, city, zip, postal, fips, iso, geo_id) or geometry/geojson/shape/boundary fields.
- Value field: first numeric column not used for coordinates/region.

## Output Characteristics

- Deterministic results (same input → same output).
- A11y defaults: description, narrative summary, table fallback with caption.
- Token references use `--oods-viz-*` variables for colors.

## Examples

```bash
pnpm viz:suggest --type spatial --data ./data/us-states.json --scaffold
pnpm viz:scaffold-spatial --type choropleth --geo us-states.topojson --region state --value sales
pnpm viz:scaffold-spatial --type bubble --lat latitude --lon longitude --size population --color region
```
