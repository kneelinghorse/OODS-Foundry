# ChoroplethMap Component

**Primary spatial visualization component for regional comparisons with color encoding.**

## Overview

The ChoroplethMap component renders filled geographic regions (countries, states, counties) with colors representing data values. It's the most common spatial visualization pattern in B2B SaaS dashboards for showing regional metrics like sales, population, or performance.

## Features

- ✅ Multiple color scale types (quantize, quantile, threshold, linear)
- ✅ Keyboard accessible (Tab navigation, Enter/Space to select)
- ✅ Fully responsive with projection auto-fitting
- ✅ Hover and click interactions
- ✅ Design token integration for colors
- ✅ WCAG 2.1 AA compliant
- ✅ SVG rendering with future ECharts/Vega-Lite support

## Installation

```typescript
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer';
```

## Basic Usage

```tsx
import { ChoroplethMap } from '@/components/viz/spatial/ChoroplethMap';
import { SpatialContainer } from '@/components/viz/spatial/SpatialContainer';
import type { SpatialSpec } from '@/types/viz/spatial';

const data = [
  { state: 'CA', population: 39538223 },
  { state: 'TX', population: 29145505 },
  { state: 'NY', population: 20201249 },
];

const spec: SpatialSpec = {
  type: 'spatial',
  data: { values: data },
  projection: { type: 'albersUsa', fitToData: true },
  layers: [
    {
      type: 'regionFill',
      encoding: { color: { field: 'population' } },
    },
  ],
  a11y: {
    description: 'US Population by State',
  },
};

function PopulationMap() {
  return (
    <SpatialContainer
      spec={spec}
      geoData={usStatesGeoJSON}
      width={800}
      height={600}
      a11y={{ description: 'US Population Map' }}
      data={data}
    >
      <ChoroplethMap
        data={data}
        valueField="population"
        geoJoinKey="state"
        a11y={{ description: 'US Population by State' }}
      />
    </SpatialContainer>
  );
}
```

## Props Reference

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `DataRecord[]` | Array of data records with values to visualize |
| `valueField` | `string` | Field name in data containing numeric values |
| `geoJoinKey` | `string` | Field name in GeoJSON properties to join on |
| `a11y` | `ChoroplethA11yConfig` | Accessibility configuration |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dataJoinKey` | `string` | Same as `geoJoinKey` | Field name in data to join on |
| `colorScale` | `'quantize' \| 'quantile' \| 'threshold' \| 'linear'` | `'quantize'` | Color scale type |
| `colorRange` | `string[]` | Sequential blue scale | Array of colors (tokens or hex) |
| `thresholds` | `number[]` | - | Custom thresholds (required for threshold scale) |
| `projection` | `ProjectionType` | From container | Override container projection |
| `fitToData` | `boolean` | `false` | Fit projection to data bounds |
| `onRegionClick` | `(feature, datum) => void` | - | Click handler |
| `onRegionHover` | `(feature, datum) => void` | - | Hover handler |
| `preferredRenderer` | `'svg' \| 'echarts' \| 'vega-lite'` | `'svg'` | Rendering backend |

## Color Scale Options

### When to Use Each Scale

| Scale | Use Case | Example |
|-------|----------|---------|
| **Quantize** | Uniformly distributed data | Temperature, evenly distributed metrics |
| **Quantile** | Skewed data distributions | Income, real estate prices |
| **Threshold** | Meaningful categories | Poverty rates (<5%, 5-10%, 10-20%, >20%) |
| **Linear** | Continuous gradients | Smooth color transitions |

### Quantize Scale (Equal Intervals)

Divides data domain into equal-sized intervals.

```tsx
<ChoroplethMap
  data={data}
  valueField="temperature"
  geoJoinKey="county"
  colorScale="quantize"
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'Average temperature by county' }}
/>
```

### Quantile Scale (Equal Count)

Ensures equal number of data points in each color class. Good for skewed distributions.

```tsx
<ChoroplethMap
  data={data}
  valueField="income"
  geoJoinKey="zipcode"
  colorScale="quantile"
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'Median household income by ZIP code' }}
/>
```

### Threshold Scale (Custom Breakpoints)

Uses custom thresholds for meaningful categories.

```tsx
<ChoroplethMap
  data={data}
  valueField="unemployment_rate"
  geoJoinKey="state"
  colorScale="threshold"
  thresholds={[5, 7, 10]}
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'Unemployment rate by state' }}
/>
```

**Note:** For threshold scale, `colorRange.length` must equal `thresholds.length + 1`.

## Data Requirements

### GeoJSON Structure

GeoJSON features must have properties with join keys:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "CA",
      "properties": {
        "name": "California",
        "state": "CA",
        "fips": "06"
      },
      "geometry": { ... }
    }
  ]
}
```

### Data Structure

Data records must have:
- Join key matching GeoJSON properties
- Numeric value field for color encoding

```typescript
const data = [
  { state: 'CA', population: 39538223, name: 'California' },
  { state: 'TX', population: 29145505, name: 'Texas' },
];
```

### Handling Missing Data

Regions without matching data receive the first color in `colorRange`:

