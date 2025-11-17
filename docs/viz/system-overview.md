# OODS Visualization System Overview

Sprint 21–23 produced a production-ready visualization stack that now powers trait-driven specs, dual renderers, complex layouts, and context-aware dashboards. This overview stitches the full system together so Sprint 24+ builders can navigate architecture, capabilities, and guardrails without rereading every sprint artifact.

## Audience & Scope
- Product engineers adding charts, layouts, or dashboards to OODS applications.
- Documentation, design systems, and enablement teams who need a single entry point before diving into specialized guides (patterns, CLI, renderer selection, etc.).
- CMOS coordinators validating that B24.1 synthesized the three-sprint journey into maintained docs.

## System Snapshot (Nov 2025)
| Capability | Status | Primary Assets |
| --- | --- | --- |
| Traits | 18 visualization traits across Mark/Encoding/Layout/Interaction + React hooks for declarative authoring | `traits/viz/**`, `src/viz/hooks/*`
| Normalized Spec | Single schema and Ajv validator describing every chart, layout, transform, and interaction | [`docs/viz/normalized-viz-spec.md`](./normalized-viz-spec.md), `schemas/viz/normalized-viz-spec.schema.json`
| Renderers | Dual adapters (Vega-Lite + ECharts) with selector heuristics and parity tests | `src/viz/adapters/*`, [`docs/viz/renderer-selection-guide.md`](./renderer-selection-guide.md)
| Components | Bar, Line, Scatter/Bubble, Area, Heatmap, VizFacetGrid, VizLayeredView, SharedLegend, VizContainer | `src/components/viz/*`, `docs/components/*`
| Layout & Contexts | Dashboard + Chart contexts in view engine, transforms for stack/facet concat | `src/contexts/dashboard`, `docs/views/context-styling.md`
| Tooling | CLI scaffolds, pattern library, performance + a11y guardrails | `scripts/viz/*`, [`docs/viz/cli-guide.md`](./cli-guide.md), [`docs/viz/pattern-library.md`](./pattern-library.md), `scripts/perf/run-viz-benchmarks.mjs`
| Quality Gates | RDV.4 accessibility suite, OKLCH token guardrails, benchmark budgets, CI hooks | `tests/viz/**`, `tests/components/viz/**`, `tools/perf/viz-budget.json`, `pnpm a11y:diff`

## Architecture Flow
![Viz architecture stack](../../diagrams/viz-architecture.svg)

1. **Trait engine** defines reusable capabilities (MarkBar, EncodingPositionX, LayoutFacet, InteractionTooltip). Traits output schema fragments and runtime helpers.
2. **Normalized Viz Spec** composes those traits into a declarative JSON contract with deterministic validation.
3. **Adapters** translate a validated spec into Vega-Lite JSON or ECharts configuration while preserving metadata, interactions, and layout semantics.
4. **Components** (`<BarChart>`, `<VizFacetGrid>`, etc.) wrap adapters, manage accessibility fallbacks (`AccessibleTable`, `ChartDescription`), and enforce renderer selection heuristics.
5. **View contexts** (`context="dashboard"`) orchestrate viz components inside broader object renderings and respect theming tokens.
6. **Tooling + guardrails** (CLI scaffolds, benchmark scripts, a11y suites) keep the system observable and portable.

## Pillars In Detail

### Trait Engine & Token System
- Traits live under `traits/viz/` with mirrored TS helpers under `src/viz/traits/`. Sprint 21 shipped 10 mark/encoding traits; Sprint 23 grew the set to 18 with Layout* and Interaction* families.
- Viz tokens (`packages/tokens/src/viz-*.json`) provide controlled color/size scales (`--viz-scale-*`). Components only read component/system tokens (purity audit enforced).
- Traits annotate semantics so downstream tooling (pattern CLI, renderer selector) can reason about encodings without reading imperative code.

### Normalized Viz Spec
- Defined in `schemas/viz/normalized-viz-spec.schema.json` and documented in [`docs/viz/normalized-viz-spec.md`](./normalized-viz-spec.md).
- Covers data, transforms, marks, layout, interactions, accessibility, and portability hints. Ajv validator + generated TS types ensure compile-time safety.
- Layout nodes (Facet/Layer/Concat) and interaction entries (Highlight/Tooltip/Filter/Zoom/Brush) let adapters stay pure while scaling complexity.

### Adapter & Renderer Layer
- Vega-Lite (`src/viz/adapters/vega-lite-adapter.ts`) and ECharts (`src/viz/adapters/echarts-adapter.ts`) share normalized inputs, enabling strict parity tests.
- Renderer selector (`src/viz/adapters/renderer-selector.ts`) applies explicit preferences, data volume thresholds, and temporal bias (documented in [`renderer-selection-guide.md`](./renderer-selection-guide.md)).
- Interaction bridges keep highlight/tooltip/filter semantics identical across renderers.

### Component & Layout Library
- Components wrap adapters inside `VizContainer`, manage lifecycles, register a11y fallbacks, and surface hooks for interactions.
- Layout components (`VizFacetGrid`, `VizLayeredView`, `SharedLegend`) render small multiples, overlays, and dashboard-style compositions using the same spec building blocks.
- All components ship docs + Storybook entries + unit/a11y tests.

### Tooling & Automation
- [`pnpm viz:suggest`](./cli-guide.md) inspects schema descriptors, recommends patterns, and scaffolds specs/components.
- Pattern library ([`pattern-library.md`](./pattern-library.md)) + renderer guide + responsive strategies expedite design decisions.
- Benchmark runner + budgets and `pnpm a11y:diff` keep performance and accessibility measurable.

### View Engine & Contexts
- Chart/Dashboard contexts now ship with canonical examples in `docs/domains/**` and `apps/*`. `RenderObject` can embed viz components with context-aware extensions.
- Diagnostics (`diagnostics.json`) tracks viz coverage per object so pipeline guardrails can assert adoption.

## Quality Guardrails
- **Accessibility**: 15 RDV.4 rules + axe suites (`tests/components/viz/*a11y.test.tsx`). Always populate `spec.a11y` narrative/table.
- **Tokens & Theming**: Use viz component tokens only; run `pnpm tokens:guardrails` after palette changes.
- **Performance**: Execute `pnpm viz:bench` (alias for the perf script) or `pnpm local:pr-check` before shipping new adapters/components.
- **Diagnostics**: Update `diagnostics.json` + contexts when adding dashboards so telemetry stays trustworthy.

## Adoption Path
1. Skim this overview.
2. Follow [`getting-started.md`](./getting-started.md) for a 30-minute prototype.
3. Use [`migration-guide.md`](./migration-guide.md) when integrating into legacy surfaces.
4. Review [`architecture-decisions.md`](./architecture-decisions.md) for rationale before altering foundational layers.
5. Keep [`sprint-21-23-journey.md`](./sprint-21-23-journey.md) handy when storytelling or onboarding new teammates.

## Reference Map
- Specs & validation → [`normalized-viz-spec.md`](./normalized-viz-spec.md)
- Renderer heuristics → [`renderer-selection-guide.md`](./renderer-selection-guide.md)
- Patterns & CLI → [`pattern-library.md`](./pattern-library.md), [`cli-guide.md`](./cli-guide.md)
- Performance & rendering proof → `scripts/perf/run-viz-benchmarks.mjs`, `tools/perf/viz-budget.json`
- Accessibility & responsive behavior → [`anti-patterns.md`](./anti-patterns.md), [`responsive-strategies.md`](./responsive-strategies.md)

This document satisfies B24.1 by consolidating the architecture narrative for the viz system and pointing to every operational touchpoint teams need.
