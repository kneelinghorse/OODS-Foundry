# Sprint 23 Plan: Complex Patterns & Layout Traits

**Status:** Draft ready for backlog load  
**Sprint Window:** Targeting late November 2025  
**Owner:** Viz domain

Sprint 22 proved dual-renderer parity, interaction traits, and the pattern/benchmark infrastructure. Sprint 23 scales those foundations into production-grade layout traits, composite patterns, and responsive Storybook/Figma assets so downstream teams can author complex dashboards without bespoke code.

---

## 🎯 Objectives

1. **Layout intelligence** — Introduce facet/layer/concat traits plus adapter support so a single normalized spec can generate grids, layered overlays, and dashboard sections.
2. **Composite patterns** — Ship reusable grouped/stacked/small-multiple components backed by the existing pattern specs and CLI scoring.
3. **Advanced interactions** — Add filter/zoom/brush traits that compose with highlight/tooltip, complete with accessibility narratives and deterministic tests.
4. **Tooling alignment** — Sync Storybook, Figma, and CLI workflows so pattern choices, responsive breakpoints, and renderer selection share the same metadata.

**Success Criteria**
- Layout traits available in `viz/spec` schema + generated TS types with accompanying Ajv validation and merge logic.
- Vega-Lite + ECharts adapters render facet/layer compositions with shared color/scale management and deterministic tests.
- `<VizFacetGrid>` (and friends) render Storybook dashboards with RDV.4 fallbacks, Chromatic baselines, and a11y coverage.
- `pnpm viz:suggest` returns layout-aware suggestions (density, grouping, small-multiple hints) and scaffolds sample specs.
- Figma chart primitives reference the same tokens + pattern metadata tracked in code; docs describe the handshake.
- Benchmarks + CI extend to layout/interaction scenarios (strict budget gates) with alarms wired into diagnostics.

---

## 🗂️ Mission Breakdown

### **B23.1: Layout Trait Schema**
**Dependencies:** Sprint 22 schema + trait engine  
**Focus:** Add `Facet`, `Layer`, and `Concat` trait families.
- Extend `docs/viz/normalized-viz-spec.md` + schema/TS output to describe layout traits, shared scales, and projection metadata.
- Author trait definitions + generators (YAML + TS) mirroring existing Mark/Encoding structure.
- Update validation helpers + tests to ensure layout traits compose with InteractionTrait + transforms.

### **B23.2: Adapter & Renderer Support**
**Dependencies:** B23.1  
**Focus:** Teach both adapters to understand layout nodes.
- Add facet/layer/concat branches to `src/viz/adapters/vega-lite-adapter.ts` and `src/viz/adapters/echarts-adapter.ts` with shared scale + color management.
- Expand renderer selector heuristics for layout density (e.g., prefer Vega-Lite for small multiples, ECharts for layered interactions over 1k points).
- Unit tests verifying dataset partitioning, axis duplication, aria metadata, and interaction propagation across children.

### **B23.3: Viz Facet/Grid Components**
**Dependencies:** B23.1, B23.2  
**Focus:** React surface for small multiples / dashboards.
- Build `<VizFacetGrid>` + `<VizLayeredView>` components that wrap multiple child charts, manage shared legends, and pipe RDV.4 fallbacks per tile.
- Add grid-aware keyboard navigation + narrative summaries (aggregate + per tile) to meet accessibility contracts.
- Storybook gallery `Visualization/Layouts/*` with Chromatic coverage for row/column density breakpoints.

### **B23.4: Advanced Interaction Traits**
**Dependencies:** B22.2, B23.2  
**Focus:** Filter, zoom, brush, and linked views.
- Extend `InteractionTrait` schema + React hooks (`useFilter`, `useBrush`, `useZoom`) with deterministic configuration + tests.
- Bind new traits in adapters (e.g., Vega-Lite `interval` params, ECharts `dataZoom`, `brush` events) with corresponding `bindEChartsInteractions` handlers.
- Expand accessibility guidance for dynamic focus/announce patterns when filters apply.

