# Scatter & Bubble Chart Components

## Overview

`<ScatterChart>` renders 2Q scatter plots with optional categorical color and size encodings, pairing the visualization surface with narrative + tabular fallbacks. `<BubbleChart>` is a thin wrapper that expects a size channel to visualize a third quantitative field. Both components:

- Accept a `NormalizedVizSpec`, inject highlight + tooltip interactions, and convert to Vega-Lite or ECharts based on the spec and data volume.
- Auto-select ECharts when datasets are large (500+ rows) or when `preferredRenderer`/`renderer="echarts"` is set, keeping hover latency smooth for 1000+ points.
- Provide RDV.4 accessibility surfaces: narrative (`ChartDescription`), table fallback (`AccessibleTable`), and keyboard-focusable data rows for point-by-point inspection.

## Usage

```tsx
import type { NormalizedVizSpec } from '@oods/viz';
import { useHighlight, useTooltip } from '@oods/viz';
import { ScatterChart, BubbleChart } from '@oods/components';

const tooltip = useTooltip({ fields: ['leadTime', 'winRate', 'pipeline'] });
const highlight = useHighlight({ fields: ['segment'] });

const scatterSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'example:viz:scatter',
  name: 'Win Rate vs Lead Time',
  data: { values: [{ leadTime: 10, winRate: 46, pipeline: 540000, segment: 'Enterprise' }, /* ... */] },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
        y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
        color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
      },
    },
  ],
  encoding: {
    x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
    y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
    color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
  },
  interactions: [highlight, tooltip],
  config: { theme: 'brand-a', layout: { width: 640, height: 380, padding: 20 } },
  a11y: {
    description: 'Shorter cycles trend toward higher win rates; color groups by segment.',
    ariaLabel: 'Win rate vs lead time scatterplot',
    narrative: { summary: 'Enterprise wins stay above 45% under 12 weeks.', keyFindings: ['Growth dips below 30% past 16 weeks'] },
    tableFallback: { enabled: true, caption: 'Opportunities by lead time, win rate, pipeline' },
  },
  portability: { fallbackType: 'table', tableColumnOrder: ['segment', 'leadTime', 'winRate', 'pipeline'] },
};

<ScatterChart spec={scatterSpec} />;
<BubbleChart spec={{ ...scatterSpec, encoding: { ...scatterSpec.encoding, size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size' } } }} />;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `NormalizedVizSpec` | — | Scatter/bubble spec with `MarkPoint` and optional `EncodingSize`/`EncodingColor`. |
| `renderer` | `'vega-lite' \| 'echarts' \| 'auto'` | `'auto'` | Selects renderer; `'auto'` delegates to `selectVizRenderer` (prefers ECharts for large datasets). |
| `vegaRenderer` | `'svg' \| 'canvas'` | `'svg'` | Forwarded to `vega-embed` when the Vega-Lite path is chosen. |
| `echartsRenderer` | `'canvas' \| 'svg'` | `'canvas'` | Passed to `echarts.init`; canvas is faster for dense point clouds. |
| `showTable` | `boolean` | `true` | Toggles the `AccessibleTable` fallback (keyboard focusable rows). |
| `showDescription` | `boolean` | `true` | Toggles the narrative panel. |
| `responsive` | `boolean` | `true` | Enables width measurement via `ResizeObserver` for Vega-Lite; ECharts resizes on observer events. |
| `minHeight` | `number` | `320` | Minimum chart surface height. |
| `enableKeyboardNavigation` | `boolean` | `true` | Adds `tabIndex` + aria labels to data rows so users can keyboard-navigate points. |

## Renderer Selection & Performance

- `selectVizRenderer` prefers ECharts when `spec.portability.preferredRenderer === 'echarts'` or when inline values exceed the default 500-row threshold, keeping hover/highlight responsive for 1000+ points.
- Vega-Lite remains the default for smaller or temporal specs (keeps SVG text crisp).
- ECharts instances use `useDirtyRect` and resize hooks; Vega-Lite specs are regenerated with measured widths to avoid blurry scales.

## Accessibility

- `ChartDescription` surfaces `spec.a11y.narrative`; the rendered chart remains `aria-hidden`.
- `AccessibleTable` orders columns via `spec.portability.tableColumnOrder` and exposes `aria-label`/`tabIndex` on rows for keyboard traversal (x/y/size columns included when provided).
- Interaction traits (highlight + tooltip) come from B22.2 hooks; tooltips respect `spec.interactions` for both renderers.

## Testing

- Unit tests: `tests/components/viz/ScatterChart.test.tsx` (renderer selection, interaction wiring, table fallback).
- Accessibility: `tests/components/viz/ScatterChart.a11y.test.tsx` (axe coverage, keyboard focus on rows).
