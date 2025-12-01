# Spatial Accessibility Guide

Accessibility requirements for spatial visualizations (ChoroplethMap, BubbleMap, RouteMap) and supporting components (MapLegend, MapControls, AccessibleMapFallback).

## Keyboard Navigation
- Focus lands on the map container (`role="application"`, `tabIndex=0`)
- Arrow keys cycle through features; Enter/Space selects; Escape clears selection
- `+` / `-` zoom; layer toggles remain keyboard accessible
- `setupKeyboardNav` manages key handling and focus updates

## Screen Reader Announcements
- Live regions created via `createLiveRegion` (`polite` for focus, `assertive` for layer changes)
- `announceRegionFocus(feature, datum, total)` → “{name}: {value} {unit}. Rank {rank} of {total}.”
- `announceLayerChange(layer, count)` → “Now showing {layer} layer with {count} features.”
- MapControls uses announcements when layers toggle; SpatialContainer announces focus and selection

## Accessible Fallback
- Always provide `AccessibleMapFallback` when `spec.a11y.tableFallback.enabled` is true
- Table requirements: `<caption>`, `<th scope="col">`, `aria-sort` on headers, visible focus styles
- Narrative: summary plus 2-3 key findings mirroring chart insight

## Color & Token Use
- Only use `--oods-` prefixed tokens for fills, strokes, and gradients
- Avoid color-only encoding; use legends and numeric labels where possible
- Ensure minimum contrast: 4.5:1 for text, 3:1 for UI controls

## Testing Checklist
- Run `pnpm test tests/components/viz/spatial/Map*.test.tsx`
- Validate keyboard paths (Tab, arrows, Enter, Escape, +/-)
- Check live region updates in `keyboard-nav.test.tsx`
- Verify AccessibleMapFallback sorts and narrates correctly
- Include story coverage with real GeoJSON/TopoJSON data
