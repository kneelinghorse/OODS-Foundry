# Vega-Lite Spatial Adapter

Translates the OODS `SpatialSpec` into Vega-Lite specs for maps. Supports choropleths (`regionFill` layers) and bubble/point maps (`symbol` layers) with shared projection settings and governed token ranges.

## What it does
- Embeds GeoJSON features (or TopoJSON converted upstream) into `data.values` with `format.property: "features"`.
- Joins tabular data to features when `data.type === "data.geo.join"` (uses `joinKey` ↔ `geoKey`).
- Maps projection settings to Vega-Lite (`projection.type`, `center`, `rotate`, `clipExtent`, `fit` with `size`).
- Maps color scales to Vega-Lite scale types (quantize/quantile/threshold/linear/ordinal) and defaults to `--oods-viz-scale-sequential-*`.
- Outputs layered specs: optional basemap geoshape + circles for bubble maps; geoshape layers for choropleths.

## API
```ts
import { adaptToVegaLite } from '@/viz/adapters/spatial/vega-lite-spatial-adapter.js';

const { vegaLiteSpec, dataUrls } = adaptToVegaLite({
  spec,                    // SpatialSpec (type: "spatial")
  geoData,                 // GeoJSON FeatureCollection (required for regionFill; optional basemap for symbol)
  data,                    // Tabular records (auto-joined when data.geo.join)
  dimensions: { width, height },
});
```

## Projection mapping
| OODS projection | Vega-Lite projection.type |
|-----------------|---------------------------|
| mercator        | mercator                  |
| albersUsa       | albersUsa                 |
| equalEarth      | equalEarth                |
| orthographic    | orthographic              |
| conicEqualArea  | conicEqualArea            |
| conicConformal  | conicConformal            |
| azimuthalEqualArea | azimuthalEqualArea     |
| azimuthalEquidistant | azimuthalEquidistant |
| gnomonic        | gnomonic                  |
| stereographic   | stereographic             |
| naturalEarth1   | naturalEarth1             |
| equirectangular | equirectangular           |

`fitToData: true` → `projection.fit: true` and `projection.size` set to the provided dimensions.

## Color scale mapping
- `quantize | quantile | threshold | linear | ordinal` → `scale.type` kept verbatim.
- `range` defaults to `['var(--oods-viz-scale-sequential-01)', '...03', '...05', '...07']` when not supplied.
- `nullValue` creates a conditional fill: invalid/missing values fall back to the provided token.

## Usage patterns
### Choropleth
```ts
const spec = {
  type: 'spatial',
  data: { type: 'data.geo.join', geoSource: 'us-states.topojson', source: 'states.csv', geoKey: 'name', joinKey: 'state' },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [
    { type: 'regionFill', encoding: { color: { field: 'rate', scale: 'quantile' } } },
  ],
  a11y: { description: 'Rates by state' },
};

const { vegaLiteSpec } = adaptToVegaLite({ spec, geoData, data, dimensions: { width: 720, height: 460 } });
```

### Bubble map with optional basemap
```ts
const spec = {
  type: 'spatial',
  data: { values: cities },
  projection: { type: 'mercator' },
  layers: [
    { type: 'symbol',
      encoding: {
        longitude: { field: 'lon' },
        latitude: { field: 'lat' },
        size: { field: 'population', range: [6, 32] },
        color: { field: 'region', scale: 'ordinal', nullValue: 'var(--sys-border-strong)' },
      },
    },
  ],
  a11y: { description: 'City populations' },
};

const { vegaLiteSpec } = adaptToVegaLite({ spec, geoData, dimensions: { width: 640, height: 420 } });
```

## Quality guardrails
- **Join hygiene:** `geoKey` must exist on features; `joinKey` must exist on data. Keys are normalized (trim/lowercase) before matching.
- **Token safety:** defaults use `--oods-viz-scale-sequential-*`. Provide governed tokens for custom ranges.
- **Projection correctness:** adapter respects `projection.fitToData` and passes through center/rotate/clip settings.
- **A11y:** `spec.a11y.description` maps to `description`; tooltips include region names and values by default.
- **Tests:** schema validation + smoke SVG rendering in `tests/viz/adapters/spatial/vega-lite-*.test.ts`.

## References
- Architecture: `cmos/foundational-docs/data-viz-part2/spatial-module/ARCHITECTURE.md`
- Schema: `schemas/viz/spatial-spec.schema.json`
- Tokens: `packages/tokens/src/viz-map.json`
