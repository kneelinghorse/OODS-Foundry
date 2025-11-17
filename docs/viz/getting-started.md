# Getting Started: Add Viz to Your OODS App in 30 Minutes

This guide walks a product squad through the minimum work required to bring a production-ready visualization into an existing OODS surface. It assumes Sprint 21–23 assets are available (traits, normalized spec, dual renderers, dashboard context).

## Pre-flight Checklist
- Node 20+, pnpm enabled (`corepack enable`).
- `pnpm install` complete across the repo.
- Latest viz artifacts built: `pnpm build:tokens && pnpm build`.
- Storybook + Chromatic credentials ready if you want live previews (`pnpm storybook`).
- Optional: run `pnpm viz:suggest --list` once to download pattern metadata into cache.

## 30-Minute Roadmap
| Minute | Step | Output |
| --- | --- | --- |
| 0–5 | Choose a chart pattern | Pattern recommendation + scaffold plan |
| 5–15 | Compose or refine the normalized viz spec | Typed JSON spec + fixtures |
| 15–20 | Render the component and wire renderer selection | `<BarChart>` (or similar) rendering with fallbacks |
| 20–25 | Add accessibility narrative + fallback table | RDV.4-compliant narration + `<AccessibleTable>` |
| 25–30 | Integrate into view context + verify guardrails | Dashboard-ready entry plus tests |

## Step 1 — Choose a Pattern (≤5 min)
Use the CLI to score your schema and pull the right pattern + interactions:

```bash
pnpm viz:suggest "1Q+2N goal=comparison" --layout --interactions --scaffold
```

- Descriptor `1Q+2N` = one quantitative measure, two nominal dimensions.
- `--layout` reveals whether the library recommends single, facet, or layered layouts.
- `--interactions` suggests highlight/tooltip/filter bundles.
- `--scaffold` emits a normalized spec + React shell under `tmp/viz-scaffolds/` so you can copy/paste.

Cross-reference [`docs/viz/pattern-library.md`](./pattern-library.md) for pattern semantics.

## Step 2 — Compose the Normalized Spec (≤10 min)
Start from the scaffold or `examples/viz/*.spec.json`, then validate with Ajv:

```ts
import { assertNormalizedVizSpec } from '@/viz/spec/normalized-viz-spec';
import barBySegment from '@/examples/viz/bar-chart.spec.json';

const spec = assertNormalizedVizSpec({
  ...barBySegment,
  name: 'ARR by region',
  layout: { trait: 'LayoutFacet', rows: { field: 'region' } },
  interactions: [
    {
      trait: 'InteractionTooltip',
      select: { type: 'point', on: 'hover', fields: ['region'] },
      rule: 'tooltip',
    },
  ],
});
```

Key reminders:
- Always populate `spec.a11y.description`, `spec.a11y.narrative`, and `spec.a11y.tableFallback` (see [`normalized-viz-spec.md`](./normalized-viz-spec.md)).
- Use trait IDs for `marks`, `encoding`, `layout`, and `interactions` to keep the schema deterministic.
- Keep specs colocated with Storybook fixtures (`examples/viz/...`) so tests can exercise them.

## Step 3 — Render the Component (≤5 min)
Drop the spec into the matching component. Components automatically select a renderer unless you override the options.

```tsx
import { BarChart } from '@/components/viz/BarChart';
import { selectVizRenderer } from '@/viz/adapters/renderer-selector';

export function RevenueByRegion(): JSX.Element {
  const spec = useMemo(() => assertNormalizedVizSpec(barBySegment), []);
  const renderer = selectVizRenderer(spec, { preferred: 'vega-lite' });

  return (
    <BarChart
      spec={spec}
      renderer={renderer.renderer}
      title="ARR by region"
      description={spec.a11y.description}
    />
  );
}
```

Components already embed `VizContainer`, `ChartDescription`, renderer mounting, and cleanup logic. Only pass the validated spec and optional renderer preferences.

## Step 4 — Wire Accessibility & Interactions (≤5 min)
- Import interaction hooks (`useTooltip`, `useFilter`, `useZoom`) from `src/viz/hooks/*` and pass their outputs to the spec before validation.
- Render `<AccessibleTable>` or `spec.a11y.tableFallback` output alongside the chart for parity.
- Use `docs/viz/anti-patterns.md` to avoid pitfalls (e.g., using direct colors, omitting narration).
The example below merges interaction hooks with a shared `baseSpec` JSON inside a component:

```tsx
import { useTooltip } from '@/viz/hooks/useTooltip';
import { useFilter } from '@/viz/hooks/useFilter';
import { ChartDescription, AccessibleTable } from '@/components/viz/partials';

const tooltip = useTooltip();
const filter = useFilter({ encodings: ['x'] });
const spec = useMemo(
  () =>
    assertNormalizedVizSpec({
      ...baseSpec,
      interactions: [tooltip, filter],
    }),
  [baseSpec, tooltip, filter]
);

return (
  <>
    <ChartDescription narrative={spec.a11y.narrative} />
    <AccessibleTable table={spec.a11y.tableFallback} data={data} />
  </>
);
```

## Step 5 — Integrate Into View Contexts & Pipelines (≤5 min)
- Register the viz component as a dashboard extension or embed it inside `<RenderObject context="dashboard">`.
- Ensure tokens resolve in both light/dark themes (`pnpm tokens:guardrails`).
- Run guardrails: `pnpm test:unit --filter=viz`, `pnpm a11y:diff`, `pnpm viz:bench` (or `pnpm local:pr-check`).
- Update diagnostics/context snapshots if this chart is part of a flagship dashboard.

## Validation Script
Execute the following before calling the work complete:

```bash
pnpm lint && pnpm typecheck
pnpm test --filter=viz
pnpm a11y:diff
pnpm viz:bench
pnpm chromatic:dry-run # optional but recommended before launching new charts
```

## Next Steps
- For migrations, follow [`docs/viz/migration-guide.md`](./migration-guide.md).
- For architectural deep dives, see [`docs/viz/system-overview.md`](./system-overview.md) and [`docs/viz/architecture-decisions.md`](./architecture-decisions.md).
- For storytelling and context, point stakeholders to [`docs/viz/sprint-21-23-journey.md`](./sprint-21-23-journey.md).
