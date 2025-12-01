# Spatial Module

Spatial adds first-class geospatial visualization to OODS with pass-through adapters for Vega-Lite and ECharts. It ships production-ready components (ChoroplethMap, BubbleMap, MapLegend, MapControls, AccessibleMapFallback), SpatialContainer/SpatialContext for projection + accessibility state, and traits/adapters that keep renderer parity.

## What you get
- Region and point maps: ChoroplethMap (fills) and BubbleMap (points/clusters) that consume real GeoJSON/TopoJSON and share SpatialContext.
- Dual adapters: `vega-lite-spatial-adapter.ts` and `echarts-spatial-adapter.ts` build renderer configs from the same normalized spec; renderer selector biases toward ECharts for large/streaming data.
- Projection + traits: Geocodable, HasProjection, and LayeredOverlay traits describe geo readiness, projection config, and multi-layer composition.
- A11y + guardrails: Required `a11y` descriptions, table/narrative fallbacks via AccessibleMapFallback, keyboard/nav utilities, and `--oods-` token usage for all colors.
- Data plumbing: Geo resolver + joiner handle GeoJSON/TopoJSON, key matching, and join diagnostics before rendering.

## Quick start

### Minimal choropleth
```typescript
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import usStates from '@/components/viz/spatial/fixtures/us-states-10m.json';
import type { SpatialSpec } from '@/types/viz/spatial';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer';
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap';

const statesGeo = feature(usStates as Topology, (usStates as { objects: { states: unknown } }).objects.states);

const spec: SpatialSpec = {
  type: 'spatial',
  name: 'Cases by State',
  data: { values: [{ name: 'California', cases: 1200 }, { name: 'Texas', cases: 950 }] },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [{ type: 'regionFill', encoding: { color: { field: 'cases' } } }],
  a11y: { description: 'US states colored by case counts' },
};

export function ChoroplethExample(): JSX.Element {
  const data = spec.data.values ?? [];
  return (
    <SpatialContainer
      spec={spec}
      geoData={statesGeo}
      data={data}
      width={960}
      height={600}
      a11y={{ description: 'US states colored by case counts' }}
    >
      <ChoroplethMap
        data={data}
        valueField="cases"
        geoJoinKey="name"
        a11y={{ description: 'US states colored by case counts' }}
      />
    </SpatialContainer>
  );
}
```

### Minimal bubble/symbol map
```typescript
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer';
import { BubbleMap } from '@/components/viz/spatial/BubbleMap';

const cityData = [
  { city: 'Seattle', lat: 47.6062, lon: -122.3321, population: 737015 },
  { city: 'Portland', lat: 45.5152, lon: -122.6784, population: 652503 },
];

const bubbleSpec = {
  type: 'spatial',
  name: 'City Population',
  data: { values: cityData },
  projection: { type: 'mercator', fitToData: true },
  layers: [{ type: 'symbol', encoding: { size: { field: 'population' }, color: { field: 'city' } } }],
  a11y: { description: 'Cities sized by population' },
} as unknown as NormalizedVizSpec;

export function BubbleExample(): JSX.Element {
  return (
    <SpatialContainer
      spec={bubbleSpec}
      geoData={{
        type: 'FeatureCollection',
        features: cityData.map((city, index) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
          properties: { name: city.city, population: city.population },
          id: `city-${index}`,
        })),
      }}
      data={cityData}
      width={900}
      height={520}
      a11y={{ description: 'Cities sized by population' }}
    >
      <BubbleMap
        spec={bubbleSpec}
        data={cityData}
        longitudeField="lon"
        latitudeField="lat"
        sizeField="population"
        colorField="city"
        a11y={{ description: 'Cities sized by population' }}
      />
    </SpatialContainer>
  );
}
```

