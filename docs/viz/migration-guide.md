# Migration Guide: Add Viz to Existing OODS Applications

Use this guide when you need to retrofit visualization capabilities into a surface that predates Sprint 21–23. The workflow assumes the host app already runs on the OODS stack (trait engine, tokens, contexts) and you want to introduce the viz system without destabilizing existing flows.

## When to Use This Guide
- Product surfaces that currently rely on bespoke charts, spreadsheets, or third-party embeds.
- Dashboards that show KPIs but lack the RDV.4 accessibility contract or token governance.
- Partner teams planning to adopt Sprint 23 layout/interaction traits but unsure how to stage the rollout.

## Readiness Checklist
| Question | Target Answer |
| --- | --- |
| Are you on TypeScript strict mode and React 19 in this codebase? | Yes — upgrade before integrating viz components. |
| Are `packages/tokens` and `pnpm-lock.yaml` on the latest sprint versions? | Run `pnpm install && pnpm build:tokens`. |
| Is the view engine up to date with Dashboard context support? | `pnpm typecheck` should succeed and `RenderObject` must accept `context="dashboard"`. |
| Do you have coverage from `pnpm a11y:diff` + `pnpm viz:bench`? | Should already run in CI; add them if missing. |

## Phase 1 — Stabilize Baseline
1. Refresh dependencies and tokens (`pnpm install && pnpm build:tokens`).
2. Run `pnpm local:pr-check` to confirm the existing surface is green before adding new code.
3. Export the latest context snapshot (`./cmos/cli.py db export contexts`) so you can update dashboards after migration.

## Phase 2 — Model Data & Specs
1. Inventory the KPIs and data sources the legacy chart currently uses. Normalize them into a `data.values[]` array or dataset reference.
2. Choose a pattern via [`pnpm viz:suggest`](./cli-guide.md) using your measure/dimension counts.
3. Copy the nearest spec from `examples/viz/patterns-v2/*.spec.json` and adapt it to your dataset. Update `layout` or `interactions` as needed.
4. Validate with `assertNormalizedVizSpec` and store the spec next to the relevant domain feature so Storybook/tests can reuse it.

## Phase 3 — Integrate Components
1. Import the matching component (`BarChart`, `AreaChart`, `VizFacetGrid`, etc.) and wrap it in `VizContainer` if you need custom chrome.
2. Use renderer selector defaults unless you have strict constraints (e.g., Chromatic snapshots forcing Vega-Lite). Docs: [`renderer-selection-guide.md`](./renderer-selection-guide.md).
3. For dashboards, compose viz widgets inside `<VizLayeredView>` or `<VizFacetGrid>` to avoid bespoke layout math.

## Phase 4 — Wire Contexts, Tokens, and Narratives
1. Embed the component inside the relevant view context:
   ```tsx
   <RenderObject
     object={subscription}
     context="dashboard"
     extensions={{ main: [<RevenueByRegion key="viz" data={subscription.data} />] }}
   />
   ```
2. Ensure narration + table fallbacks satisfy RDV.4. Use `docs/viz/anti-patterns.md` as a checklist.
3. Verify that CSS classes use component/system tokens only (no raw colors). Run `pnpm purity:audit` if the dashboard introduces new surfaces.
4. Update `diagnostics.json` or the relevant context payload so telemetry reflects the new dashboard widget.

## Phase 5 — Validate & Launch
1. Run the complete guardrail suite: `pnpm lint`, `pnpm typecheck`, `pnpm test --filter=viz`, `pnpm a11y:diff`, `pnpm viz:bench`, `pnpm chromatic:dry-run`.
2. Capture before/after screenshots + context notes for documentation. Reference [`docs/viz/sprint-21-23-journey.md`](./sprint-21-23-journey.md) if stakeholders need the historical arc.
3. Notify CMOS via `./cmos/cli.py db show current` + mission notes if the migration is part of an active mission.

## Reference Links
- Architecture primer → [`docs/viz/system-overview.md`](./system-overview.md)
- Quickstart recipe → [`docs/viz/getting-started.md`](./getting-started.md)
- Specification details → [`docs/viz/normalized-viz-spec.md`](./normalized-viz-spec.md)
- Layout & adapter deep dive → [`docs/viz/layout-adapter-guide.md`](./layout-adapter-guide.md)
- Pattern + CLI resources → [`docs/viz/pattern-library.md`](./pattern-library.md), [`docs/viz/cli-guide.md`](./cli-guide.md)

Following this phased plan ensures migrations land with the same rigor (traits, specs, adapters, guardrails) that Sprint 21–23 established.
