# ECharts Spatial Adapter

Generate ECharts options for spatial visualizations (choropleth + bubble map) from the OODS spatial spec.

## Overview

- **Inputs:** `SpatialSpec`, GeoJSON FeatureCollection, optional tabular data override, dimensions.
- **Outputs:** ECharts option object plus optional geo registration payload.
- **Supported layers:** `regionFill` (choropleth) and `symbol` (bubble map). Mixed-layer specs are merged into a single option with shared `geo`.
- **Map registration:** The adapter emits `geoRegistration` and also registers maps via `registerGeoJson` when geo data is provided.

## API

```ts
import type { SpatialSpec } from '@/types/viz/spatial';
import { adaptToECharts } from '@/viz/adapters/spatial/echarts-spatial-adapter';
import { adaptChoroplethToECharts } from '@/viz/adapters/spatial/echarts-choropleth-adapter';
import { adaptBubbleToECharts } from '@/viz/adapters/spatial/echarts-bubble-adapter';
import { registerGeoJson } from '@/viz/adapters/spatial/echarts-geo-registration';
```

### Combined adapter

```ts
const { echartsOption, geoRegistration } = adaptToECharts({
  spec,                // SpatialSpec
  geoData,             // FeatureCollection (required for choropleth, optional for bubble)
  data,                // DataRecord[] override (defaults to spec.data.values)
  dimensions: { width, height },
});

// Optional: register manually in runtime environments that need it
if (geoRegistration) {
  registerGeoJson(geoRegistration.name, geoRegistration.geoJson);
}
```

### Choropleth only

```ts
const option = adaptChoroplethToECharts(spec, geoData, data, { width: 640, height: 360 });
```

### Bubble map only

```ts
const option = adaptBubbleToECharts(spec, geoData, data, { width: 480, height: 360 });
```

## Behavior

- **VisualMap:** Generated from color encoding. `linear` → `visualMap:continuous`, other scales → `piecewise` with splits derived from palette length.
- **Geo registration:** Uses `echarts.registerMap` with caching; converts TopoJSON to GeoJSON when needed.
- **Coordinate system:** All bubble layers render as `scatter` with `coordinateSystem: 'geo'`. Choropleth renders `map` series bound to the shared `geo`.
- **Symbol sizing:** Derived from `size` encoding using `sqrt|log|linear` with the provided `range`.
- **A11y:** `aria.description` pulled from `spec.a11y.description`.

## Examples

### Choropleth

```ts
const spec: SpatialSpec = {
  type: 'spatial',
  data: {
    type: 'data.geo.join',
    source: 'inline://data',
    geoSource: 'inline://geo',
    joinKey: 'state',
    geoKey: 'state',
  },
  geo: { source: 'inline://geo', feature: 'usa' },
  projection: { type: 'albersUsa' },
  layers: [
    { type: 'regionFill', encoding: { color: { field: 'value', scale: 'quantile' } } },
  ],
  a11y: { description: 'Population by state' },
};

const { echartsOption } = adaptToECharts({ spec, geoData, data, dimensions: { width: 800, height: 520 } });
```

### Bubble map

```ts
const spec: SpatialSpec = {
  type: 'spatial',
  data: { values },
  projection: { type: 'mercator' },
  layers: [
    {
      type: 'symbol',
      encoding: {
        longitude: { field: 'lon' },
        latitude: { field: 'lat' },
        size: { field: 'magnitude', range: [6, 32], scale: 'sqrt' },
        color: { field: 'category', scale: 'ordinal' },
      },
    },
  ],
  a11y: { description: 'City magnitude map' },
};
```

## Tests

- `tests/viz/adapters/spatial/echarts-spatial-adapter.test.ts`
- `tests/viz/adapters/spatial/echarts-visual-regression.test.ts`

Run targeted suite:

```bash
pnpm test tests/viz/adapters/spatial/echarts-spatial-adapter.test.ts
pnpm test tests/viz/adapters/spatial/echarts-visual-regression.test.ts
```
