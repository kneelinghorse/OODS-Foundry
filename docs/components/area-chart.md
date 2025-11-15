# Area Chart Component

## Overview

`<AreaChart>` renders continuous magnitude over time (or ordered categories) and brings the RDV.4 accessibility trio along for the ride. The component composes the normalized viz spec with the new stack transform so multi-series payloads gain deterministic cumulative bands regardless of renderer. Key capabilities include:

- **Stack transform support** – `type: 'stack'` transforms are executed before rendering, producing cumulative start/end fields for Vega-Lite and stack metadata for ECharts. Mixed-positive/negative data keeps a zero baseline.
- **Dual renderers** – Auto-selects Vega-Lite for temporal specs and falls back to ECharts when requested (or when `renderer="echarts"`). Both respect stack metadata, tooltip traits, and highlight interactions.
- **Motion guardrails** – Applies opacity transitions using motion tokens when data resolves, but automatically disables animation when `prefers-reduced-motion` is set or `animate={false}`.
- **Accessibility surfaces** – Ships with `ChartDescription` (narrative) and `AccessibleTable` (series/dimension columns). Table rows can expose keyboard navigation for dense datasets.

## Usage

```tsx
import type { NormalizedVizSpec } from '@oods/viz';
import { AreaChart } from '@oods/components';

const stackedSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'example:viz:area:stacked',
  name: 'Channel Revenue Mix',
  data: {
    values: [
      { month: '2025-08', channel: 'Self-Serve', revenue: 520 },
      { month: '2025-08', channel: 'Sales', revenue: 340 },
      { month: '2025-09', channel: 'Self-Serve', revenue: 560 },
      { month: '2025-09', channel: 'Sales', revenue: 370 },
      { month: '2025-10', channel: 'Self-Serve', revenue: 610 },
      { month: '2025-10', channel: 'Sales', revenue: 420 },
    ],
  },
  transforms: [
    { type: 'calculate', params: { field: 'month', format: '%Y-%m' } },
    {
      type: 'stack',
      params: {
        stack: 'revenue',
        groupby: ['month'],
        sort: [{ field: 'channel', order: 'ascending' }],
        as: ['stack_start', 'stack_end'],
      },
    },
  ],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
        y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Revenue ($k)' },
        color: { field: 'channel', trait: 'EncodingColor', channel: 'color', legend: { title: 'Channel' } },
      },
      options: { baseline: 'zero', stack: 'revenue', curve: 'monotone' },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
    y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Revenue ($k)' },
    color: { field: 'channel', trait: 'EncodingColor', channel: 'color', legend: { title: 'Channel' } },
  },
  config: { theme: 'brand-a', layout: { width: 720, height: 360, padding: 24 } },
  a11y: {
    description: 'Stacked area chart showing how self-serve and sales channels contribute to total revenue.',
    ariaLabel: 'Channel revenue stacked area chart',
    narrative: { summary: 'Self-serve gains outpace sales growth entering October.', keyFindings: ['Sales climbs 80k', 'Self-serve adds 90k over the window'] },
    tableFallback: { enabled: true, caption: 'Monthly revenue by channel' },
  },
  portability: { fallbackType: 'table', tableColumnOrder: ['month', 'channel', 'revenue'] },
};

<AreaChart spec={stackedSpec} renderer="auto" />;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `NormalizedVizSpec` | — | Normalized spec with `MarkArea` and optional `stack` transform. |
| `renderer` | `'auto' \| 'vega-lite' \| 'echarts'` | `'auto'` | Forces a renderer or defers to `selectVizRenderer` heuristics (temporal → Vega-Lite). |
| `vegaRenderer` | `'svg' \| 'canvas'` | `'svg'` | Forwarded to `vega-embed` when Vega-Lite is selected. |
| `echartsRenderer` | `'canvas' \| 'svg'` | `'canvas'` | Renderer passed to `echarts.init`. |
| `showTable` | `boolean` | `true` | Toggles the `AccessibleTable` fallback. |
| `showDescription` | `boolean` | `true` | Toggles the narrative panel (`ChartDescription`). |
| `responsive` | `boolean` | `true` | Enables width measurement via `ResizeObserver`; height preserves the ratio defined in `spec.config.layout`. |
| `minHeight` | `number` | `320` | Floor applied to the chart surface when responsive mode is active. |
| `animate` | `boolean` | `true` | Controls the opacity ramp once the renderer is ready. Automatically ignored when `prefers-reduced-motion` is true. |
| `enableKeyboardNavigation` | `boolean` | `true` | Adds `tabIndex` + row summaries to the table fallback for keyboard traversal. |

## Stack Transform Semantics

- Declare a `type: 'stack'` transform to opt into cumulative behaviour. The adapter looks for `params.stack` (measure field), `params.groupby` (dimension), optional `params.sort`, and `params.as` for start/end field names. Example:

```json
{
  "type": "stack",
  "params": {
    "stack": "revenue",
    "groupby": ["month"],
    "sort": [{ "field": "segment", "order": "ascending" }],
    "as": ["stack_start", "stack_end"]
  }
}
```

- Vega-Lite receives the derived `stack_start`/`stack_end` fields to drive `y`/`y2`, guaranteeing consistent stacking even when Vega’s defaults change.
- ECharts receives the same inline data plus a synthesized `series.stack` name so the renderer accumulates values without additional authoring.
- Negative values receive their own accumulator so the zero baseline stays intact.

## Renderer Behaviour

- **Vega-Lite**: responsive width/height overrides keep axes crisp. Motion is a simple opacity ramp controlled by motion tokens and suppressed when reduced-motion is active.
- **ECharts**: instances are initialized with `useDirtyRect` for better performance and resize whenever the responsive observer fires. Stack metadata automatically sets `series.stack` and `yAxis.min` respects the `baseline` specified in the mark options (`'zero'` or `'min'`).

## Accessibility

- The rendered chart remains `aria-hidden`; screen readers rely on `VizContainer`’s `aria-label`, the narrative summary, and the data table.
- `AccessibleTable` surfaces the dimension (`groupby` field), series (color channel), and measure columns. When `enableKeyboardNavigation` is true, rows receive `tabIndex=0` plus a synthesized `aria-label` that describes the point.
- Stack transform guardrails satisfy RDV.4’s requirement that stacked charts expose the baseline range in fallback tables.

## Testing & Guardrails

- Unit tests live in `tests/components/viz/AreaChart.test.tsx` and cover renderer selection, stack encoding, and motion toggles.
- Accessibility coverage is enforced with `tests/components/viz/AreaChart.a11y.test.tsx`.
- The stack transform algorithm itself is covered by `tests/viz/stack-transform.test.ts`.
- When adding new specs, run `pnpm test --filter AreaChart` (or `pnpm local:pr-check`) to verify vitest + axe coverage plus `pnpm storybook` to review the Storybook variants: **Single**, **Stacked**, **Overlapping**, and **WithGaps**.
