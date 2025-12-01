# Network & Flow Module Roadmap

**Version:** 2.0  
**Duration:** 10-12 weeks  
**Status:** Research Complete → Implementation Ready

---

## Overview

Unlike the Spatial Module (which uses pass-through for both renderers), Network & Flow requires:

1. **Resolver Service** — Decides rendering path
2. **Transformation Engine** — Server-side D3 transforms
3. **Dual Adapter Sets** — ECharts (pass-through) + Vega (transformed)
4. **Vega Escape Hatch** — Full Vega spec generation for Sankey

This is a more complex build than Spatial, requiring 10-12 weeks.

---

## Phase Overview

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| **1** | Weeks 1-2 | Foundation | Schemas, types, resolver service |
| **2** | Weeks 3-5 | Transforms | D3 hierarchy, force, sankey transforms |
| **3** | Weeks 6-8 | Adapters | ECharts + Vega-Lite adapters |
| **4** | Weeks 9-10 | Integration | Dashboard context, CLI, testing |
| **5** | Weeks 11-12 | Polish | Docs, Storybook, performance, release |

---

## Phase 1: Foundation (Weeks 1-2)

### Week 1: Schema & Type Definitions

| Task | Description | Output |
|------|-------------|--------|
| 1.1 | Define `HierarchyInput` schema (adjacency + nested) | `hierarchy-input.schema.json` |
| 1.2 | Define `NetworkInput` schema (nodes + links) | `network-input.schema.json` |
| 1.3 | Define `SankeyInput` schema | `sankey-input.schema.json` |
| 1.4 | Define transform output schemas | `treemap-output.schema.json`, etc. |
| 1.5 | TypeScript interfaces for all contracts | `src/types/index.ts` |

### Week 2: Resolver Service

| Task | Description | Output |
|------|-------------|--------|
| 2.1 | Implement `ResolverInput` / `ResolverOutput` types | `src/resolver/types.ts` |
| 2.2 | Build decision logic (see ARCHITECTURE.md §3.2) | `src/resolver/resolver.ts` |
| 2.3 | Unit tests for all decision paths | `tests/resolver.test.ts` |
| 2.4 | Integration with existing `renderer-selector.ts` | Update `src/viz/adapters/` |

**Exit Criteria:**
- [ ] All input schemas validate sample data
- [ ] Resolver returns correct path for all vizType × renderer combinations
- [ ] 100% test coverage on resolver logic

---

## Phase 2: Transformation Engine (Weeks 3-5)

### Week 3: Hierarchy Transforms

| Task | Description | Output |
|------|-------------|--------|
| 3.1 | Install `d3-hierarchy` + types | `package.json` |
| 3.2 | Implement `stratifyData()` — flat → tree | `src/transforms/hierarchy-transform.ts` |
| 3.3 | Implement `computeTreemap()` — tree → coordinates | Same file |
| 3.4 | Implement `computeSunburst()` — tree → polar coords | Same file |
| 3.5 | Handle edge cases: orphans, cycles, multiple roots | Validation layer |
| 3.6 | Unit tests with real hierarchy data | `tests/transforms/hierarchy.test.ts` |

### Week 4: Force Transform

| Task | Description | Output |
|------|-------------|--------|
| 4.1 | Install `d3-force` + types | `package.json` |
| 4.2 | Implement deterministic initialization (spiral) | `src/transforms/force-transform.ts` |
| 4.3 | Implement batch processing (stop + tick loop) | Same file |
| 4.4 | Implement link denormalization (object refs → IDs + coords) | Same file |
| 4.5 | Configure forces: center, charge, link, collide | Same file |
| 4.6 | Unit tests with network data | `tests/transforms/force.test.ts` |

### Week 5: Sankey Transform

