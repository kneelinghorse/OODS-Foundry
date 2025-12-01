# Network & Flow Module

**Status:** Architecture Complete → Ready for Build  
**Version:** v2.0 (Target)  
**Last Updated:** November 2025

---

## Overview

This module extends OODS visualization capabilities with four new chart types:

| Category | Viz Type | Data Structure | Primary Use Case |
|----------|----------|----------------|------------------|
| **Hierarchy** | Treemap | Parent-child tree | Part-to-whole, storage, budgets |
| **Hierarchy** | Sunburst | Parent-child tree | Drill-down exploration, taxonomies |
| **Network** | Force Graph | Nodes + Links | Relationships, dependencies, clusters |
| **Flow** | Sankey | Nodes + Directed Links | Flow conservation, attribution, journeys |

---

## Key Architecture Decision

**ECharts is the preferred renderer for all Network & Flow visualizations.**

| Renderer | Support Level | Notes |
|----------|---------------|-------|
| **ECharts** | ✅ Full native | Pass-through, no transforms needed |
| **Full Vega** | ✅ Full support | Has stratify/treemap/partition/force transforms |
| **Vega-Lite** | ⚠️ Partial | Requires server-side D3 transforms |
| **Vega-Lite (Sankey)** | ❌ Not supported | Cannot render curved link paths |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete technical specification |
| [ROADMAP.md](./ROADMAP.md) | Implementation phases and timeline |
| [missions/](./missions/) | Research mission briefs (completed) |

---

## Research Completed

All five research missions have been executed:

| Mission | Topic | Status | Key Finding |
|---------|-------|--------|-------------|
| **RDS.11.1** | D3-Hierarchy | ✅ Complete | stratify→treemap/partition outputs x0/y0/x1/y1 |
| **RDS.11.2** | D3-Force | ✅ Complete | Batch processing with .stop() + manual ticks |
| **RDS.11.3** | D3-Sankey | ✅ Complete | Must generate SVG path strings; VL can't render |
| **RDS.11.4** | Vega Transforms | ✅ Complete | Full Vega has all transforms; VL lacks them |
| **RDS.11.5** | ECharts Native | ✅ Complete | Native support for all four types |

---

## Architecture Summary

### Rendering Paths

```
┌─────────────────────────────────────────────────────────────────┐
│                         RESOLVER SERVICE                         │
│  Input: vizType + data + availableRenderers + preferred          │
└─────────────────────────────────────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   │   ECharts     │   │  Vega-Lite    │   │  Full Vega    │
   │  Pass-Through │   │ Server Trans. │   │ Escape Hatch  │
   └───────────────┘   └───────────────┘   └───────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
   Format data to        Run D3 transforms    Generate Full
   ECharts series        server-side, output  Vega spec with
   structure             flat coordinates     path mark binding
```

### Decision Matrix

| Viz Type | ECharts Available | Vega Available | VL Only | Path |
|----------|-------------------|----------------|---------|------|
| Treemap | ✓ | - | - | `echarts_passthrough` |
| Treemap | - | ✓ | - | `vega_passthrough` |
| Treemap | - | - | ✓ | `server_transform` |
| Sunburst | ✓ | - | - | `echarts_passthrough` |
| Sunburst | - | ✓ | - | `vega_passthrough` |
| Sunburst | - | - | ✓ | `server_transform` |
| Force Graph | ✓ | - | - | `echarts_passthrough` |
| Force Graph | - | ✓ | - | `vega_passthrough` |
| Force Graph | - | - | ✓ | `server_transform` |
| **Sankey** | ✓ | - | - | `echarts_passthrough` |
| **Sankey** | - | ✓ | - | `vega_escape_hatch` |
| **Sankey** | - | - | ✓ | **`unsupported`** |

---

## Data Contracts

### Hierarchy Input (Treemap, Sunburst)

```typescript
// Option A: Adjacency List
{ id: "A", parentId: null, value: 100 }
{ id: "B", parentId: "A", value: 60 }
{ id: "C", parentId: "A", value: 40 }

// Option B: Nested JSON
{ name: "A", value: 100, children: [
  { name: "B", value: 60 },
  { name: "C", value: 40 }
]}
```

### Network Input (Force Graph)

```typescript
{
  nodes: [
    { id: "server-1", group: "web" },
    { id: "server-2", group: "db" }
  ],
  links: [
    { source: "server-1", target: "server-2", value: 10 }
  ]
}
```

### Flow Input (Sankey)

```typescript
{
  nodes: [
    { name: "Coal" },
    { name: "Electricity" },
    { name: "Homes" }
  ],
  links: [
    { source: "Coal", target: "Electricity", value: 100 },
    { source: "Electricity", target: "Homes", value: 80 }
  ]
}
```

---

## Dependencies

```json
{
  "d3-hierarchy": "^3.1.2",
  "d3-force": "^3.0.0", 
  "d3-sankey": "^0.12.3",
  "d3-sankey-circular": "^0.33.0"
}
```

---

## Related Documents

- **Parent:** [OODS Viz Architecture](../README.md)
- **Sibling:** [Spatial Module](../spatial-module/ARCHITECTURE.md)
- **Research Origin:** RDS.10 (Renderer Transform Gap)
- **Validation Basis:** RV.03-04 (Gap Analysis), RV.05 (REVISE recommendation)
