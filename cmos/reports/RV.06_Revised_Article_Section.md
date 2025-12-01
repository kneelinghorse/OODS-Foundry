# Revised Archetype Section (Publication-Ready)

**Where the model stands**  
Across a stratified corpus of 300 dashboards (3,250 widgets), the OODS visualization library covered **87.4%** of observed widgets (Wilson 95% CI **86.2%–88.5%**). Coverage is strong but **domain-dependent**: Finance 93%, HR 92%, Sales 86%, Marketing 84%, Cybersecurity 81%. The uncovered 12.6% clusters around network/topology views, multi-stage flow diagrams, and layered geospatial maps.

**What changes**  
We are **evolving from six to eight archetypes** to close the structural gaps:
- **Topology** — node-link and adjacency views for systems where structure is the signal (threat maps, supply chains, knowledge graphs).
- **Flow** — Sankey, alluvial, and chord diagrams for conserved movement of value, energy, or users through multi-stage funnels.
- **Spatial as canvas** — geospatial becomes a first-class coordinate layer (choropleths, clustered pins, routes/heat layers) applicable to Distribution, Comparison, and Topology.

**What remains**  
The existing six archetypes stay intact and continue to cover the majority of business reporting (bars, lines, KPIs, tables, part-to-whole, distributions, matrices). Composite rules are being clarified (e.g., stacked vs. grouped bars; KPI-with-sparkline vs. Line).

**How to read the claims**  
The updated claim is: “OODS now covers **87.4%** of SaaS visualization needs overall (95% CI 86.2%–88.5%). Domain strength is near out-of-the-box for Finance/HR; advanced Flow/Topology modules are recommended for Cyber/Marketing/Logistics.” A bespoke “custom visualization container” remains available for the irreducible ~12% long tail.

**Where this goes next**  
Upcoming releases introduce Network and Flow modules plus geospatial layering utilities; accessibility, theming, and VRT baselines will expand to include dense graphs, flow links, and dark-mode map layers. Developers should update trait mappings and tokens for node/edge states, link emphasis, and route status.
