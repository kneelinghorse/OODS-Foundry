# Dashboard Composition Pattern

The dashboard composition pattern packages trait-provided visualizations into
token-driven layouts without bespoke container code. It pairs the new
`chart`/`dashboard` view contexts with the `createChartRegionExtensions`
helper so traits can render hero headers, toolbars, chart grids, and insight
rails directly within `RenderObject`.

## Pattern goals

1. **Trait-first visualizations** – traits own the data and spec for each chart.
2. **Canonical regions only** – layouts are always expressed via
   `pageHeader`, `viewToolbar`, `main`, and `contextPanel`.
3. **Reusable scaffolding** – helpers emit consistent markup annotated with
   `data-chart-panel`/`data-chart-grid` for diagnostics and CSS hooks.
4. **Context-aware fallback** – the same view extensions render inside
   `detail` or `timeline` contexts when `context="dashboard"` is not requested.

## Authoring workflow

1. **Define chart specs** (e.g., `NormalizedVizSpec`) alongside trait data.
2. **Describe panels** with `ChartPanelDefinition` instances.
3. **Call `createChartRegionExtensions`** from the trait adapter.
4. **Register trait** inside the object spec used by `RenderObject`.

```ts
const panels: ChartPanelDefinition<AccountRecord>[] = [
  {
    id: 'account:mrr',
    title: 'Recurring revenue',
    render: ({ data }) => <LineChart spec={data.mrrSpec} />,
  },
  {
    id: 'account:heatmap',
    title: 'Feature usage',
    render: ({ data }) => <Heatmap spec={data.usageSpec} />,
  },
];

const AccountDashboardTrait: TraitAdapter<AccountRecord> = {
  id: 'AccountDashboardPanels',
  view: () =>
    createChartRegionExtensions<AccountRecord>({
      traitId: 'AccountDashboardPanels',
      variant: 'dashboard',
      hero: ({ data }) => <Hero metrics={data.metrics} />,
      toolbar: () => <Toolbar />,
      insights: ({ data }) => <Narrative notes={data.notes} />,
      panels,
    }),
};
```

## Canonical examples

| Example | Location | Highlights |
| --- | --- | --- |
| User Adoption Dashboard | `examples/dashboards/user-adoption.tsx` | Faceted activation grid, retention trend, sentiment panel. |
| Subscription MRR Dashboard | `examples/dashboards/subscription-mrr.tsx` | Stacked revenue, churn outlook, plan mix trend. |
| Product Analytics Dashboard | `examples/dashboards/product-analytics.tsx` | Usage heatmap, satisfaction scatter, release readiness grid. |

Each example exports `create<Name>DashboardExample()` plus a preview component
that renders `<RenderObject context="dashboard" />`.
See `docs/viz/real-world-dashboard-examples.md` for deep dives and Storybook
references for the same dashboards.

## Diagnostics & telemetry

- `createChartRegionExtensions` tags every panel with `data-chart-panel` and
  `data-chart-grid`, enabling `diagnostics.viewEngine.layouts` to report the
  number of rendered panels per session.
- The helper assigns metadata tags (`chart-region`, `dashboard`) so render
  reports and guardrails can segment extensions without custom heuristics.
- `diagnostics.json.viewEngine.layouts.sources` lists the canonical dashboard
  modules used to validate the context templates.

## Guardrails

- Continue to target canonical regions only; do not invent bespoke IDs.
- Avoid local CSS—context classes and `data-chart-grid` provide enough hooks.
- Keep chart specs normalized (`NormalizedVizSpec`) so the Vega-Lite adapter
  and RDV fallbacks remain available.
- Supply meaningful hero metrics and insights; page headers render alongside
  existing trait contributions (e.g., `Stateful` headers) so avoid duplication.
