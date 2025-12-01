# OODS Spatial Module — Implementation Roadmap

**Version:** 1.0.0  
**Target Release:** v1.1  
**Timeline:** 6-8 weeks from kickoff  
**Last Updated:** November 2025

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1          PHASE 2          PHASE 3          PHASE 4            │
│  Foundation       Components       Integration      Polish & Ship       │
│  (2 weeks)        (2-3 weeks)      (1-2 weeks)      (1 week)           │
│                                                                         │
│  ○ Schema         ○ Choropleth     ○ Dashboard      ○ Docs             │
│  ○ Traits         ○ BubbleMap      ○ CLI scaffold   ○ Storybook        │
│  ○ Tokens         ○ Adapters       ○ Renderer sel.  ○ Migration guide  │
│  ○ Geo resolver   ○ A11y fallback  ○ Parity tests   ○ Release          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Weeks 1-2)

### Goals
- Schema extensions merged
- Traits implemented and tested
- Token namespaces defined
- Geo data resolution working

### Deliverables

| ID | Task | Owner | Est. | Acceptance Criteria |
|----|------|-------|------|---------------------|
| S1.1 | Add `data.geo.join` to normalized-viz-spec schema | — | 2d | Schema validates, TS types generated |
| S1.2 | Add `field.geojson`, `field.topojson`, `field.geopoint` types | — | 1d | Field type inference detects geo fields |
| S1.3 | Implement `Geocodable` trait | — | 2d | Trait detects geo fields, outputs resolution type |
| S1.4 | Implement `HasProjection` trait | — | 2d | Projection config generates correctly |
| S1.5 | Implement `LayeredOverlay` trait | — | 1d | Layer composition metadata correct |
| S1.6 | Define `viz.map.*` token namespace | — | 1d | Tokens in Figma + code, guardrails pass |
| S1.7 | Build `geo-data-resolver.ts` utility | — | 3d | Fetches URLs, parses TopoJSON, joins data |

### Exit Criteria
- [ ] `pnpm test --filter=traits/spatial` passes
- [ ] `pnpm tokens:guardrails` passes with new map tokens
- [ ] Geo resolver handles GeoJSON, TopoJSON, URL sources

---

## Phase 2: Components (Weeks 3-5)

### Goals
- Core map components built
- Adapters for both renderers
- Accessibility fallbacks complete

### Deliverables

| ID | Task | Owner | Est. | Acceptance Criteria |
|----|------|-------|------|---------------------|
| S2.1 | Build `<SpatialContainer>` wrapper | — | 2d | Manages projection, layers, a11y context |
| S2.2 | Build `<ChoroplethMap>` component | — | 4d | Renders filled regions, color scale works |
| S2.3 | Build `<BubbleMap>` component | — | 3d | Renders points, size/color encoding works |
| S2.4 | Build `<MapLegend>` component | — | 2d | Renders continuous + categorical legends |
| S2.5 | Build `<MapControls>` component | — | 1d | Zoom, pan, layer toggle controls |
| S2.6 | Build `<AccessibleMapFallback>` | — | 2d | Table + narrative from spec.a11y |
| S2.7 | Implement Vega-Lite spatial adapter | — | 3d | Generates valid VL spec for geo marks |
| S2.8 | Implement ECharts spatial adapter | — | 3d | Generates valid EC option for map series |
| S2.9 | Keyboard navigation for maps | — | 2d | Tab through regions, arrow pan, +/- zoom |

### Exit Criteria
- [ ] Both components render in Storybook with sample data
- [ ] Adapters produce equivalent output for same spec
- [ ] Keyboard navigation works, focus rings visible
- [ ] `pnpm a11y:diff` passes for map components

---

## Phase 3: Integration (Weeks 6-7)

### Goals
- Maps work in dashboard context
- CLI suggests spatial patterns
- Renderer selection includes spatial heuristics
- Parity tests confirm adapter equivalence

### Deliverables

| ID | Task | Owner | Est. | Acceptance Criteria |
|----|------|-------|------|---------------------|
| S3.1 | Dashboard context integration | — | 2d | Maps embed in dashboards, filter interactions work |
| S3.2 | Add spatial to `pnpm viz:suggest` CLI | — | 2d | CLI detects geo fields, recommends map type |
| S3.3 | Update renderer selector with spatial heuristics | — | 1d | Large datasets route to ECharts |
| S3.4 | Write adapter parity tests | — | 2d | Same spec → equivalent render on both |
| S3.5 | Performance benchmarks for spatial | — | 1d | Budget defined, benchmarks pass |
| S3.6 | Add spatial to diagnostics.json | — | 0.5d | Telemetry tracks spatial adoption |

### Exit Criteria
- [ ] Example dashboard with map + linked table/chart works
- [ ] CLI correctly scaffolds spatial specs
- [ ] Parity tests pass for Choropleth and BubbleMap
- [ ] Performance within budget for 500-region choropleth

---

## Phase 4: Polish & Ship (Week 8)

### Goals
- Documentation complete
- Storybook demos polished
- Migration guide for existing custom maps
- Release v1.1

### Deliverables

| ID | Task | Owner | Est. | Acceptance Criteria |
|----|------|-------|------|---------------------|
| S4.1 | Write `docs/viz/spatial-module.md` | — | 1d | Overview, usage, examples |
| S4.2 | Write `docs/viz/spatial-patterns.md` | — | 1d | When to use each map type |
| S4.3 | Write `docs/viz/spatial-accessibility.md` | — | 0.5d | A11y requirements, keyboard nav |
| S4.4 | Update `docs/viz/system-overview.md` | — | 0.5d | Add Spatial module to architecture |
| S4.5 | Storybook demos for all components | — | 2d | Interactive demos with controls |
| S4.6 | Migration guide for legacy maps | — | 1d | Step-by-step for existing implementations |
| S4.7 | Final QA pass | — | 1d | All tests green, no regressions |
| S4.8 | Tag and release v1.1 | — | 0.5d | Release notes, changelog updated |

### Exit Criteria
- [ ] All docs reviewed and merged
- [ ] Storybook deployed with spatial demos
- [ ] No P0/P1 bugs open
- [ ] Release tagged, changelog published

---

## Dependencies

### Blocking
- None — Spatial is a clean addition, no breaking changes

### External
- GeoJSON/TopoJSON sample data for testing (US states, world countries)
- Design review of map color scales (sequential, diverging)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tile basemap integration complex | Medium | Medium | Start with boundary-only maps; tiles as fast-follow |
| Projection edge cases | Low | Low | Stick to common projections (Mercator, AlbersUSA) |
| Performance on dense bubble maps | Medium | High | Implement clustering in Phase 2, document thresholds |
| ECharts geo module bundle size | Medium | Medium | Lazy-load geo data, tree-shake unused regions |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage improvement | +5% (87% → 92%) | Re-code sample with Spatial available |
| Adoption in first 30 days | 3+ dashboards using Spatial | Diagnostics telemetry |
| A11y compliance | 100% of maps have table fallback | Automated a11y audit |
| Performance | <500ms render for 500-region choropleth | Benchmark suite |

---

## Post-Release Backlog

Items not in v1.1 scope but queued for future:

- [ ] Tile basemap integration (OSM, Mapbox)
- [ ] Cartogram support (requires pre-processing)
- [ ] Contour/isoline maps
- [ ] 3D globe view (ECharts globe series)
- [ ] Animation: temporal geo data playback
