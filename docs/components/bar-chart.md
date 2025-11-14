# Bar Chart Component

## Overview

`<BarChart>` is the first production visualization component in OODS Foundry. It consumes a `NormalizedVizSpec`, converts it to a Vega-Lite specification, renders the interactive chart, and surfaces the required two-part accessibility baseline (narrative + table) from RDV.4.

The chart is composed of four building blocks:

1. **`BarChart`** – orchestrates Vega-Lite rendering and wires accessibility fallbacks
2. **`VizContainer`** – shared wrapper that handles layout, ARIA wiring, and metadata
3. **`ChartDescription`** – renders the narrative summary + key findings
4. **`AccessibleTable`** – generates a semantic `<table>` from spec data or shows a fallback note

## Usage

```tsx
import type { NormalizedVizSpec } from '@oods/viz';
import { BarChart } from '@oods/components';

const spec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'example:viz:bar',
  name: 'MRR by Region',
  data: {
    values: [
      { region: 'North', mrr: 120000 },
      { region: 'East', mrr: 98000 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', title: 'Region' },
        y: { field: 'mrr', trait: 'EncodingPositionY', channel: 'y', aggregate: 'sum', title: 'MRR (USD)' },
        color: { field: 'region', trait: 'EncodingColor', channel: 'color' },
      },
    },
  ],
  encoding: {
    x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', title: 'Region' },
    y: { field: 'mrr', trait: 'EncodingPositionY', channel: 'y', aggregate: 'sum', title: 'MRR (USD)' },
    color: { field: 'region', trait: 'EncodingColor', channel: 'color' },
  },
  config: {
    layout: { width: 560, height: 340, padding: 16 },
    theme: 'brand-a',
  },
  a11y: {
    description: 'Bar chart comparing monthly revenue by region.',
    ariaLabel: 'MRR by region bar chart',
    narrative: {
      summary: 'West leads, East trails.',
      keyFindings: ['West: $120k', 'East: $98k'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Revenue by region table',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['region', 'mrr'],
    preferredRenderer: 'vega-lite',
  },
};

<BarChart spec={spec} />;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spec` | `NormalizedVizSpec` | — | Normalized visualization spec produced by the trait engine (must contain at least one `MarkBar`). |
| `renderer` | `'svg' \| 'canvas'` | `'svg'` | Rendering mode passed to `vega-embed`. SVG is preferred for crisp typography + accessibility tooling. |
| `showTable` | `boolean` | `true` | Toggles the `AccessibleTable` fallback. Set to `false` only when a higher-level layout already renders its own table. |
| `showDescription` | `boolean` | `true` | Toggles the `ChartDescription` panel. When disabled, ensure an equivalent narrative still exists elsewhere in the view. |
| `className` | `string` | — | Additional classes applied to the `VizContainer` root. |
| `...rest` | `HTMLAttributes<HTMLElement>` | — | Spread onto the `VizContainer` so consumers can add data attributes or refs. |

## Supporting Components

### VizContainer
- Wraps every viz component in a consistent surface.
- Sets `role="group"`, `aria-labelledby`, and `aria-describedby` based on the spec + child slots.
- Renders chart + supporting content in a responsive grid and exposes `data-viz-spec` for telemetry hooks.

### ChartDescription
- Reads `spec.a11y.narrative` and `spec.a11y.description`.
- Surfaces a summary paragraph, bullet list of key findings, and the long-form description.
- Lives in the metadata column so it is always visible alongside the chart.

### AccessibleTable
- Generates `<table>` markup from `spec.data.values`.
- Uses `spec.portability.tableColumnOrder` when provided, otherwise infers fields from the dataset.
- Derives column labels from encoding titles/legends; falls back to humanized field names.
- Produces a caption from `spec.a11y.tableFallback.caption`.
- When inline values are missing or `enabled === false`, surfaces a note instead of rendering an empty `<table>`.

## Accessibility

- Charts are wrapped in `VizContainer` which exposes either `aria-label` (from `spec.a11y.ariaLabel`) or `aria-labelledby` referencing the visible title.
- The interactive Vega-Lite canvas is marked `aria-hidden="true"`; assistive tech uses the description + data table instead.
- `ChartDescription` fulfills RDV.4’s narrative/analysis requirement and keeps findings navigable via standard semantics.
- `AccessibleTable` guarantees semantic table markup with captions, headers (`<th scope="col">`), and predictable column ordering.
- Axe coverage lives in `tests/components/viz/BarChart.a11y.test.tsx` and blocks regressions in CI.

## Testing

- Unit tests (`tests/components/viz/BarChart.test.tsx`) mock `vega-embed` and assert:
  - The adapter is invoked
  - Column headers + captions render from the spec
  - Missing inline values produce a helpful fallback message
- Accessibility tests (`tests/components/viz/BarChart.a11y.test.tsx`) run `vitest-axe` to ensure the composed surface stays WCAG 2.2 AA compliant.

## Storybook Coverage

`stories/viz/BarChart.stories.tsx` includes five curated specs (simple, grouped, stacked, temporal, sorted) to exercise sizing, layering, and encoding combinations. Each story automatically renders the accessible description + table.

## Notes & Follow-ups

- The component depends on `vega` + `vega-embed` 7.x to render Vega-Lite 6 specs.
- Future chart types (line, area, scatter) should reuse `VizContainer`, `ChartDescription`, and `AccessibleTable` without duplicating layout or accessibility logic.
