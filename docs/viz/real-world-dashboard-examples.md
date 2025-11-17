# Real-World Dashboard Examples

Mission **B24.4** captures the three canonical dashboards that prove the
`dashboard` render context in production-like scenarios. Each example combines
trait-authored viz specs, hero metrics, toolbar chrome, and an insight rail so
teams can copy the full pattern instead of assembling fragments.

## Where everything lives

| Artifact | Location | Notes |
| --- | --- | --- |
| Aggregated registry | `examples/dashboards/index.ts` | Lists each dashboard, contexts, and helper exports. |
| React examples | `examples/dashboards/*.tsx` | User, subscription, and product dashboards. |
| Storybook proof | `stories/proofs/DashboardContexts.stories.tsx` | Renders every dashboard via the aggregated registry. |
| Integration tests | `tests/components/dashboard-context.integration.test.tsx` | Ensures dashboard traits render in `dashboard/detail/timeline` contexts. |

Run the dashboards locally:

```bash
pnpm storybook                  # renders the Proofs/Dashboard Contexts stories
pnpm vitest tests/components/dashboard-context.integration.test.tsx
```

## Example breakdowns

### User adoption dashboard (`user-adoption.tsx`)
- `Stateful`, `Timestampable`, and `Taggable` traits plus the custom
  `UserDashboardPanels` trait.
- Panels: activation facet grid, retention trend, sentiment breakdown.
- Toolbar: period selector buttons.
- Insights: narrative list summarising adoption deltas.
- Contexts: renders cleanly in `dashboard`, `detail`, and `timeline`.

### Subscription MRR dashboard (`subscription-mrr.tsx`)
- Traits cover billing (`Billable`), cancellation, timestamps, and tags.
- Panels: stacked ARR area chart, churn outlook layered view, plan mix trend.
- Toolbar: scenario + currency selectors (pure HTML controls).
- Insights: ordered list of churn risks for GTM teams.
- Contexts: optimized for `dashboard` (hero metrics emphasise ARR).

### Product analytics dashboard (`product-analytics.tsx`)
- Lightweight object showing how a trait can own dashboard layout without
  the rest of the object registry.
- Panels: usage heatmap, satisfaction scatter, release-readiness facet grid.
- Toolbar: cohort filter chips.
- Insights: narrative paragraphs for PM and UX partners.
- Contexts: `dashboard` showcase with minimum trait dependencies.

## Using the registry

`examples/dashboards/index.ts` exposes `listDashboardExamples()` as a
single source of truth for Storybook, docs, and future tooling. Each entry
contains the preview component, factory helper, supported contexts, and the
story slug (`Proofs/Dashboard Contexts/*`). Import this registry whenever you
need to surface “the canonical dashboards” without duplicating metadata.