## Component reference
- **SpatialContainer**: Root context provider that resolves geo sources, joins data, fits projections (`projectionInstance` is shared), orders layers, and wires keyboard/screen-reader hooks. Requires `spec`, `geoData` (GeoJSON FeatureCollection), `width/height`, and `a11y`.
- **ChoroplethMap**: Region fills driven by `valueField`, `geoJoinKey` (defaults `dataJoinKey`), optional `colorScale` (`quantize` default), `colorRange`, `thresholds`, `fitToData`, `preferredRenderer` (`svg` default). Uses SpatialContext features/projection; always pass `a11y.description`.
- **BubbleMap**: Point/symbol map with `longitudeField`, `latitudeField`, optional `sizeField` (`linear` scale default), `colorField`, `colorType` (`categorical`|`continuous`), and `cluster` controls. Honors `preferredRenderer` (defaults to `svg`) and uses SpatialContext projection when present.
- **MapLegend**: Auto-derives legend from SpatialContext layers or accept explicit color/size scales; supports continuous gradients and size bubbles; place via `position` + `orientation`.
- **MapControls**: Zoom buttons and layer toggles; auto-builds layer list from SpatialContext or accept explicit `layers`; announces layer changes through the shared live region.
- **AccessibleMapFallback**: Table + narrative fallback driven by `spec.a11y.tableFallback` and `a11y.narrative`; renders when table fallback is enabled in spec or props.

## Trait reference
- **Geocodable**: Marks data as geo-resolvable; detects geo-friendly field names and `field.geopoint/field.geojson` types. See `traits/viz/spatial/geocodable.trait.ts` and `docs/traits/geocodable.md`.
- **HasProjection**: Declares projection type/config (mercator, albersUsa, equalEarth, orthographic, conic*). Consumed by SpatialContainer and adapters. See `src/traits/viz/spatial/HasProjection.trait.ts` and `docs/traits/has-projection.md`.
- **LayeredOverlay**: Describes multiple spatial layers with z-order, opacity, and interaction toggles. See `docs/traits/layered-overlay.md`. SpatialContainer merges defaults and orders layers.

## Adapter reference
- **Vega-Lite**: `vega-lite-choropleth-adapter.ts` and `vega-lite-bubble-adapter.ts` generate `mark: geoshape`/`circle` specs with projection + color/size scales. Uses `vega-lite-projection-map.ts` + `vega-lite-scale-map.ts` for projection/scale parity.
- **ECharts**: `echarts-choropleth-adapter.ts` uses `series-map` + `visualMap`; `echarts-bubble-adapter.ts` uses geo scatter with optional clustering; `echarts-geo-registration.ts` registers GeoJSON and handles TopoJSON conversion.
- **Renderer selection**: `renderer-selector.ts` prefers ECharts for >10k points or streaming specs; portability priority (`spec.portability.priority === "high"`) forces Vega-Lite. See [`spatial-dashboard-integration.md`](./spatial-dashboard-integration.md).

## Data format requirements
- Geo sources: GeoJSON FeatureCollection or TopoJSON topology (convert via `topojson-client feature(...)`); include stable join keys in `properties`.
- Joins: `geoJoinKey` (feature property) must match `dataJoinKey`/`valueField` source; normalize case/whitespace. Use `geo-data-joiner.ts` or `useSpatialSpec` to catch mismatches (`unmatchedFeatures`, `unmatchedData` diagnostics).
- Spec: `SpatialSpec` aligns with `schemas/viz/spatial-spec.schema.json`; include `layers` with encodings and `projection.fitToData` when you need auto-fit.
- Tokens: Use `--oods-viz-*` or `--sys-*` variables for color/size; components resolve tokens and fall back to OKLCH → RGB conversion.

## Performance + quality guardrails
- Data volume: <500 regions → direct choropleth; <5k points → direct bubble; 5k–50k → enable `cluster`; >50k → aggregate or tile before render.
- Projections: Reuse `projectionInstance` from SpatialContext; avoid creating projections in child components (Pattern 1 from Appendix B).
- Real data: Use real GeoJSON/TopoJSON in docs/stories; avoid rectangles or placeholder shapes.
- Joins: Enforce exact key matches; normalize to lowercase/trim before comparing.
- Tokens: Keep `--oods-` prefix in stories and examples to avoid silent fallback colors.

## See also
- [`spatial-patterns.md`](./spatial-patterns.md) for chart-type selection.
- [`spatial-migration.md`](./spatial-migration.md) for moving off custom maps.
- [`spatial-accessibility.md`](./spatial-accessibility.md) for a11y specifics.
- [`spatial-dashboard-integration.md`](./spatial-dashboard-integration.md) for dashboard embedding and cross-filters.
- [`geo-data-resolver.md`](./geo-data-resolver.md) for geo source resolution details.
