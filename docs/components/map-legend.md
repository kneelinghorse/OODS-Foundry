# MapLegend Component

Legend for spatial visualizations supporting continuous gradients, categorical swatches, and bubble size examples.

## When to Use
- Display color or size encoding for ChoroplethMap and BubbleMap
- Reinforce thresholds or quantiles in a choropleth
- Provide size reference for proportional symbol maps

## Props
- `colorScale`: `{ type: 'continuous' | 'categorical'; scale; label?; format? }`
- `sizeScale`: `{ scale; label?; format? }`
- `position`: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
- `orientation`: `'horizontal' | 'vertical'`

## Usage
```tsx
import { MapLegend } from '@/components/viz/spatial/MapLegend';
import { createLinearScale } from '@/components/viz/spatial/utils/color-scale-utils';
import { createLinearSizeScale } from '@/components/viz/spatial/utils/size-scale-utils';

const colorScale = createLinearScale([0, 100], [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-07)',
]);
const sizeScale = createLinearSizeScale([1_000, 100_000], [6, 30]);

<MapLegend
  colorScale={{ type: 'continuous', scale: colorScale, label: 'Rate per 100k' }}
  sizeScale={{ scale: sizeScale, label: 'Population' }}
  position="bottom-right"
  orientation="vertical"
/>;
```

## Accessibility
- Uses semantic lists for swatches and text labels for gradient endpoints
- Supports keyboard focus through parent container; no interactive controls inside
- Color tokens use `--oods-` prefixed variables for theme compliance

## Testing
- Ensure gradient renders and labels show min/max values
- Categorical legends list correct swatches and labels
- Size legend renders three reference circles with readable labels
