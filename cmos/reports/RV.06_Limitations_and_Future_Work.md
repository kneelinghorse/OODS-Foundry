# Limitations and Future Work

## Limitations
- **Scope of validation**: Coverage measures structural availability of archetypes, not usability, performance, or data accuracy. Custom builds in the 12% long tail were treated as “uncovered” even when achievable via bespoke code.
- **Domain skew**: Stratification covered Finance, HR, Sales, Marketing, Cybersecurity; other verticals (Healthcare, Energy/IIoT, Public Sector) were represented in the corpus but not separately powered for CI reporting.
- **Geospatial depth**: Map analysis emphasized web-deliverable layers (choropleth, clustering, routing). Advanced GIS (3D, offline tiling) remains out-of-scope.
- **Inter-rater ambiguity**: Stacked vs. grouped bars and KPI-with-trend vs. Line drove most κ friction; documentation updates are required to lock in reliability.
- **Performance assumptions**: Coverage counts assume components can handle domain-scale data (e.g., thousands of nodes/edges). This has not yet been benchmarked for React 19 + OODS theming with WebGL/Canvas.
- **CI uplift estimate**: The projected >95% coverage after Flow/Topology is an informed projection; requires post-implementation re-measurement.

## Future Work
- **Module delivery**: Build and ship Flow (Sankey/alluvial/chord) and Topology (force-directed/adjacency/route) modules with conservation validation, theming, and a11y.
- **Geospatial canvas**: Add reusable map-layer primitives (basemap selection, clustering, route + heat overlays) with dark-mode tokens and keyboard zoom/pan patterns.
- **Composite rules**: Publish clear precedence for stacked/grouped/100% bars, KPI-with-sparkline classification, and table vs. heatmap selection; integrate into lint rules.
- **Performance & VRT**: Establish perf baselines for dense graphs (LOD, clustering) and extend VRT/a11y baselines for dark maps and interactive edges/nodes.
- **Retest after rollout**: Re-run stratified coverage on a new 300-dashboard sample post-module to validate uplift and update article claims.
- **Domain extensions**: Evaluate domain-specific add-ons (Flame Graph for DevOps/HFT; calendar/Gantt variants) as optional extensions to Hierarchy/Temporal.
