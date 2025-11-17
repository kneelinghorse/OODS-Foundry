# Visualization Architecture Decisions

These ADRs capture the foundational choices made while building the viz stack across Sprint 21–23. Treat them as guardrails—modifications should happen intentionally with fresh ADRs.

## ADR-001 — Trait-First Visualization Modeling
- **Status:** Accepted (Sprint 21)
- **Context:** We needed a way to extend the existing trait engine (used for domain objects) into visualization without inventing a parallel system.
- **Decision:** Model marks, encodings, layouts, and interactions as first-class traits (`traits/viz/*.trait.{ts,yaml}`) so they plug directly into the compositor and schema generators.
- **Consequences:**
  - Trait validation + type generation works for viz just like other domains.
  - Teams can compose objects and charts using the same mental model (capabilities → spec → component).
  - CLI + tooling can analyze traits to provide recommendations (pattern scoring, renderer hints).
- **References:** `traits/viz/*`, [`docs/viz/pattern-library.md`](./pattern-library.md), `src/viz/traits/*`.

## ADR-002 — Normalized Viz Spec as the Contract
- **Status:** Accepted (Sprint 21) and extended (Sprint 23 for layout/interaction fields).
- **Context:** We needed a deterministic schema for adapters, QA tooling, and documentation; ad hoc props on chart components were not scalable.
- **Decision:** Establish a normalized visualization specification with Ajv validation, generated TypeScript types, and curated fixtures (see [`docs/viz/normalized-viz-spec.md`](./normalized-viz-spec.md)).
- **Consequences:**
  - Every renderer, CLI, or doc consumes the same JSON shape.
  - Layout traits, accessibility metadata, and portability hints evolve in one place.
  - Specs can be shared between Storybook, integration tests, and CLI scaffolds.
- **References:** `schemas/viz/normalized-viz-spec.schema.json`, `generated/types/viz/normalized-viz-spec.ts`, `tests/viz/normalized-viz-spec.test.ts`.

## ADR-003 — Dual Renderer Strategy (Vega-Lite + ECharts)
- **Status:** Accepted (Sprint 22) and reinforced (Sprint 23 benchmarks).
- **Context:** Stakeholders needed both declarative portability (Vega-Lite) and enterprise-grade performance (ECharts). Supporting both manually would have exploded scope.
- **Decision:** Build renderer adapters on top of the normalized spec, then centralize selection logic (`src/viz/adapters/renderer-selector.ts`). Vega-Lite remains default for deterministic specs; ECharts activates when data volume, interactions, or explicit preferences demand it.
- **Consequences:**
  - Storybook + Chromatic can stay on Vega-Lite while dashboards with dense scatterplots switch to ECharts automatically.
  - Benchmarks (`scripts/perf/run-viz-benchmarks.mjs`) and budgets (`tools/perf/viz-budget.json`) keep both renderers honest.
  - Layout + interaction parity tests ensure features land once but operate everywhere.
- **References:** [`docs/viz/renderer-selection-guide.md`](./renderer-selection-guide.md), `src/viz/adapters/*`, `tests/viz/renderer-selector.test.ts`.

## ADR-004 — Declarative Interactions via Traits & Hooks
- **Status:** Accepted (Sprint 22 for highlight/tooltip, Sprint 23 for filter/zoom/brush).
- **Context:** Interactions (hover, filter, zoom) historically drifted between renderers because they lived in imperative chart code.
- **Decision:** Model each interaction as a trait plus React hooks that emit schema-compliant objects. Components only consume normalized specs; adapters translate them into Vega-Lite parameters or ECharts handlers.
- **Consequences:**
  - Interaction authoring stays declarative and serializable (ready for CLI scaffolds and tests).
  - Accessibility expectations are encoded in `spec.a11y` upfront, so dynamic behavior stays documented.
  - Hooks (`src/viz/hooks/*`) enforce deterministic defaults (e.g., memoized predicate IDs).
- **References:** `src/viz/hooks/useHighlight.ts`, `src/viz/hooks/useFilter.ts`, [`docs/viz/normalized-viz-spec.md`](./normalized-viz-spec.md#interactions).

## ADR-005 — Dashboard Context Integration & Guardrails
- **Status:** Accepted (Sprint 23).
- **Context:** Visualization needed to graduate from standalone components to full dashboard contexts with guardrails around performance, accessibility, and theming.
- **Decision:**
  - Introduce Chart/Dashboard contexts inside the view engine and update `RenderObject` to understand them.
  - Ship SharedLegend, VizFacetGrid, VizLayeredView so dashboards assemble from documented primitives.
  - Extend guardrail suite (a11y validation, OKLCH rules, benchmark budgets, telemetry) to cover dashboards end-to-end.
- **Consequences:**
  - Dashboards can now mix multiple charts with synchronized interactions inside canonical contexts.
  - Mission diagnostics (diagnostics.json, context snapshots) track viz adoption and performance budgets.
  - Pipelines enforce `pnpm a11y:diff`, `pnpm viz:bench`, and Chromatic diff coverage, reducing regressions.
- **References:** `src/contexts/dashboard`, `docs/views/context-styling.md`, `tests/integration/viz/**`, [`docs/viz/performance-guide.md`](./performance-guide.md).

To introduce new architectural concepts (e.g., third renderer, streaming data), author ADR-006+ referencing this file and documenting implications before coding.
