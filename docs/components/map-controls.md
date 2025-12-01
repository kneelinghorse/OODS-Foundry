# MapControls Component

Interactive zoom and layer toggles for spatial visualizations. Designed to pair with `SpatialContainer`, `ChoroplethMap`, and `BubbleMap`.

## When to Use
- Provide zoom/reset controls for keyboard and pointer users
- Allow users to toggle map layers (regions, symbols, routes)
- Surface current zoom level in an accessible way

## Props
- `onZoomIn`, `onZoomOut`, `onZoomReset`
- `zoomLevel`, `minZoom`, `maxZoom`
- `layers`: `{ id, label, visible }[]`
- `onLayerToggle(layerId, visible)`
- `position`: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`

## Usage
```tsx
import { MapControls } from '@/components/viz/spatial/MapControls';

const layers = [
  { id: 'regions', label: 'Regions', visible: true },
  { id: 'symbols', label: 'Symbols', visible: true },
];

<MapControls
  onZoomIn={() => map.zoomIn()}
  onZoomOut={() => map.zoomOut()}
  onZoomReset={() => map.resetZoom()}
  zoomLevel={1.0}
  minZoom={0.5}
  maxZoom={4}
  layers={layers}
  onLayerToggle={(id, visible) => toggleLayer(id, visible)}
  position="top-right"
/>;
```

## Accessibility
- Buttons expose `aria-label` for zoom actions and reset
- Layer toggles use native checkboxes with focus ring styles
- Layer changes announce via live region (`announceLayerChange`)
- Keyboard: Tab to focus, Enter/Space to activate buttons and toggles

## Testing
- Zoom buttons call provided handlers and update displayed zoom level
- Layer toggles update visibility state and fire `onLayerToggle`
- Buttons and checkboxes have visible focus outlines and `aria-label`
