# Heatmap Component

## Overview

`<Heatmap>` visualizes 2D categorical grids (day × hour, feature × segment, etc.) with a quantitative value encoded as sequential color intensity. The component couples the renderer surface (Vega-Lite or ECharts) with a matrix-style fallback table and sequential color legend derived from the governed `--viz-scale-sequential-*` tokens via the `color-intensity-mapper`.

- Accepts any `NormalizedVizSpec` using `MarkRect` with categorical `x/y` bindings and a quantitative `color` binding.
- Auto-selects renderer via `selectVizRenderer`; you can force either pipeline with `renderer="vega-lite"` or `"echarts"`.
- Uses the sequential color ramp both in the rendered spec (Vega-Lite range overrides + ECharts visualMap) and in the fallback legend/table so tokens stay authoritative.
- Provides a11y fallbacks beyond RDV.4 defaults: the fallback grid is a real `<table>` with column + row headers and keyboard-focusable cells, keeping values readable even if color perception differs.

## Usage

```tsx
import type { NormalizedVizSpec } from '@oods/viz';
import { useHighlight, useTooltip } from '@oods/viz';
import { Heatmap } from '@oods/components';

const highlight = useHighlight({ fields: ['day', 'hour'] });
const tooltip = useTooltip({ fields: ['day', 'hour', 'tickets'] });

const heatmapSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'example:viz:heatmap',
  name: 'Support Load by Day & Hour',
  data: {
    values: [
      { day: 'Monday', hour: '08:00', tickets: 12 },
      { day: 'Monday', hour: '12:00', tickets: 28 },
      { day: 'Tuesday', hour: '08:00', tickets: 15 },
      // …
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: { field: 'hour', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Hour of day' },
        y: { field: 'day', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Day of week' },
        color: { field: 'tickets', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Tickets' },
      },
      options: { borderRadius: 4 },
    },
  ],
  encoding: {
    x: { field: 'hour', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Hour of day' },
    y: { field: 'day', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Day of week' },
    color: { field: 'tickets', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Tickets' },
  },
  interactions: [highlight, tooltip],
  config: { theme: 'brand-a', layout: { width: 720, height: 420, padding: 24 } },
  a11y: {
    description: 'Tuesday lunch spikes above 30 tickets; Thursday mornings stay quiet.',
    ariaLabel: 'Support load heatmap',
    tableFallback: { enabled: true, caption: 'Tickets by day and hour' },
  },
  portability: { fallbackType: 'table', tableColumnOrder: ['day', 'hour', 'tickets'] },
};

<Heatmap spec={heatmapSpec} />;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `NormalizedVizSpec` | — | Must include `MarkRect` with categorical `x/y` encodings and a quantitative `color` encoding. |
| `renderer` | `'vega-lite' \| 'echarts' \| 'auto'` | `'auto'` | Force a renderer or delegate to `selectVizRenderer` (ECharts is auto-selected for large inline datasets). |
| `vegaRenderer` | `'svg' \| 'canvas'` | `'svg'` | Passed to `vega-embed`. SVG keeps gradients crisp; canvas works for ultra-dense grids. |
| `echartsRenderer` | `'canvas' \| 'svg'` | `'canvas'` | Used when the ECharts path is active. |
| `showLegend` | `boolean` | `true` | Toggles the sequential gradient legend (uses `color-intensity-mapper`). |
| `showTable` | `boolean` | `true` | Toggles the matrix fallback table. |
| `showDescription` | `boolean` | `true` | Toggles the narrative panel (`ChartDescription`). |
| `responsive` | `boolean` | `true` | Enables `ResizeObserver` width measurement for Vega-Lite and `resize()` on the ECharts instance. |
| `minHeight` | `number` | `320` | Minimum chart surface height. |
| `enableKeyboardNavigation` | `boolean` | `true` | Adds `tabIndex` + aria labels to fallback rows/cells. |

## Sequential Color Scale

`color-intensity-mapper` pulls the governed sequential tokens (`--viz-scale-sequential-01…09`) and builds:

- Vega-Lite overrides: the generated spec injects `encoding.color.scale.range = ['var(--viz-scale-sequential-01, …)', …]`.
- ECharts visualMap: heatmaps receive `{ inRange: { color: ['rgb(...)', …] } }` so the canvas renderer mirrors token colors even without CSS variables.
- Fallback legend + table backgrounds: cells use `var(--viz-scale-sequential-*, var(--oods-viz-scale-*, rgb(...)))`, giving WCAG-friendly gradients with textual values layered on top.

The mapper clamps values between the observed min/max (with safe defaults if the dataset holds a single value) and exposes normalized values to drive text color contrast (values > 60% of the range switch to `text-white`).

## Accessibility

- The chart surface is `aria-hidden`; `VizContainer` announces `spec.a11y.ariaLabel`.
- The fallback matrix renders as `<table>` with a column header (Y axis label) + row headers for each categorical row. Each data cell:
  - Includes `tabIndex={0}` when keyboard navigation is enabled.
  - Announces `"Stories completed: 18, Monday, 12:00"` style labels by combining row + column + metric label.
  - Displays the numeric value so color is never the only channel.
- When a matrix cannot be derived (missing data or encodings), `<Heatmap>` automatically falls back to the generic `AccessibleTable`.

## Testing

- Unit coverage: `tests/components/viz/Heatmap.test.tsx` (legend rendering, fallback grid semantics, ECharts wiring).
- Accessibility coverage: `tests/components/viz/Heatmap.a11y.test.tsx` (axe scan + renderer shims).

Storybook examples live under `Visualization/Heatmap` with three variants: time-of-day staffing, feature/segment correlation, and a throughput chart with annotations.
