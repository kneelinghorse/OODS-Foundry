# Line Chart Component

## Overview

`<LineChart>` extends the visualization surface introduced by `<BarChart>` to address temporal data. It accepts a `NormalizedVizSpec`, converts it to a Vega-Lite spec, and renders the interactive chart alongside the RDV.4 accessibility trio (narrative description + data table). The component adds two key capabilities for time-series work:

1. **Responsive sizing** – watches the available width via `ResizeObserver`, recomputes the width/height ratio, and re-renders Vega-Lite without jitter. This keeps sparklines, cards, and dashboards consistent without manual width math.
2. **Motion with reduced-motion support** – fades the chart in when the spec is ready, but automatically removes the animation when `prefers-reduced-motion` is set or when `animate={false}`.

As with other viz components, it delegates layout and ARIA wiring to `VizContainer`, `ChartDescription`, and `AccessibleTable`.

## Usage

```tsx
import type { NormalizedVizSpec } from '@oods/viz';
import { LineChart } from '@oods/components';

const temporalSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'example:viz:line',
  name: 'Latency P95 (24h)',
  data: {
    values: [
      { timestamp: '2025-11-14T00:00:00Z', latency: 182 },
      { timestamp: '2025-11-14T04:00:00Z', latency: 175 },
      { timestamp: '2025-11-14T08:00:00Z', latency: 164 },
    ],
  },
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: { field: 'timestamp', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'UTC timestamp' },
        y: { field: 'latency', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Latency (ms)' },
      },
      options: {
        curve: 'monotone',
        point: { filled: true },
      },
    },
  ],
  encoding: {
    x: { field: 'timestamp', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'UTC timestamp' },
    y: { field: 'latency', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Latency (ms)' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 320, padding: 20 },
  },
  a11y: {
    description: 'Latency gradually improves during off-peak hours before spiking again near 20:00 UTC.',
    ariaLabel: 'Latency over time line chart',
    narrative: {
      summary: 'Latency dips below 160 ms for most of the window but pops back above 170 ms late in the day.',
      keyFindings: ['Peak at 182 ms', 'Floor at 155 ms'],
    },
    tableFallback: { enabled: true, caption: 'Latency readings' },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['timestamp', 'latency'],
  },
};

<LineChart spec={temporalSpec} renderer="svg" />;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `NormalizedVizSpec` | — | Temporal spec produced by the trait engine (must declare at least one `MarkLine`). |
| `renderer` | `'svg' \| 'canvas'` | `'svg'` | Rendering mode passed to `vega-embed`. SVG keeps typography sharp and plays best with accessibility tooling. |
| `showTable` | `boolean` | `true` | Toggles the `AccessibleTable` fallback. Disable only when a higher-level surface already renders an equivalent table. |
| `showDescription` | `boolean` | `true` | Toggles the `ChartDescription` panel. When disabled, ensure the narrative is still surfaced elsewhere. |
| `responsive` | `boolean` | `true` | Enables automatic width/height recalculation via `ResizeObserver`. Set to `false` when embedding inside fixed-width exports. |
| `animate` | `boolean` | `true` | Controls the fade-in transition. Automatically ignored when `prefers-reduced-motion` is set. |
| `minHeight` | `number` | `320` | Floor applied when deriving responsive heights. Useful when rendering small multiples in constrained layouts. |
| `className` | `string` | — | Additional classes applied to the `VizContainer` root. |
| `...rest` | `HTMLAttributes<HTMLElement>` | — | Forwarded to `VizContainer` for data attributes, refs, etc. |

## Responsive Behaviour

- A `ResizeObserver` watches the chart wrapper and stores the latest width.
- The Vega-Lite spec is regenerated whenever the width or aspect ratio changes so Vega can recompute scales cleanly.
- Height is derived from the `spec.config.layout` ratio and clamped by `minHeight` to prevent collapsed canvases.
- When `ResizeObserver` is unavailable (legacy agents, SSR), the component falls back to the width in the spec.

## Motion & Reduced Motion

- When `animate` is `true`, the chart fades in once Vega finishes rendering. This uses Tailwind transitions backed by motion tokens.
- `useReducedMotion` (shared with the overlay manager) automatically disables the transition when the OS requests reduced motion.
- Set `animate={false}` to skip the effect altogether (useful for deterministic screenshots or VRT baselines).

## Accessibility

- `VizContainer` wires `aria-label`/`aria-labelledby` using `spec.a11y`.
- The rendered Vega output stays `aria-hidden`; assistive tech relies on the narrative + table.
- `ChartDescription` surfaces the summary + key findings declared in the spec, satisfying RDV.4’s narrative requirement.
- `AccessibleTable` mirrors inline data and orders columns using `spec.portability.tableColumnOrder`.
- Axe coverage lives in `tests/components/viz/LineChart.a11y.test.tsx`.

## Testing

- Unit tests (`tests/components/viz/LineChart.test.tsx`) mock `vega-embed`, verify the data table renders, ensure responsive width overrides propagate to Vega, and confirm that reduced-motion mode removes the transition classes.
- Accessibility tests (`tests/components/viz/LineChart.a11y.test.tsx`) run `vitest-axe` to guard against regressions in the composed surface.

## Storybook Coverage

`stories/viz/LineChart.stories.tsx` includes four curated specs:

1. **SimpleTrend** – baseline single-series temporal trend.
2. **SegmentedTrend** – multi-series line chart with categorical color.
3. **BenchmarkVsTarget** – compares actual vs target series.
4. **ResponsivePlayground** – interactive story that lets designers resize the container and observe the responsive behaviour/motion ramp.

## Notes

- The component shares the same error overlay as `<BarChart>` to surface adapter failures.
- Future enhancements (confidence intervals, banded areas) can extend the same responsive + motion scaffolding without revisiting accessibility fallbacks.
