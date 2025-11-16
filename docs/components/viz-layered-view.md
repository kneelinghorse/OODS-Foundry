# VizLayeredView

Component path: `src/components/viz/VizLayeredView.tsx`

## Overview

`VizLayeredView` renders normalized specs that stack multiple marks with the
`LayoutLayer` trait. The component:

- Delegates chart drawing to Vega-Lite using the normalized spec.
- Surfaces a shared legend and narrative description in the side rail.
- Provides a standard `AccessibleTable` fallback plus a layer summary list so
  each mark can be reviewed without sight of the chart.
- Uses the grid-navigation helper so arrow keys move between layer summary
  cards.

## Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `spec` | `NormalizedVizSpec` | — | Layered visualization spec. |
| `renderer` | `'svg' \| 'canvas'` | `svg` | Renderer mode for `vega-embed`. |
| `minHeight` | `number` | `360` | Minimum chart height in pixels. |
| `showDescription` | `boolean` | `true` | Renders `ChartDescription`. |
| `showLegend` | `boolean` | `true` | Renders `SharedLegend`. |
| `showTable` | `boolean` | `true` | Toggles the `AccessibleTable` fallback. |
| `enableKeyboardNavigation` | `boolean` | `true` | Enables keyboard focus for layer cards/table rows. |

## Accessibility

- Announces rendering failures and keeps the chart container hidden when errors
  occur.
- Layer cards include ARIA labels (`"Layer name, layer X of Y"`) and obey a
  roving focus model for arrow keys, Home, and End.
- Warns when a spec omits `LayoutLayer` metadata so users understand why cards
  are based on best-effort inference.

## Testing

Automated coverage lives in:

- `tests/components/viz/VizLayeredView.test.tsx`
- `tests/components/viz/VizLayeredView.a11y.test.tsx`

These tests assert both rendering and accessibility guardrails.
