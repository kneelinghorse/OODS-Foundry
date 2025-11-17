# Visualization Documentation Hub

Welcome to the entry point for OODS Foundry’s visualization system. Sprint 21–23 landed traits, specs, renderers, components, layouts, tooling, and QA guardrails; this directory organizes the living documentation so Sprint 24 can focus on polish and adoption.

## Start Here
1. **[System Overview](./system-overview.md)** — Architecture stack, capabilities, and guardrails.
2. **[Getting Started](./getting-started.md)** — 30-minute recipe for embedding a chart.
3. **[Migration Guide](./migration-guide.md)** — Phased plan for upgrading legacy dashboards.
4. **[Architecture Decisions](./architecture-decisions.md)** — ADRs behind the viz stack.
5. **[Sprint 21-23 Journey](./sprint-21-23-journey.md)** — Narrative recap for stakeholders.

## Reference Guides
| Topic | Docs |
| --- | --- |
| Specification & schema | [`normalized-viz-spec.md`](./normalized-viz-spec.md), `schemas/viz/normalized-viz-spec.schema.json`, `generated/types/viz/normalized-viz-spec.ts` |
| Components & layouts | `docs/components/*` (Bar/Line/Scatter/Area/Heatmap), [`layout-adapter-guide.md`](./layout-adapter-guide.md) |
| Patterns & decision support | [`pattern-library.md`](./pattern-library.md), [`chart-selection-guide.md`](./chart-selection-guide.md), [`cli-guide.md`](./cli-guide.md) |
| Performance & renderer selection | [`performance-guide.md`](./performance-guide.md), [`renderer-selection-guide.md`](./renderer-selection-guide.md), `tools/perf/viz-budget.json` |
| Accessibility & quality guardrails | [`anti-patterns.md`](./anti-patterns.md), [`responsive-strategies.md`](./responsive-strategies.md), tests under `tests/components/viz/**` |
| Design integration | [`figma-handshake.md`](./figma-handshake.md), tokens in `packages/tokens/src/viz-*.json` |

## Workflow Map
| Need | Recommended Path |
| --- | --- |
| **Prototype a new chart** | 1) `pnpm viz:suggest --list`, 2) [`getting-started.md`](./getting-started.md), 3) add docs/stories. |
| **Explain the platform to stakeholders** | Share [`system-overview.md`](./system-overview.md) + [`sprint-21-23-journey.md`](./sprint-21-23-journey.md). |
| **Migrate an existing dashboard** | Follow [`migration-guide.md`](./migration-guide.md) and cross-check [`architecture-decisions.md`](./architecture-decisions.md). |
| **Debug renderer choices or perf issues** | Review [`renderer-selection-guide.md`](./renderer-selection-guide.md) + [`performance-guide.md`](./performance-guide.md), rerun `scripts/perf/run-viz-benchmarks.mjs`. |
| **Document best practices** | Extend this hub with new guides; link them from this README under the relevant category. |

## Command Quick List
```bash
pnpm viz:suggest "1Q+2N goal=comparison" --layout --interactions --scaffold
pnpm tokens:guardrails && pnpm purity:audit # enforce theming rules
pnpm test --filter=viz && pnpm a11y:diff # quality gates
pnpm viz:bench # run performance matrix (alias for scripts/perf runner)
pnpm chromatic:dry-run && pnpm storybook # docs + visual checks
```

## Contributing Updates
- Keep new guides ASCII + Markdown.
- Cross-link from this README so future agents find content quickly.
- When touching foundational behavior (spec, adapters, renderers, contexts), add or update an ADR and reference it here.

For CMOS operations (missions, diagnostics, planning), continue using `cmos/agents.md` — this hub only covers application-level visualization docs.
