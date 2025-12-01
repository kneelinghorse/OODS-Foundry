# Network & Flow v1.0 Constraints

## ECharts Requirement

In OODS v1.0, **all Network & Flow visualizations require ECharts**. This is a deliberate architectural decision, not a limitation.

```bash
# ECharts is a peer dependency
pnpm add echarts
```

### Why ECharts Only?

Following R33.0 research (Renderer Parameter Alignment), we found significant differences between rendering libraries:

| Aspect | ECharts | D3/Vega |
|--------|---------|---------|
| **Native support** | All 4 viz types | Requires transforms |
| **Interactivity** | Built-in (drill-down, zoom, tooltips) | Manual implementation |
| **Force parameters** | Well-tuned defaults | 6-10x adjustment needed |
| **Treemap tiling** | Golden ratio (1.618) | Square (1.0) |
| **Sankey** | Native series type | Vega-Lite: impossible |

### Research Findings

R33.0 established that achieving visual parity between renderers would require:

1. **Extensive parameter mapping** - ECharts repulsion of 50 = D3 repulsion of -30 (6-10x multiplier)
2. **Custom tiling functions** - Different treemap aspect ratios
3. **Transform pipelines** - D3 algorithms running server-side
4. **Acceptance of differences** - "Layout-equivalent" rather than pixel-perfect

**Decision:** Ship ECharts-only in v1.0, defer complexity to v1.1+ based on user demand.

## What This Means for You

### Installation

Ensure ECharts is in your bundle:

```bash
pnpm add echarts
```

### Component Usage

All Network & Flow components default to ECharts:

```tsx
import { Treemap, Sunburst, ForceGraph, Sankey } from '@oods/viz';

// These all use ECharts internally
<Treemap data={data} />
<Sunburst data={data} />
<ForceGraph data={data} />
<Sankey data={data} />
```

### Renderer Prop

The `renderer` prop exists for future compatibility but only accepts `'echarts'` in v1.0:

```tsx
// Valid in v1.0
<Treemap data={data} renderer="echarts" />

// Will show warning and fall back to ECharts
<Treemap data={data} renderer="vega-lite" />
// Console: "Treemap: renderer=\"vega-lite\" is not supported in v1.0.
//           Using ECharts. Vega-Lite support planned for v1.1+"
```

### Bundle Size

ECharts adds approximately 300KB (gzipped: ~100KB) to your bundle. For tree-shaking:

```tsx
// Full import (larger bundle)
import * as echarts from 'echarts';

// Components use dynamic import (smaller initial bundle)
// ECharts is loaded on first render
<Treemap data={data} />  // Loads echarts on mount
```

## Vega-Lite Limitations

For transparency, here's why Vega-Lite isn't supported in v1.0:

### Sankey: Impossible in Vega-Lite

Sankey links are curved bands (cubic Bézier paths). Vega-Lite's `path` mark is designed for geo shapes, not arbitrary SVG paths. There's no way to bind a data field to the `d` attribute.

**Solution:** Full Vega (not Lite) supports `path` mark with `{ "field": "svg_path" }`, but requires server-side D3-sankey to generate the paths.

### Force Graph: Requires External Layout

Vega-Lite has no built-in force simulation. Options:
1. Run D3-force server-side, output x/y coordinates
2. Use Full Vega's force transform

**Complexity:** Both require significant infrastructure.

### Treemap/Sunburst: Transform Mismatch

Vega-Lite's treemap/sunburst transforms use D3 defaults that differ from ECharts:
- Different tiling ratios
- Different padding calculations
- No built-in drill-down

## Future Support (v1.1+)

Based on user demand, we plan to add:

| Version | Feature | Trigger |
|---------|---------|---------|
| v1.1 | Vega-Lite treemap | User request + funding |
| v1.1 | Vega-Lite sunburst | User request + funding |
| v1.1 | Full Vega sankey | User request + funding |
| v1.2 | D3 force server transform | Enterprise demand |

### How to Request Vega-Lite Support

If you need Vega-Lite rendering for Network & Flow visualizations:

1. **Open an issue** describing your use case
2. **Explain the constraint** - Why can't you use ECharts?
3. **Prioritize** - Which viz type is most critical?

We'll evaluate requests and add to the roadmap based on demand.

## Migration Path

If you're coming from a D3/Vega-based implementation:

### Treemap/Sunburst

```tsx
// Before: D3 treemap
const treemap = d3.treemap()...
svg.selectAll('rect').data(root.leaves())...

// After: OODS Treemap
<Treemap data={data} drilldown breadcrumb />
```

Data format is compatible - adjacency list works with both.

### Force Graph

```tsx
// Before: D3 force simulation
const simulation = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-30))
  ...

// After: OODS ForceGraph
<ForceGraph
  data={{ nodes, links }}
  force={{ repulsion: 50 }}  // ECharts scale
/>
```

### Sankey

```tsx
// Before: D3-sankey
const sankey = d3.sankey()...
const { nodes, links } = sankey(graph);

// After: OODS Sankey
<Sankey data={{ nodes, links }} />
// ECharts handles layout internally
```

## FAQ

**Q: Can I use both ECharts and Vega-Lite in the same app?**

A: Yes. Standard OODS charts (bar, line, area, etc.) support both renderers. Only Network & Flow is ECharts-only.

**Q: Is ECharts tree-shakable?**

A: Partially. The Network & Flow components use dynamic import, so ECharts loads on first render rather than upfront.

**Q: Will my Network & Flow code break in v1.1?**

A: No. The API will remain stable. v1.1 will add Vega-Lite as an option, not remove ECharts.

**Q: Why not just include both renderers now?**

A: Shipping untested code increases bugs and bundle size. We'd rather ship well-tested ECharts support than half-baked multi-renderer support.

## Architectural Context

For the full technical rationale, see:

- [Architecture](../../../cmos/foundational-docs/data-viz-part2/network-flow-module/ARCHITECTURE.md)
- [Research Basis: RDS.11.1–11.5](../../../cmos/foundational-docs/data-viz-part2/research/)
- [R33.0 Renderer Alignment Research](../../../cmos/missions/research/)
