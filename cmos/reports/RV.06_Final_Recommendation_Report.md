# OODS Visualization Archetype Validation — Final Recommendation

## Executive Decision
- **Recommendation: REVISE** the archetype model by elevating two additional core archetypes (**Topology** and **Flow**) and treating **Spatial** as a first-class canvas dimension. Maintain the existing six, but update documentation and coverage claims accordingly.
- **Why**: Global coverage is high (87.4% of 3,250 widgets, 95% CI **86.2%–88.5%**), but uncovered cases (12.6%) are **not random**—they cluster in coherent, cross-domain patterns (network/topology, flow/alluvial, and advanced geospatial layering) that exceed the “rare edge case” bar and materially impact Cybersecurity, Marketing, and Logistics.
- **Decision Framework Alignment**: Coverage ≥80% but with systematic gaps and blind-taxonomy divergence ⇒ triggers **REVISE** under the provided criteria.

## Evidence Base (synthesized across missions)
- **Sample & Reliability (RV.05)**: Stratified 300-dashboard corpus, 3,250 widgets. Cohen’s κ = **0.763** (substantial agreement) after resolving stacked vs. grouped ambiguities; MOE ≈ ±1.2%.
- **Global Coverage (RV.05)**: 2,840/3,250 widgets matched → **87.4%** coverage; Wilson 95% CI **[86.2%, 88.5%]** validating and slightly improving the prior 86% claim.
- **Domain Heterogeneity (RV.05)**: Finance 93% [91.2–94.5], HR 92% [88.3–94.6], Sales 86% [83.4–88.3], Marketing 84% [81.2–86.5], Cybersecurity 81% [77.3–84.3]; χ²(4)=48.52, p<0.001 → coverage is **not** domain-independent.
- **Gap Clusters (RV.05)**: Uncovered 410 widgets break down as Geospatial/Map Layers (~35%), Network & Flow (~25%), Calendar/Gantt (~20%), remainder misc composites. Long tail is **structural**, not noise.
- **Blind Taxonomy Mapping (RV.03)**: Six-archetype model covers ~78% of 64-chart blind vocabularies; explicit Geospatial and Text/Schematic categories remain unmapped. Proposed adding Spatial to exceed 90% coverage.
- **Edge-Case Analysis (RV.04)**: Identified **Fundamental Gaps** requiring new cores: Network/Topology and Flow; recommended Octagonal Framework. Classified Flame Graph as a domain extension (DevOps) and Geospatial as a canvas overlay across archetypes.
- **Corpus Stress Test (RV.01)**: “Wild” dashboards from Healthcare, Energy/IIoT, Public Sector highlighted persistent reliance on map-first layouts, small multiples, and alarm-first gauges—reinforcing need for geospatial layering and flow/topology in operational contexts.

## Recommendation Details
- **Model Revision**: Move from 6 to **8 archetypes** by adding:
  - **Topology**: Node-link, adjacency, route maps, knowledge graphs; covers Cyber/Logistics/Social graph needs.
  - **Flow**: Sankey, alluvial, chord, parallel sets; covers Product/Marketing attribution, energy/money flow.
  - **Spatial (canvas dimension)**: Treat geospatial as an orthogonal coordinate layer usable with Distribution, Comparison, and Topology (route/heat/layered maps).
- **Coverage Claim (article-ready)**: “Observed coverage **87.4%** across 3,250 widgets; 95% CI **86.2%–88.5%**. Domain-specific: Finance 93%, HR 92%, Sales 86%, Marketing 84%, Cybersecurity 81%. Gaps concentrate in network/flow and multi-layer geospatial views.”
- **Actionable Changes**:
  - Ship **Network Module** (force-directed, arc/adjacency matrix, topology legend) and **Flow Module** (Sankey/alluvial/chord with conservation checks).
  - Add **Geospatial layering** primitives (pin clustering, choropleth bins, route overlays, heat layers) as composable canvas utilities.
  - Clarify **composite classification rules** (stacked vs. grouped vs. 100%, KPI-with-sparkline vs. Line) to reduce coder ambiguity.
  - Provide a **Custom Visualization Container** for the irreducible ~12% bespoke cases with theming, spacing, and accessibility scaffolding.

## Impact on OODS Spec & Implementation
- **TEP / Traits**: Introduce traits for `TopologyRenderable`, `FlowConservative`, and `GeoLayered` to gate capabilities and a11y tokens; ensure theming tokens cover link weights, node states, and map layers without direct color literals.
- **Registry & Docs**: Update archetype registry and Storybook coverage tables; add domain-stratified coverage statement instead of single blanket figure.
- **Testing**: Extend VRT/a11y baselines for dark-mode map layers and dense node-link layouts; add enum-to-token mappings for new states (edge emphasis, route status).
- **Downstream Claims**: Adjust “What this unlocks” language to reflect domain-conditional strength (near out-of-box for Finance/HR; requires Flow/Topology modules for Cyber/Marketing/Logistics).

## Publication Stance
- **Recommendation Code**: **REVISE** (not CONFIRM, because gaps cluster above 5% and blind taxonomies diverge; not REJECT, because coverage is strong and gaps are addressable).
- **Confidence**: High for revision direction (driven by convergent evidence in RV.03–RV.05); moderate for exact uplift estimate (>95% post-module) pending implementation.

## Evidence Chain (refs)
- RV.01 Corpus & Domain Stress-Test
- RV.02 Emergent Grammar (bottom-up clades)
- RV.03 Blind Taxonomy Mapping (78% coverage; Spatial gap)
- RV.04 Gap Analysis (Topology/Flow fundamental; Octagonal proposal)
- RV.05 Statistical Validation (87.4% coverage; χ² domain dependence; κ=0.763)
