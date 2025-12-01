# BubbleMap Component

**Point/symbol map for discrete locations with size and color encoding.**

## Overview

The BubbleMap renders geographic points where radius and color convey data values. Typical use cases: city populations, store performance, incident hotspots, and capacity planning.

## Features

- ✅ Size encoding with linear, sqrt (default), or log scales
- ✅ Color encoding for categorical or continuous values
- ✅ Optional clustering for dense areas
- ✅ Keyboard and screen-reader friendly (ARIA labels, focusable points)
- ✅ Works with SpatialContainer projection context
- ✅ Supports SVG, Vega-Lite, and ECharts renderers

## Basic Usage

```tsx
import { BubbleMap } from '@/components/viz/spatial/BubbleMap';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer';
import type { SpatialSpec } from '@/types/viz/spatial';

const data = [
  { city: 'San Francisco', lon: -122.4194, lat: 37.7749, population: 873965 },
  { city: 'New York', lon: -74.006, lat: 40.7128, population: 8804190 },
];

const spec: SpatialSpec = {
  type: 'spatial',
  data: { values: data },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [],
  a11y: { description: 'City populations by size' },
};

function CityPopulationMap() {
  return (
    <SpatialContainer
      spec={spec}
      geoData={usStatesGeoJSON}
      width={1000}
      height={600}
      data={data}
      a11y={{ description: 'US city population bubble map' }}
    >
      <BubbleMap
        spec={spec as unknown as NormalizedVizSpec}
        data={data}
        longitudeField="lon"
        latitudeField="lat"
        sizeField="population"
        sizeRange={[6, 36]}
        a11y={{ description: 'US city population bubble map' }}
      />
    </SpatialContainer>
  );
}
```

## Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `data` | `DataRecord[]` | Array of tabular records containing lon/lat and encoded fields |
| `longitudeField` | `string` | Field name for longitude |
| `latitudeField` | `string` | Field name for latitude |
| `a11y` | `SpatialA11yConfig` | Accessibility description, table fallback, narrative |
| `spec` | `NormalizedVizSpec` | Normalized spec used for runtime integrations |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sizeField` | `string` | - | Field for radius encoding |
| `sizeRange` | `[number, number]` | `[4, 40]` | Min/max radius in pixels |
| `sizeScale` | `'linear' \| 'sqrt' \| 'log'` | `'sqrt'` | Size scaling function |
| `colorField` | `string` | - | Field for color encoding |
| `colorType` | `'categorical' \| 'continuous'` | `'continuous'` | Color encoding mode |
| `colorRange` | `string[]` | Sequential token scale | Token or hex colors |
| `projection` | `ProjectionType` | From context | Override container projection |
| `cluster` | `{ enabled: boolean; radius: number; minPoints: number }` | Disabled | Grid-based clustering configuration |
| `onPointClick` | `(datum) => void` | - | Click handler for individual points |
| `onPointHover` | `(datum) => void` | - | Hover handler for individual points |
| `onClusterClick` | `(points) => void` | - | Click handler for clusters |
| `preferredRenderer` | `'svg' \| 'vega-lite' \| 'echarts'` | `'svg'` | Rendering backend |

## Size Scales

- **sqrt (default)**: perceptually accurate for area encoding; use for population or revenue.
- **linear**: direct radius mapping; use for small numeric ranges.
- **log**: compresses wide ranges; use for heavy-tailed distributions.

```tsx
<BubbleMap
  sizeField="population"
  sizeScale="sqrt"
  sizeRange={[6, 32]}
  {...commonProps}
/>;
```

## Color Encoding

- **Categorical**: map discrete categories to palette entries.
- **Continuous**: interpolate across a sequential scale for numeric values.

```tsx
// Categorical
<BubbleMap
  colorField="severity"
  colorType="categorical"
  colorRange={[
    'var(--sys-status-success-fg)',
    'var(--sys-status-warning-fg)',
    'var(--sys-status-danger-fg)',
  ]}
  {...commonProps}
/>;
```

## Clustering

Enable clustering to group dense areas and declutter the map.

```tsx
<BubbleMap
  cluster={{ enabled: true, radius: 18, minPoints: 3 }}
  {...commonProps}
/>;
```

- Uses deterministic grid-based clustering.
- `radius` is in pixels (screen space).
- Cluster bubble shows total count and exposes `onClusterClick(points)` callback.

## Accessibility

- Points and clusters are keyboard focusable (`tabIndex=0`) and expose descriptive `aria-label`s.
- `<title>` and `<desc>` convey map intent and narrative.
- Integrates with `SpatialContainer` table fallback for screen-reader browsing.
- WCAG 2.1 AA guardrails: focus ring uses `--sys-focus-ring`; colors should be token-based.

## Performance Tips

- Use clustering for datasets > 500 points.
- Prefer `sqrt` size scaling to avoid oversized bubbles at large ranges.
- Provide `sizeRange` that keeps maximum radius under 40px to reduce overlap.
- For external renderers, prefer `preferredRenderer="vega-lite"` when embedding in docs and `preferredRenderer="echarts"` for highly interactive dashboards.