### **B23.5: Pattern Automation & CLI Upgrade**
**Dependencies:** B22.6, B23.3, B23.4  
**Focus:** Automate pattern scaffolding + layout hints.
- Enrich `chartPatterns` with layout + interaction metadata (e.g., "prefers facet grid", "requires brush").
- Enhance `pnpm viz:suggest` with `--layout` / `--interactions` flags plus a `--scaffold` switch that outputs ready-to-run specs and React component shells under `examples/viz/generated`.
- Tests to ensure scoring weights escalate patterns with correct layout traits and CLI output is type-safe.

### **B23.6: Responsive Pattern Library**
**Dependencies:** B23.3, B23.5  
**Focus:** Document and demo complex compositions.
- Author `docs/viz/pattern-library-v2.md` + Storybook MDX docs covering grouped/stacked/target-band/small-multiple examples with responsive recipes.
- Add Chromatic baselines for each pattern with both renderers, including high-density data.
- Include usage guardrails (token callouts, layout constraints, recommended interactions) in docs.

### **B23.7: Figma + Token Handshake for Viz**
**Dependencies:** B22.6, B23.6  
**Focus:** Align design tooling with new patterns.
- Create Figma library primitives (facet grid, layered overlays, heatmap templates) referencing `--viz-*` tokens and pattern metadata exported from code.
- Update the design ops doc + `diagnostics.json` to log the viz-specific handshake, ensuring designers can request the same patterns surfaced in Storybook/CLI.
- Optional plugin update to sync pattern metadata into source control (or at minimum, JSON exports stored in `cmos/planning/figma`).

### **B23.8: Dashboard Context Integration**
**Dependencies:** B23.3, B23.4  
**Focus:** Bring layouts into Foundry views.
- Extend `src/contexts/view-engine` (List/Detail/Form) with a `Chart`/`Dashboard` context that consumes layout traits and renders the new components.
- Create canonical object examples (User adoption dashboard, Subscription MRR trend grid) with tests verifying trait-to-view integration.
- Hook into diagnostics/telemetry to log layout usage + renderer decisions for future tuning.

### **B23.9: CI Guardrails & Telemetry for Layouts**
**Dependencies:** B23.2, B23.4, B23.8  
**Focus:** Scale performance + stability coverage.
- Expand `scripts/perf/run-viz-benchmarks.mjs` scenarios to include layout/interaction combos (e.g., 4× facet scatter with brush) and update `tools/perf/viz-budget.json`.
- Add Playwright VRT coverage for layout stories (light/dark + forced-colors) and wire them into `pnpm pipeline:push`.
- Update `diagnostics.json` + `helpers.performance` with new layout benchmark history + alarms.

---

## 🔗 Dependencies

```
B23.1 (Layout Traits)
  ↓
B23.2 (Adapter Support)
  ↓
B23.3 (Facet/Grid Components)
    ↘
     B23.5 (Pattern Automation) → B23.6 (Responsive Library)
        ↘
         B23.7 (Figma Handshake)
  ↓
B23.4 (Advanced Interactions) → B23.8 (Dashboard Context) → B23.9 (CI Guardrails)
```

Critical path: **B23.1 → B23.2 → B23.3 → B23.4 → B23.8 → B23.9**  
Supporting path: **B23.3 → B23.5 → B23.6 → B23.7**

---

## 📦 Deliverables Checklist

- [ ] Trait schema + generated types updated (`viz/spec`, `generated/types/viz`)
- [ ] React components + Storybook stories for layouts/patterns
- [ ] CLI upgrades + scaffolding templates checked in
- [ ] Performance budgets + diagnostics updated with layout benchmarks
- [ ] Figma exports + documentation describing the viz handshake
- [ ] View engine integration covering at least two canonical dashboards

---

## ✅ Ready to Queue

- Dependencies from Sprint 22 (renderers, interactions, pattern specs, benchmarks) are complete.
- Artifacts required for planning (pattern scores, renderer heuristics, viz tokens) already shipped.
- This plan only touches application code under `src/`, `docs/`, `examples/`, and Storybook, keeping CMOS separation intact.

**Next steps:**  
1. Load missions B23.1–B23.9 into the CMOS backlog.  
2. Run `pnpm local:pr-check` + `./cmos/cli.py db show backlog` to verify queue.  
3. Kick off B23.1 once Sprint 22 close-out lands in `master_context`.