| Task | Description | Output |
|------|-------------|--------|
| 5.1 | Install `d3-sankey` + `d3-sankey-circular` + types | `package.json` |
| 5.2 | Implement `computeSankeyLayout()` | `src/transforms/sankey-transform.ts` |
| 5.3 | Generate SVG path strings for links | Same file |
| 5.4 | Handle circular flows (use d3-sankey-circular) | Same file |
| 5.5 | Unit tests with flow data | `tests/transforms/sankey.test.ts` |

**Exit Criteria:**
- [ ] All three transforms produce correct output
- [ ] Edge cases handled (orphans, cycles, empty data)
- [ ] Performance acceptable for target data volumes
- [ ] Unit tests pass with >90% coverage

---

## Phase 3: Adapters (Weeks 6-8)

### Week 6: ECharts Adapters (Pass-Through)

| Task | Description | Output |
|------|-------------|--------|
| 6.1 | `TreemapEChartsAdapter` — format recursive children | `src/adapters/echarts/treemap-adapter.ts` |
| 6.2 | `SunburstEChartsAdapter` — format recursive children | `src/adapters/echarts/sunburst-adapter.ts` |
| 6.3 | `GraphEChartsAdapter` — format nodes + links + categories | `src/adapters/echarts/graph-adapter.ts` |
| 6.4 | `SankeyEChartsAdapter` — format nodes + links | `src/adapters/echarts/sankey-adapter.ts` |
| 6.5 | Visual regression tests in Storybook | `stories/echarts/` |

### Week 7: Vega-Lite Adapters (Server Transform)

| Task | Description | Output |
|------|-------------|--------|
| 7.1 | `TreemapVegaLiteAdapter` — rect mark with x0/y0/x1/y1 | `src/adapters/vega-lite/treemap-adapter.ts` |
| 7.2 | `SunburstVegaLiteAdapter` — arc mark with theta/radius | `src/adapters/vega-lite/sunburst-adapter.ts` |
| 7.3 | `GraphVegaLiteAdapter` — point + rule marks | `src/adapters/vega-lite/graph-adapter.ts` |
| 7.4 | Integration with transform engine (call transforms before adapt) | Adapter orchestration |
| 7.5 | Visual regression tests | `stories/vega-lite/` |

### Week 8: Vega Escape Hatch (Sankey Only)

| Task | Description | Output |
|------|-------------|--------|
| 8.1 | `SankeyVegaAdapter` — Full Vega spec with path mark | `src/adapters/vega/sankey-adapter.ts` |
| 8.2 | Path mark binding: `"path": {"field": "svgPath"}` | Same file |
| 8.3 | Test with vega-embed (not vega-lite) | Integration test |
| 8.4 | Document escape hatch pattern for future use | `docs/vega-escape-hatch.md` |

**Exit Criteria:**
- [ ] All 8 adapters produce valid renderer specs
- [ ] Visual output matches between ECharts and Vega paths
- [ ] Sankey renders correctly via Full Vega
- [ ] Storybook stories for all combinations

---

## Phase 4: Integration (Weeks 9-10)

### Week 9: Dashboard Context Integration

| Task | Description | Output |
|------|-------------|--------|
| 9.1 | Extend `normalized-viz-spec.schema.json` with new transforms | Schema update |
| 9.2 | Register new traits in trait engine | Trait registration |
| 9.3 | Wire resolver into viz pipeline | Pipeline integration |
| 9.4 | Cross-filter support for network selections | Interaction binding |
| 9.5 | Tooltip/highlight consistency across renderers | Interaction parity |

### Week 10: CLI & Tooling

| Task | Description | Output |
|------|-------------|--------|
| 10.1 | `oods-cli viz:scaffold --type=treemap` | CLI extension |
| 10.2 | `oods-cli viz:scaffold --type=sankey` | CLI extension |
| 10.3 | Example dashboards (one per viz type) | `examples/` |
| 10.4 | Data validation CLI tool | `oods-cli data:validate-hierarchy` |
| 10.5 | End-to-end integration tests | `e2e/network-flow/` |

**Exit Criteria:**
- [ ] Full pipeline works: data → resolver → transform → adapter → render
- [ ] CLI scaffolds working visualizations
- [ ] E2E tests pass for all four viz types × both renderers
- [ ] No regressions in existing viz types

