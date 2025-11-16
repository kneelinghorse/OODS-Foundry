# Chart & Dashboard Context Guide

Sprint 23 introduces two new view contexts that promote visualization layouts into
first-class citizens of the OODS view engine. The `chart` context wraps a single
visualization with an optional toolbar and insight rail, while the `dashboard`
context extends that pattern with a persistent mosaic and narrative sidebar.

## Layout anatomy

| Context | Regions | Layout tokens | Notes |
| --- | --- | --- | --- |
| `chart` | `globalNavigation`, `breadcrumbs`, `pageHeader`, `viewToolbar`, `main`, `contextPanel` | `--view-section-gap-detail`, `--view-main-gap-default`, `--view-columns-default`, `--view-columns-two-column-narrow` | Hero header + optional toolbar above a single visualization canvas. |
| `dashboard` | same canonical regions | `--view-section-gap-detail`, `--view-main-gap-default`, `--view-columns-default`, `--view-columns-two-column-standard` | Adds persistent grid for multi-panel arrangements and right-rail narratives. |

Both contexts emit additional `data-region-group` hooks that the shared stylesheet
(`src/styles/domain-contexts.css`) consumes:

- `data-region-group="chart-body"` / `"chart-content"`
- `data-region-group="dashboard-body"` / `"dashboard-chrome"` / `"dashboard-content"`
- `data-chart-grid="chart"` or `"dashboard"` to describe grid variants
- `data-chart-panel="<extension-id>"` for each panel node

These hooks guarantee token-driven spacing without bespoke component CSS.

## Building chart regions

Use `createChartRegionExtensions` from `src/contexts/regions/chart-regions.tsx` to emit
view extensions for hero headers, toolbars, chart panels, and insight rails.

```ts
import {
  createChartRegionExtensions,
  type ChartPanelDefinition,
} from '@/contexts/regions/chart-regions';

const panels: ChartPanelDefinition<MyRecord>[] = [
  {
    id: 'my-chart:trend',
    title: 'Trend',
    description: 'MRR trajectory',
    render: ({ data }) => <LineChart spec={data.revenueSpec} showTable={false} />,
  },
];

const trait = {
  id: 'MyDashboardPanels',
  view: () =>
    createChartRegionExtensions<MyRecord>({
      traitId: 'MyDashboardPanels',
      variant: 'dashboard',
      hero: ({ data }) => <Hero metrics={data.metrics} />,
      toolbar: () => <Filters />,
      insights: ({ data }) => <Insights items={data.notes} />,
      panels,
    }),
};
```

The helper ensures each section targets the canonical region IDs, sets metadata tags,
and annotates generated markup with `data-chart-panel` for diagnostics.

## Responsive behaviour

- `chart` context uses a single-column layout until a context rail is present, then
  switches to `--view-columns-two-column-narrow`.
- `dashboard` context cascades the same behaviour but adds an internal grid that
  uses `repeat(auto-fit, minmax(18rem, 1fr))` to auto-flow tiles.
- `data-chart-grid="dashboard"` keeps cards aligned even when the insight rail is rendered.
- `data-view-has-contextpanel="true"` toggles rail widths for both contexts automatically.

## Instrumentation & guardrails

1. Every chart panel container receives `data-chart-panel="<id>"` so diagnostics
   collectors and purity checks can trace rendered extensions back to their trait.
2. `data-chart-grid` advertises whether the helper used the single-chart or mosaic variant;
   diagnostics log this under `diagnostics.viewEngine.layouts`.
3. Keep all tokens derived from view profiles – no direct widths or colours. Components such
   as `Card`, `Text`, and the viz primitives already map back to `--cmp-*` slots.

## References

- `examples/dashboards/user-adoption.tsx`
- `examples/dashboards/subscription-mrr.tsx`
- `examples/dashboards/product-analytics.tsx`
- `src/contexts/regions/chart-regions.tsx`
- `configs/view-profiles.yaml` (`chart` and `dashboard` profiles)
