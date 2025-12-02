# Changelog

## v0.2.0 — 2025-12-01

### Added

#### Network & Flow Module v1.0

New visualization types for hierarchical, network, and flow data:

- **Treemap**: Hierarchical rectangles with drill-down navigation, breadcrumb trail, and golden ratio (φ) aspect optimization
- **Sunburst**: Radial hierarchy with ancestor emphasis highlighting and multi-level label rotation
- **Force Graph**: Force-directed network layout with category grouping, collision detection, and adjacency exploration
- **Sankey**: Flow diagram with gradient links, value-proportional stroke width, and layered layout

Key features:
- Native ECharts rendering for optimal performance (sub-millisecond adapter transforms)
- Cross-filter integration for multi-widget dashboards
- Widget registration system with automatic tagging (hierarchy/network/flow)
- CLI scaffolding support for rapid dashboard creation
- Comprehensive accessibility fallbacks (aria labels, screen reader descriptions)

**Note:** v1.0 requires ECharts. Vega-Lite support planned for v1.1+.
See `docs/viz/network-flow/v1-constraints.md` for details.

New components:
- `<Treemap>` — Hierarchical area visualization with drilldown
- `<Sunburst>` — Radial partition visualization with ancestor focus
- `<ForceGraph>` — Force-directed graph with interactive exploration
- `<Sankey>` — Flow/allocation diagram with gradient links

New adapters:
- `adaptTreemapToECharts()` — Converts hierarchy data to ECharts treemap
- `adaptSunburstToECharts()` — Converts hierarchy data to ECharts sunburst
- `adaptGraphToECharts()` — Converts network data to ECharts force graph
- `adaptSankeyToECharts()` — Converts flow data to ECharts sankey

New cross-filter system:
- `networkFilterReducer` — State machine for multi-widget filter coordination
- `createNetworkInteractionBindings()` — Widget-to-filter binding factory
- Node, path, link, and adjacency filter types
- Per-widget filter clearing with global reset

Performance benchmarks (adapter transform time):
- Treemap: 500 nodes in <1ms (budget: 200ms)
- Sunburst: 300 nodes in <1ms (budget: 200ms)
- Force Graph: 100 nodes in <1ms (budget: 500ms)
- Sankey: 50 nodes in <1ms (budget: 100ms)

### Tests
- Added 21 integration tests covering full module functionality
- Added 11 performance benchmark tests with budget validation
- Added 166+ unit tests for adapters, cross-filter, widgets, and CLI

## v0.1.0 — 2025-10-21

### Features
- Scaffolded internal packaging pipeline with provenance metadata, Storybook compatibility, and sample app smoke tests (mission B16.5).