---

## Phase 5: Polish & Ship (Weeks 11-12)

### Week 11: Documentation & Examples

| Task | Description | Output |
|------|-------------|--------|
| 11.1 | API reference for all new traits | `docs/api/` |
| 11.2 | Usage guide: "When to use Treemap vs Sunburst" | `docs/guides/` |
| 11.3 | Data preparation guide (how to structure hierarchy data) | `docs/guides/` |
| 11.4 | Migration guide (upgrading from v1.x) | `docs/migration/` |
| 11.5 | Storybook documentation mode | Storybook MDX |

### Week 12: Performance & Release

| Task | Description | Output |
|------|-------------|--------|
| 12.1 | Performance benchmarks (transform time, render time) | Benchmark suite |
| 12.2 | Large data testing (max thresholds) | Performance report |
| 12.3 | Accessibility audit (keyboard nav, screen reader) | A11y report |
| 12.4 | CHANGELOG entry | `CHANGELOG.md` |
| 12.5 | Release v2.0.0 | npm publish, git tag |

**Exit Criteria:**
- [ ] Documentation complete
- [ ] Performance within thresholds
- [ ] Accessibility compliant
- [ ] v2.0.0 released

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Coverage Improvement** | +5-6% (87% → 93%) | Validation against RV.01 corpus |
| **Renderer Parity** | Visual match | Side-by-side comparison tests |
| **Transform Performance** | <200ms for 500 nodes | Benchmark suite |
| **Render Performance** | <500ms for 500 nodes | Benchmark suite |
| **Test Coverage** | >90% | Jest coverage report |
| **Documentation** | 100% public API | Typedoc output |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sankey VL impossible | ✅ Confirmed | High | Vega escape hatch implemented |
| Force layout non-deterministic | Medium | Medium | Deterministic seeding + batch processing |
| Large data performance | Medium | High | Data volume thresholds + warnings |
| Transform engine complexity | Medium | Medium | Modular design, extensive testing |
| Vega-Lite arc mark limitations | Low | Medium | Server-side polar→Cartesian if needed |

---

## Dependencies on Other Work

| Dependency | Status | Notes |
|------------|--------|-------|
| Spatial Module (v1.1) | In Progress | Can be built in parallel |
| Trait Engine | ✅ Complete | No changes needed |
| Renderer Selector | ✅ Complete | Will be extended |
| Normalized Viz Spec | ✅ Complete | Schema extension needed |

---

## Team Allocation (Suggested)

| Role | Weeks 1-2 | Weeks 3-5 | Weeks 6-8 | Weeks 9-10 | Weeks 11-12 |
|------|-----------|-----------|-----------|------------|-------------|
| **Architect** | Schema design | Transform review | Adapter review | Integration | Release |
| **Dev 1** | Types + Resolver | Hierarchy transform | ECharts adapters | CLI | Docs |
| **Dev 2** | — | Force + Sankey | Vega adapters | E2E tests | Performance |
| **QA** | — | Unit tests | Visual regression | Integration tests | Final QA |

---

## Milestones

| Milestone | Date | Deliverable |
|-----------|------|-------------|
| **M1: Foundation Complete** | End Week 2 | Schemas, types, resolver |
| **M2: Transforms Complete** | End Week 5 | All three transform engines |
| **M3: Adapters Complete** | End Week 8 | All adapters, Storybook |
| **M4: Integration Complete** | End Week 10 | Full pipeline, CLI |
| **M5: v2.0 Release** | End Week 12 | Production release |

---

## Post-Release Roadmap

After v2.0 ships:

1. **v2.1** — Additional hierarchy layouts (Pack, Icicle, Dendrogram)
2. **v2.2** — Animated transitions (universalTransition support)
3. **v2.3** — Streaming/progressive loading for large graphs
4. **v3.0** — WebGL renderer for 10k+ node networks
