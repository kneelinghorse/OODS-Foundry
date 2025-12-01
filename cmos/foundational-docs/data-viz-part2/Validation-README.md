# OODS Visualization Architecture

**Status:** Research Complete → Implementation Ready  
**Last Updated:** November 2025

---

## Overview

This repository contains architecture documentation for extending the OODS visualization system with two new modules:

| Module | Version | Status | Timeline |
|--------|---------|--------|----------|
| **Spatial Module** | v1.1 | ✅ Architecture Complete | 8 weeks |
| **Network & Flow Module** | v2.0 | ✅ Architecture Complete | 10-12 weeks |

---

## Strategic Context

### Validation Research Summary (RV.01-05)

Statistical validation across **3,250 widgets** from **300 B2B SaaS dashboards** revealed:

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Coverage (6 core archetypes) | 87.4% | Substantial, but below 95% target |
| Cohen's κ | 0.763 | "Substantial" inter-rater reliability |
| Gap (Geospatial) | ~15-20% | Of FTVV taxonomy |
| Gap (Network + Geo) | ~12% | Of real dashboard widgets |

**Decision:** REVISE model with 2 extension modules (not CONFIRM with 6 archetypes only).

### Domain Coverage Analysis

| Domain | Current Coverage | Gap Types |
|--------|-----------------|-----------|
| Finance | 93% ✓ | Minimal |
| HR | 92% ✓ | Minimal |
| Sales | 86% | Attribution flows |
| Marketing | 84% ↓ | Attribution flows, funnels |
| Cybersecurity | 81% ↓ | Topology graphs, geo overlays |

---

## Module Summaries

### Spatial Module (v1.1) — Ready for Build

Adds geospatial visualization capabilities:
- Choropleth maps
- Bubble/symbol maps
- Route/flow maps

**Key Decision:** Pass-through implementation for both renderers (ECharts and Vega-Lite support geo natively).

**Timeline:** 8 weeks

[→ Full Architecture](./spatial-module/ARCHITECTURE.md)  
[→ Implementation Roadmap](./spatial-module/ROADMAP.md)

---

### Network & Flow Module (v2.0) — Research Complete, Ready for Build

Adds hierarchy and network visualization capabilities:
- Treemap
- Sunburst
- Force-directed graph
- Sankey diagram

**Key Decision:** Bifurcated architecture:
- **ECharts:** Preferred renderer (native support for all types)
- **Vega-Lite:** Requires server-side D3 transforms
- **Sankey + Vega-Lite:** Not supported (use Full Vega escape hatch)

**Timeline:** 10-12 weeks

[→ Full Architecture](./network-flow-module/ARCHITECTURE.md)  
[→ Implementation Roadmap](./network-flow-module/ROADMAP.md)

---

## Research Completed

### Spatial Module Research
- RDS.7-10 (Foundational research)
- RV.03 (Gap analysis — Geospatial identified)

### Network & Flow Module Research

| Mission | Topic | Finding |
|---------|-------|---------|
| **RDS.11.1** | D3-Hierarchy | stratify→treemap/partition works server-side, outputs x0/y0/x1/y1 |
| **RDS.11.2** | D3-Force | Deterministic batch processing with .stop() + tick loop |
| **RDS.11.3** | D3-Sankey | **Critical:** Must generate SVG path strings; Vega-Lite cannot render |
| **RDS.11.4** | Vega Transforms | Full Vega has all transforms; Vega-Lite lacks them entirely |
| **RDS.11.5** | ECharts Native | Native support for all four types; no transforms needed |

[→ Research Documents](./network-flow-module/missions/)

---

## Renderer Capability Matrix

| Viz Type | ECharts | Vega-Lite | Full Vega | Notes |
|----------|---------|-----------|-----------|-------|
| Choropleth | ✅ Native | ✅ Native | ✅ Native | Pass-through |
| Bubble Map | ✅ Native | ✅ Native | ✅ Native | Pass-through |
| Treemap | ✅ Native | ⚠️ Server transform | ✅ Native | Server-side D3 for VL |
| Sunburst | ✅ Native | ⚠️ Server transform | ✅ Native | Server-side D3 for VL |
| Force Graph | ✅ Native | ⚠️ Server transform | ✅ Native | Server-side D3 for VL |
| **Sankey** | ✅ Native | ❌ Impossible | ⚠️ Path mark only | VL cannot bind SVG paths |

---

## Target Metrics

| Metric | Current | Post-v1.1 | Post-v2.0 |
|--------|---------|-----------|-----------|
| Coverage | 87.4% | ~92% | ~95%+ |
| Viz Types | 6 | 9 | 13 |
| Renderer Parity | Full | Full | Partial (Sankey) |

---

## File Structure

```
OODS-viz-architecture/
├── README.md                          # This file
├── spatial-module/
│   ├── ARCHITECTURE.md                # Complete technical spec
│   └── ROADMAP.md                     # 8-week implementation plan
└── network-flow-module/
    ├── README.md                      # Module overview
    ├── ARCHITECTURE.md                # Complete technical spec
    ├── ROADMAP.md                     # 10-12 week implementation plan
    ├── MISSION_BRIEF_RDS.11.md        # Original research brief
    ├── RDS.11.1_D3_Hierarchy_Research.md
    ├── RDS.11.2_D3_Force_Research.md
    ├── RDS.11.3_D3_Sankey_Research.md
    ├── RDS.11.4_Vega_Transforms_Research.md
    ├── RDS.11.5_ECharts_Native_Research.md
    └── missions/                      # Original mission briefs
```

---

## Execution Recommendation

**Parallel execution is possible:**

1. **Spatial Module (v1.1)** — Start immediately
   - Simpler architecture (pass-through)
   - 8-week timeline
   - Quick coverage win (+5%)

2. **Network & Flow Module (v2.0)** — Start Week 3-4
   - More complex (transform engine required)
   - 10-12 week timeline
   - Can begin foundation work while Spatial ships

**Total timeline:** ~14-16 weeks for both modules with overlap

---

## Research Lineage

All architecture decisions trace to:

| Research | Finding | Decision |
|----------|---------|----------|
| RDS.10 | Renderer Transform Gap | Phased v1.1/v2.0 strategy |
| RV.01 | 300+ dashboard corpus | Real-world validation basis |
| RV.02 | Bottom-up categorization | Blind methodology |
| RV.03 | 78% coverage, gaps identified | Spatial + Network gaps |
| RV.04 | Topology/Conservation as fundamental | Network & Flow module scope |
| RV.05 | 87.4% coverage, κ=0.763 | REVISE recommendation |
| RDS.11.1-5 | D3/Vega/ECharts capabilities | Architecture decisions |

---

## Next Steps

1. **Review architecture documents** with team
2. **Prioritize:** Spatial first (faster win) or parallel execution
3. **Staff:** Assign developers to Phase 1 tasks
4. **Begin:** Schema definitions and resolver service
