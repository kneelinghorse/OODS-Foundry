# SpatialContainer

Root container component for spatial/geographic visualizations that manages projection state, layer ordering, and accessibility context.

## Overview

`SpatialContainer` is the foundational component for all spatial visualizations in OODS Foundry. It provides:

- **Projection Management**: Handles geographic coordinate transformations using d3-geo
- **Layer Ordering**: Manages z-index ordering for multiple visualization layers
- **Accessibility Context**: Provides ARIA attributes, keyboard navigation, and table fallbacks
- **State Management**: Supplies `SpatialContext` to child components

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `spec` | `SpatialSpec` | Yes | Spatial visualization specification |
| `geoData` | `FeatureCollection` | Yes | GeoJSON feature collection |
| `data` | `DataRecord[]` | No | Tabular data to join with geo features |
| `width` | `number` | Yes | Container width in pixels |
| `height` | `number` | Yes | Container height in pixels |
| `projection` | `ProjectionType` | No | Projection type override |
| `projectionConfig` | `ProjectionConfig` | No | Projection configuration override |
| `layers` | `SpatialLayer[]` | No | Layer configurations override |
| `a11y` | `A11yConfig` | Yes | Accessibility configuration |
| `onFeatureClick` | `(feature, datum) => void` | No | Feature click handler |
| `onFeatureHover` | `(feature, datum) => void` | No | Feature hover handler (passes `null` when focus clears) |
| `children` | `ReactNode` | No | Child components to render |

### A11y Config

```typescript
interface A11yConfig {
  description: string;
  ariaLabel?: string;
  tableFallback?: {
    enabled: boolean;
    caption: string;
    columns?: string[];
  };
  narrative?: {
    summary: string;
    keyFindings: string[];
  };
}
```

## Usage

### Basic Example

```tsx
import { SpatialContainer } from '@/components/viz/spatial';
import type { SpatialSpec } from '@/types/viz/spatial';
import type { FeatureCollection } from 'geojson';

const spec: SpatialSpec = {
  type: 'spatial',
  name: 'My Map',
  data: { values: [] },
  projection: { type: 'mercator' },
  layers: [
    {
      type: 'regionFill',
      encoding: { color: { field: 'value' } },
    },
  ],
  a11y: {
    description: 'A map showing geographic data',
    ariaLabel: 'My Map',
  },
};

const geoData: FeatureCollection = {
  type: 'FeatureCollection',
  features: [/* ... */],
};

<SpatialContainer
  spec={spec}
  geoData={geoData}
  width={800}
  height={600}
  a11y={{ description: 'A map showing geographic data' }}
>
  {/* Child components that use SpatialContext */}
</SpatialContainer>
```

### With Projection Override

```tsx
<SpatialContainer
  spec={spec}
  geoData={geoData}
  width={800}
  height={600}
  projection="albersUsa"
  projectionConfig={{
    type: 'albersUsa',
    scale: 1000,
  }}
  a11y={{ description: 'US map with Albers USA projection' }}
/>
```

### With Table Fallback

```tsx
<SpatialContainer
  spec={spec}
  geoData={geoData}
  width={800}
  height={600}
  data={[
    { state: 'CA', value: 100 },
    { state: 'TX', value: 200 },
  ]}
  a11y={{
    description: 'Map with accessible table fallback',
    tableFallback: {
      enabled: true,
      caption: 'State Data',
      columns: ['state', 'value'],
    },
  }}
/>
```

## Context Value

Child components can access spatial context using the `useSpatialContext` hook:

```tsx
import { useSpatialContext } from '@/components/viz/spatial';

function MyMapLayer() {
  const {
    projection,
    dimensions,
    layers,
    a11y,
    features,
    joinedData,
    handleFeatureClick,
    handleFeatureHover,
    hoveredFeature,
    selectedFeature,
  } = useSpatialContext();

  // Use context values...
}
```

### Context Properties

- `projection`: Current projection configuration
- `dimensions`: Container dimensions { width, height }
- `layers`: Ordered layer configurations
- `a11y`: Accessibility configuration
- `features`: GeoJSON features
- `joinedData`: Map of feature ID to joined data record
- `project`: Projection function mapping `[lon, lat]` to screen coordinates
- `bounds`: Geographic bounds [[minLon, minLat], [maxLon, maxLat]]
- `handleFeatureClick`: Function to trigger feature click
- `handleFeatureHover`: Function to trigger feature hover
- `hoveredFeature`: ID of currently hovered feature
- `selectedFeature`: ID of currently selected feature

## Accessibility Features

### ARIA Attributes

- `role="application"`: Indicates interactive map component
- `aria-label`: Descriptive label for the map
- `aria-describedby`: References description element

### Keyboard Navigation

- **Tab**: Focus the map container
- **Arrow Keys**: Navigate between features (looped order)
- **Enter/Space**: Activate focused feature
- **Escape**: Clear selection and focus
- **+ / -**: Announces zoom intent for assistive tech

### Screen Reader Support

- Hidden description element with full narrative
- Live region announcements for keyboard navigation and selections
- Table fallback option for non-visual access
- Dynamic ARIA labels for feature interactions

### Table Fallback

When `a11y.tableFallback.enabled` is `true`, a data table is rendered below the map showing:

- Feature names/IDs
- Joined data values (if provided)
- Proper table semantics with `<caption>`, `<thead>`, `<tbody>`

## Projection Types

Supported projection types (from d3-geo):

- `mercator` (default)
- `albersUsa`
- `equalEarth`
- `orthographic`
- `conicEqualArea`
- `conicConformal`
- `azimuthalEqualArea`
- `azimuthalEquidistant`
- `gnomonic`
- `stereographic`
- `naturalEarth1`
- `equirectangular`

## Layer Management

Layers are automatically ordered by `zIndex` with stable sorting for deterministic output. Lower z-index values render first (behind higher values).

## Loading and Error States

The container automatically handles:

- **Loading**: Displays "Loading map data..." message
- **Error**: Displays error message with `role="alert"`

These states are managed by the `useSpatialSpec` hook based on geo data resolution.

## Examples

See Storybook stories in `src/components/viz/spatial/SpatialContainer.stories.tsx` for:

- Default usage
- Different projection types
- Multiple layers
- Full accessibility features
- Loading and error states

## Related Components

- `SpatialContext`: Context provider for spatial state
- `useSpatialContext`: Hook to access spatial context
- `useSpatialSpec`: Hook for processing spatial specs
- `useSpatialProjection`: Hook for projection calculations

## See Also

- [Spatial Visualization Architecture](../../../cmos/foundational-docs/data-viz-part2/spatial-module/ARCHITECTURE.md)
- [Accessibility Guidelines](../../viz/accessibility-checklist.md)
- [Normalized Viz Spec](../../viz/normalized-viz-spec.md)