```tsx
// Only CA has data, TX/NY will get default color
const partialData = [
  { state: 'CA', value: 100 }
];

<ChoroplethMap
  data={partialData}
  valueField="value"
  geoJoinKey="state"
  a11y={{ description: 'Partial data example' }}
/>
```

## Interaction Handling

### Click Events

```tsx
function handleRegionClick(feature, datum) {
  console.log('Clicked:', feature.properties.name);
  console.log('Value:', datum?.value);

  // Show detail panel, navigate, etc.
}

<ChoroplethMap
  data={data}
  valueField="sales"
  geoJoinKey="state"
  onRegionClick={handleRegionClick}
  a11y={{ description: 'Sales by state (click for details)' }}
/>
```

### Hover Events

```tsx
function handleRegionHover(feature, datum) {
  // Show tooltip
  setTooltip({
    title: feature.properties.name,
    value: datum?.sales,
  });
}

<ChoroplethMap
  data={data}
  valueField="sales"
  geoJoinKey="state"
  onRegionHover={handleRegionHover}
  a11y={{ description: 'Sales by state (hover for details)' }}
/>
```

## Accessibility Features

### Keyboard Navigation

- **Tab**: Move focus between regions
- **Enter/Space**: Select focused region
- **Escape**: Clear selection

All regions are keyboard-focusable with visible focus rings.

### ARIA Attributes

Each region has:
- `role="button"` - Interactive element
- `aria-label` - Region name and value
- `aria-pressed` - Selection state
- `tabindex="0"` - Keyboard focusable

### Screen Reader Support

```tsx
<ChoroplethMap
  data={data}
  valueField="population"
  geoJoinKey="state"
  a11y={{
    description: 'US Population by State',
    narrative: {
      summary: 'Population distribution across US states',
      keyFindings: [
        'California has the highest population at 39.5 million',
        'Texas is second with 29.1 million',
      ],
    },
    tableFallback: {
      enabled: true,
      caption: 'US Population Data Table',
    },
  }}
/>
```

### Table Fallback

Enable table fallback for screen reader users:

```tsx
a11y={{
  description: 'Sales by Region',
  tableFallback: {
    enabled: true,
    caption: 'Regional Sales Data',
  },
}}
```

## Design Tokens

Use design tokens for color ranges:

```tsx
// Sequential (single hue)
colorRange={[
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
]}

// Diverging (two hues)
colorRange={[
  'var(--oods-viz-scale-diverging-red-4)',
  'var(--oods-viz-scale-diverging-red-2)',
  'var(--oods-viz-scale-diverging-neutral)',
  'var(--oods-viz-scale-diverging-blue-2)',
  'var(--oods-viz-scale-diverging-blue-4)',
]}
```

## Common Patterns

### US States Map

```tsx
<ChoroplethMap
  data={stateData}
  valueField="metric"
  geoJoinKey="state"
  projection="albersUsa"
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'US states metric visualization' }}
/>
```

### World Map

```tsx
<ChoroplethMap
  data={countryData}
  valueField="gdp"
  geoJoinKey="iso3"
  projection="equalEarth"
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'World GDP by country' }}
/>
```

### County/Regional Map

```tsx
<ChoroplethMap
  data={countyData}
  valueField="density"
  geoJoinKey="fips"
  projection="mercator"
  fitToData={true}
  colorScale="quantile"
  colorRange={[
    'var(--oods-viz-scale-sequential-01)',
    'var(--oods-viz-scale-sequential-03)',
    'var(--oods-viz-scale-sequential-05)',
    'var(--oods-viz-scale-sequential-07)',
  ]}
  a11y={{ description: 'Population density by county' }}
/>
```

## Performance Tips

1. **Use appropriate color class count**: 4-7 classes for most use cases
2. **Simplify GeoJSON**: Use TopoJSON or simplified geometries for large datasets
3. **Memoize data**: Prevent unnecessary recalculations

```tsx
const memoizedData = useMemo(() => processData(rawData), [rawData]);
```

## Troubleshooting

### Regions not coloring correctly

**Issue**: Some regions remain default color despite having data.

**Solution**: Verify join keys match exactly (case-sensitive):

```tsx
// GeoJSON property: "CA"
// Data key: "ca"  ❌ Won't match

// Both should be: "CA" or both "ca" ✓
```

### Threshold scale error

**Issue**: "Range length must be thresholds length + 1"

**Solution**: Ensure color range has one more color than thresholds:

```tsx
// ❌ Wrong
thresholds={[10, 20, 30]}
colorRange={['var(--oods-viz-scale-sequential-01)', 'var(--oods-viz-scale-sequential-03)', 'var(--oods-viz-scale-sequential-05)']}  // 3 colors, need 4

// ✓ Correct
thresholds={[10, 20, 30]}
colorRange={[
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
]}  // 4 colors
```

## Related Components

- **SpatialContainer** - Required wrapper providing projection context
- **BubbleMap** - Symbol/bubble layer for point data (coming in B32.2)
- **MapLegend** - Color legend component (coming in B32.3)

## Examples

See `ChoroplethMap.stories.tsx` for complete interactive examples:
- US Population by State
- World GDP by Country
- Different color scales
- Interactive maps with tooltips
- Accessible maps with table fallback

## Browser Support

- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+

Requires SVG and CSS custom properties support.
