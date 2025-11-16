# VizFacetGrid

Component path: `src/components/viz/VizFacetGrid.tsx`

## Overview

`VizFacetGrid` renders normalized visualization specs that declare the
`LayoutFacet` trait. The component:

- Emits a single Vega-Lite scene for the complete grid.
- Surfaces a shared legend and narrative description in the side rail.
- Builds facet-aware accessible tables via
  `generateFacetTables` so each panel has a keyboard-focusable fallback.
- Provides roving focus across panels with arrow keys, Home/End, and wraps when
  the panel grid exceeds the viewport.

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `spec` | `NormalizedVizSpec` | — | Normalized visualization spec with `layout.trait === 'LayoutFacet'`. |
| `renderer` | `'svg' \| 'canvas'` | `svg` | Renderer passed to `vega-embed`. |
| `minHeight` | `number` | `360` | Minimum chart height in pixels. |
| `showDescription` | `boolean` | `true` | Renders `ChartDescription`. |
| `showLegend` | `boolean` | `true` | Renders `SharedLegend`. |
| `showTables` | `boolean` | `true` | Controls facet table fallback visibility. |
| `enableKeyboardNavigation` | `boolean` | `true` | Enables arrow-key navigation across tables. |

## Accessibility

- The container is a `<section>` with an ARIA label derived from the spec.
- Each facet fallback panel receives `tabIndex=0` when keyboard navigation is
  enabled. Arrow keys move between panels; tables retain natural semantics.
- When table fallbacks are disabled via the spec, the component surfaces a note
  explaining why no data table is available.

## Testing

Automated coverage lives in:

- `tests/components/viz/VizFacetGrid.test.tsx`
- `tests/components/viz/VizFacetGrid.a11y.test.tsx`

Use these as regression references when modifying rendering or keyboard logic.
