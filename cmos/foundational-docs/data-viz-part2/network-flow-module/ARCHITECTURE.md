# Network & Flow Module Architecture

**Version:** 1.0.0
**Status:** ECharts-First Implementation
**Last Updated:** December 2025
**Research Basis:** RDS.11.1–11.5, R33.0 (Renderer Parameter Alignment)

---

## Executive Summary

The Network & Flow Module extends OODS with four visualization types:

| Category | Viz Types | Data Structure |
|----------|-----------|----------------|
| **Hierarchy** | Treemap, Sunburst | Recursive tree (parent-child) |
| **Network** | Force-Directed Graph | Nodes + Links (many-to-many) |
| **Flow** | Sankey | Nodes + Links (directed, weighted) |

**Key Architectural Decision:** The Network & Flow Module adopts an **ECharts-First** strategy:

- **v1.0 (Current):** ECharts-only implementation. All four viz types render via ECharts native series.
- **v1.1+ (Deferred):** Optional Vega-Lite path may be added based on user demand.

This decision was made following R33.0 research which revealed:
1. ECharts provides native, presentation-ready support for all four types
2. D3/Vega defaults diverge significantly from ECharts (6-10x force multipliers, different tiling ratios)
3. Achieving visual parity would require extensive parameter alignment
4. ECharts includes built-in interactivity (drill-down, focus effects) that D3 lacks

**Implication:** For Network & Flow visualizations, **ECharts is required**. This is documented as a known constraint, not a limitation.

---

## 1. Renderer Capability Matrix

| Visualization | ECharts | Vega-Lite | Full Vega | OODS v1.0 Strategy |
|---------------|---------|-----------|-----------|-------------------|
| **Treemap** | ✅ Native (`series-treemap`) | ⏸️ Deferred | ⏸️ Deferred | **ECharts only** |
| **Sunburst** | ✅ Native (`series-sunburst`) | ⏸️ Deferred | ⏸️ Deferred | **ECharts only** |
| **Force Graph** | ✅ Native (`series-graph`, `layout: 'force'`) | ⏸️ Deferred | ⏸️ Deferred | **ECharts only** |
| **Sankey** | ✅ Native (`series-sankey`) | ❌ Impossible | ⏸️ Deferred | **ECharts only** |

> **Note:** Vega-Lite and Full Vega support is deferred to v1.1+. The architecture and schemas are designed to support future addition of these paths without breaking changes.

### Why Sankey is Special

Sankey links are curved bands (cubic Bézier paths). The rendering requires:

1. Computing node positions (x0/y0/x1/y1)
2. Computing link paths (y0, y1, width at each end)
3. Generating SVG path strings for the curved bands

**Vega-Lite Limitation:** The `path` mark in Vega-Lite is designed for geo shapes, not arbitrary SVG paths. There is no way to bind a data field to the `d` attribute.

**Full Vega Solution:** Pure Vega's `path` mark supports `"path": {"field": "svg_path"}` binding.

**Decision:** For Sankey diagrams, OODS will either:
1. Route to ECharts (preferred)
2. Compile to Full Vega spec (escape hatch)
3. Reject if only Vega-Lite available

---

## 2. Data Schema Contracts

### 2.1 Hierarchy Input (Treemap, Sunburst)

OODS accepts **either** format and normalizes internally:

**Format A: Adjacency List (Flat)**
```typescript
interface HierarchyAdjacencyInput {
  type: 'adjacency_list';
  data: Array<{
    id: string;
    parentId: string | null;  // null = root
    value: number;
    [key: string]: unknown;   // preserved fields
  }>;
}
```

**Format B: Nested JSON**
```typescript
interface HierarchyNestedInput {
  type: 'nested';
  data: {
    name: string;
    value?: number;
    children?: HierarchyNestedInput['data'][];
    [key: string]: unknown;
  };
}
```

### 2.2 Network Input (Force Graph)

```typescript
interface NetworkInput {
  nodes: Array<{
    id: string;
    group?: string;           // for color encoding
    radius?: number;          // for size encoding
    fixed?: boolean;          // pin position
    x?: number;               // initial/fixed position
    y?: number;
    [key: string]: unknown;
  }>;
  links: Array<{
    source: string;           // node id
    target: string;           // node id
    value?: number;           // edge weight
    [key: string]: unknown;
  }>;
}
```

### 2.3 Flow Input (Sankey)

```typescript
interface SankeyInput {
  nodes: Array<{
    name: string;             // unique identifier
    [key: string]: unknown;
  }>;
  links: Array<{
    source: string;           // node name
    target: string;           // node name
    value: number;            // flow magnitude (required)
    [key: string]: unknown;
  }>;
}
```

---

## 3. Resolver Service

The Resolver Service determines the rendering path for each visualization request.

### 3.1 Interface (v1.0 - ECharts-First)

```typescript
interface ResolverInput {
  vizType: 'treemap' | 'sunburst' | 'force_graph' | 'sankey';
  data: HierarchyAdjacencyInput | HierarchyNestedInput | NetworkInput | SankeyInput;
  availableRenderers: ('echarts' | 'vega-lite' | 'vega')[];
  dimensions: { width: number; height: number };
}

interface ResolverOutput {
  path: 'echarts_passthrough' | 'unsupported';
  renderer: 'echarts' | null;
  requiresTransform: false;  // ECharts handles layout natively
  reason: string;
}
```

### 3.2 Decision Logic (v1.0 - Simplified)

```
RESOLVE(vizType, availableRenderers):

  IF vizType in ['treemap', 'sunburst', 'force_graph', 'sankey']:
    IF 'echarts' in availableRenderers:
      RETURN {
        path: 'echarts_passthrough',
        renderer: 'echarts',
        requiresTransform: false,
        reason: 'ECharts native support'
      }
    ELSE:
      RETURN {
        path: 'unsupported',
        renderer: null,
        reason: 'Network & Flow visualizations require ECharts (v1.0). Vega support planned for v1.1+'
      }
```

### 3.3 Path Explanations (v1.0)

| Path | When Used | What Happens |
|------|-----------|--------------|
| `echarts_passthrough` | ECharts available | Data formatted for ECharts native series, layout computed client-side |
| `unsupported` | ECharts not available | Return actionable error directing user to enable ECharts |

### 3.4 Future Paths (v1.1+ - Deferred)

The following paths are designed but not implemented in v1.0:

| Path | When Used | What Happens |
|------|-----------|--------------|
| `vega_passthrough` | Full Vega available | Data + Vega spec with transforms |
| `server_transform` | Only Vega-Lite available | Server runs D3 transforms, outputs flat coordinates |
| `vega_escape_hatch` | Sankey + Vega available | Server runs D3-sankey, generates SVG paths |

These paths require the deferred D3 transform implementations (see Section 4).

---

## 4. Transformation Engine (Deferred to v1.1+)

> **Status:** This section documents the deferred D3 transformation engine. It is NOT implemented in v1.0.
> ECharts handles all layout computation client-side, so no server-side transforms are needed.

For future paths requiring `server_transform` or `vega_escape_hatch`, OODS would run D3 algorithms server-side.

### 4.1 Execution Environment (Deferred)

- **Runtime:** Node.js (same as OODS backend)
- **Dependencies:** `d3-hierarchy`, `d3-force`, `d3-sankey`, `d3-sankey-circular`
- **No DOM Required:** All D3 layout algorithms operate on pure JavaScript objects

### 4.1.1 Why Transforms Are Deferred

R33.0 research revealed significant parameter divergence between ECharts and D3:

| Parameter | ECharts Default | D3 Default | Alignment Effort |
|-----------|-----------------|------------|------------------|
| Force repulsion | 50 | -30 | 6-10x multiplier needed |
| Treemap ratio | Golden (1.618) | Square (1.0) | Custom tiling function |
| Sankey iterations | 32 | 6 | Simple parameter change |
| Gravity | 0.1 (true gravity) | forceCenter (translation only) | Add forceX/Y |

Achieving visual parity would require:
1. Extensive parameter mapping
2. Custom alignment functions
3. Acceptance of "layout-equivalent" (not pixel-perfect) output

**Decision:** Defer this complexity until user demand justifies it.

### 4.2 Transform Implementations

#### 4.2.1 Hierarchy Transform (Treemap/Sunburst)

```typescript
import * as d3 from 'd3-hierarchy';

interface TreemapOutput {
  nodes: Array<{
    id: string;
    x0: number;  // left edge
    y0: number;  // top edge
    x1: number;  // right edge
    y1: number;  // bottom edge
    depth: number;
    value: number;
    [key: string]: unknown;  // preserved fields
  }>;
}

interface SunburstOutput {
  nodes: Array<{
    id: string;
    startAngle: number;   // radians
    endAngle: number;     // radians
    innerRadius: number;  // pixels or normalized
    outerRadius: number;
    depth: number;
    value: number;
    [key: string]: unknown;
  }>;
}

function computeTreemap(input: HierarchyAdjacencyInput, width: number, height: number): TreemapOutput {
  // 1. Stratify flat data to tree
  const stratify = d3.stratify<typeof input.data[0]>()
    .id(d => d.id)
    .parentId(d => d.parentId);
  
  const root = stratify(input.data);
  
  // 2. Compute values (sum from leaves)
  root.sum(d => d.value || 0);
  
  // 3. Sort for stability
  root.sort((a, b) => (b.value || 0) - (a.value || 0));
  
  // 4. Apply treemap layout
  const treemap = d3.treemap<typeof root.data>()
    .size([width, height])
    .paddingInner(1)
    .paddingOuter(2)
    .tile(d3.treemapSquarify);
  
  treemap(root);
  
  // 5. Flatten to output
  return {
    nodes: root.descendants().map(node => ({
      id: node.data.id,
      x0: node.x0,
      y0: node.y0,
      x1: node.x1,
      y1: node.y1,
      depth: node.depth,
      value: node.value,
      ...node.data  // preserve original fields
    }))
  };
}

function computeSunburst(input: HierarchyAdjacencyInput, radius: number): SunburstOutput {
  const stratify = d3.stratify<typeof input.data[0]>()
    .id(d => d.id)
    .parentId(d => d.parentId);
  
  const root = stratify(input.data);
  root.sum(d => d.value || 0);
  root.sort((a, b) => (b.value || 0) - (a.value || 0));
  
  // Partition layout: width = angle (2π), height = radius
  const partition = d3.partition<typeof root.data>()
    .size([2 * Math.PI, radius]);
  
  partition(root);
  
  return {
    nodes: root.descendants().map(node => ({
      id: node.data.id,
      startAngle: node.x0,
      endAngle: node.x1,
      innerRadius: node.y0,
      outerRadius: node.y1,
      depth: node.depth,
      value: node.value,
      ...node.data
    }))
  };
}
```

#### 4.2.2 Force Transform (Network Graph)

```typescript
import * as d3 from 'd3-force';

interface ForceOutput {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    [key: string]: unknown;
  }>;
  links: Array<{
    source: string;
    target: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    [key: string]: unknown;
  }>;
}

function computeForceLayout(input: NetworkInput, width: number, height: number): ForceOutput {
  // Deep clone to avoid mutation
  const nodes = input.nodes.map(n => ({ ...n }));
  const links = input.links.map(l => ({ ...l }));
  
  // Deterministic initialization (spiral)
  nodes.forEach((node, i) => {
    const angle = i * 0.1;
    const radius = 10 * Math.sqrt(i);
    node.x = width / 2 + radius * Math.cos(angle);
    node.y = height / 2 + radius * Math.sin(angle);
  });
  
  // Create simulation
  const simulation = d3.forceSimulation(nodes)
    .stop()  // CRITICAL: Stop timer for batch mode
    .force('charge', d3.forceManyBody().strength(-50))
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
    .force('collide', d3.forceCollide().radius((d: any) => (d.radius || 5) + 2))
    .force('center', d3.forceCenter(width / 2, height / 2));
  
  // Run to convergence
  const iterations = 300;
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }
  
  // Denormalize links (replace object refs with coordinates)
  const exportLinks = links.map((link: any) => ({
    source: link.source.id,
    target: link.target.id,
    x1: link.source.x,
    y1: link.source.y,
    x2: link.target.x,
    y2: link.target.y,
    ...input.links.find(l => l.source === link.source.id && l.target === link.target.id)
  }));
  
  return {
    nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y, ...n })),
    links: exportLinks
  };
}
```

#### 4.2.3 Sankey Transform (Flow Diagram)

```typescript
import * as d3Sankey from 'd3-sankey';

interface SankeyOutput {
  nodes: Array<{
    name: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    value: number;
    [key: string]: unknown;
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
    width: number;
    svgPath: string;  // The critical SVG path string
    [key: string]: unknown;
  }>;
}

function computeSankeyLayout(input: SankeyInput, width: number, height: number): SankeyOutput {
  const sankey = d3Sankey.sankey()
    .nodeId((d: any) => d.name)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[0, 0], [width, height]]);
  
  // Deep clone
  const graph = {
    nodes: input.nodes.map(n => ({ ...n })),
    links: input.links.map(l => ({ ...l }))
  };
  
  // Compute layout
  const { nodes, links } = sankey(graph);
  
  // Generate SVG path for each link
  const linkPathGenerator = d3Sankey.sankeyLinkHorizontal();
  
  const exportLinks = links.map((link: any) => {
    const pathD = linkPathGenerator(link);
    return {
      source: link.source.name,
      target: link.target.name,
      value: link.value,
      width: link.width,
      y0: link.y0,
      y1: link.y1,
      svgPath: pathD,  // The actual SVG path string!
      ...input.links.find(l => l.source === link.source.name && l.target === link.target.name)
    };
  });
  
  return {
    nodes: nodes.map((n: any) => ({
      name: n.name,
      x0: n.x0,
      y0: n.y0,
      x1: n.x1,
      y1: n.y1,
      value: n.value,
      ...n
    })),
    links: exportLinks
  };
}
```

---

## 5. Adapter Output Specifications

### 5.1 ECharts Adapter (Pass-Through)

For ECharts, the adapter converts OODS normalized data to ECharts series format.

**Treemap/Sunburst:** Recursive `children` structure
```json
{
  "series": [{
    "type": "treemap",
    "data": [{
      "name": "Root",
      "value": 1000,
      "children": [
        { "name": "A", "value": 600 },
        { "name": "B", "value": 400 }
      ]
    }]
  }]
}
```

**Graph:** `data` + `links` arrays
```json
{
  "series": [{
    "type": "graph",
    "layout": "force",
    "data": [
      { "id": "A", "name": "A", "category": 0 },
      { "id": "B", "name": "B", "category": 1 }
    ],
    "links": [
      { "source": "A", "target": "B", "value": 10 }
    ],
    "categories": [
      { "name": "Type1" },
      { "name": "Type2" }
    ]
  }]
}
```

**Sankey:** `data` + `links` arrays
```json
{
  "series": [{
    "type": "sankey",
    "data": [
      { "name": "Coal" },
      { "name": "Electricity" }
    ],
    "links": [
      { "source": "Coal", "target": "Electricity", "value": 100 }
    ]
  }]
}
```

### 5.2 Vega-Lite Adapter (Server Transform Path)

For Vega-Lite with server-side transforms, output is flat coordinate data.

**Treemap:**
```json
{
  "data": { "values": [
    { "id": "A", "x0": 0, "y0": 0, "x1": 100, "y1": 60, "depth": 1 },
    { "id": "B", "x0": 0, "y0": 60, "x1": 100, "y1": 100, "depth": 1 }
  ]},
  "mark": "rect",
  "encoding": {
    "x": { "field": "x0", "type": "quantitative", "axis": null },
    "y": { "field": "y0", "type": "quantitative", "axis": null },
    "x2": { "field": "x1" },
    "y2": { "field": "y1" },
    "color": { "field": "depth", "type": "ordinal" }
  }
}
```

**Sunburst:**
```json
{
  "data": { "values": [
    { "id": "A", "startAngle": 0, "endAngle": 3.14, "innerRadius": 50, "outerRadius": 100 }
  ]},
  "mark": "arc",
  "encoding": {
    "theta": { "field": "startAngle", "type": "quantitative" },
    "theta2": { "field": "endAngle" },
    "radius": { "field": "outerRadius", "type": "quantitative" },
    "radius2": { "field": "innerRadius" },
    "color": { "field": "id", "type": "nominal" }
  }
}
```

**Force Graph:**
```json
{
  "layer": [
    {
      "data": { "values": "<<links>>" },
      "mark": "rule",
      "encoding": {
        "x": { "field": "x1", "type": "quantitative" },
        "y": { "field": "y1", "type": "quantitative" },
        "x2": { "field": "x2" },
        "y2": { "field": "y2" },
        "strokeOpacity": { "value": 0.3 }
      }
    },
    {
      "data": { "values": "<<nodes>>" },
      "mark": "circle",
      "encoding": {
        "x": { "field": "x", "type": "quantitative" },
        "y": { "field": "y", "type": "quantitative" },
        "size": { "field": "radius", "type": "quantitative" },
        "color": { "field": "group", "type": "nominal" }
      }
    }
  ]
}
```

### 5.3 Full Vega Adapter (Escape Hatch for Sankey)

For Sankey in Vega, we output a Full Vega spec with direct path binding:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "data": [
    { "name": "nodes", "values": "<<nodes>>" },
    { "name": "links", "values": "<<links>>" }
  ],
  "marks": [
    {
      "type": "path",
      "from": { "data": "links" },
      "encode": {
        "enter": {
          "path": { "field": "svgPath" },
          "fill": { "value": "#aaa" },
          "fillOpacity": { "value": 0.5 }
        }
      }
    },
    {
      "type": "rect",
      "from": { "data": "nodes" },
      "encode": {
        "enter": {
          "x": { "field": "x0" },
          "y": { "field": "y0" },
          "width": { "signal": "datum.x1 - datum.x0" },
          "height": { "signal": "datum.y1 - datum.y0" },
          "fill": { "value": "#333" }
        }
      }
    }
  ]
}
```

### 5.2 OODS Token Usage in Adapters

**CRITICAL:** Visualization adapters and stories must use the correct OODS CSS variable names.

#### Token Naming Convention

The OODS token system uses a three-tier hierarchy:

| Tier | Prefix | Example | Use Case |
|------|--------|---------|----------|
| Reference | `--ref-` | `--ref-color-neutral-100` | Raw design values (don't use directly) |
| System | `--sys-` | `--sys-surface-canvas` | Semantic tokens for theming |
| Component | `--cmp-` | `--cmp-surface-canvas` | Component-specific mappings |

#### Common Token Mistakes

**Wrong:** `var(--sys-surface)` - This token doesn't exist!

**Correct Surface Tokens:**
```css
/* Page background */
--sys-surface-canvas

/* Subtle panel background */
--sys-surface-subtle

/* Raised/elevated surfaces */
--sys-surface-raised

/* Interactive surfaces */
--sys-surface-interactive-primary-default
```

**Correct Border Tokens:**
```css
--sys-border-subtle
--sys-border-strong
```

**Correct Text Tokens:**
```css
--sys-text-primary
--sys-text-secondary
--sys-text-muted
--sys-text-strong
```

#### ECharts Canvas Renderer Limitation

**CRITICAL:** ECharts uses a canvas renderer that **cannot resolve CSS variables**. You must resolve tokens to actual color values (hex, rgb) at runtime.

```typescript
// WRONG - ECharts will show these as black (#000000)
const palette = ['var(--viz-scale-categorical-01)', 'var(--viz-scale-categorical-02)'];

// CORRECT - Use tokensBundle to resolve to actual colors
import tokensBundle from '@oods/tokens';

const CSS_VARIABLE_MAP = (tokensBundle?.cssVariables as Record<string, string>) ?? {};

function resolveTokenToColor(token: string): string | undefined {
  const normalized = token.startsWith('--') ? token : `--${token}`;
  const value = CSS_VARIABLE_MAP[normalized];
  if (!value) return undefined;

  // OKLCH colors need conversion to RGB for canvas
  if (value.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(value);
  }
  return value;
}
```

#### Fallback Palettes

Always provide fallback colors in case tokens aren't available:

```typescript
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
];

function buildPalette(): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 8 });
  const resolved = tokens.map(resolveTokenToColor);

  if (resolved.every((c) => c === undefined)) {
    return FALLBACK_PALETTE;
  }

  return resolved.map((color, i) =>
    color ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]
  );
}
```

#### UI Colors (Borders, Labels)

For UI elements, use hardcoded fallbacks since ECharts canvas can't use CSS cascade:

```typescript
const BORDER_COLOR = '#e0e0e0';      // --sys-border-subtle
const LABEL_COLOR = '#333333';        // --sys-text-primary
const SURFACE_COLOR = '#ffffff';      // --sys-surface-canvas
```

#### Storybook Story Containers

Stories should use fallback chains for container backgrounds:

```tsx
<div style={{
  background: 'var(--sys-surface-canvas, var(--cmp-surface-canvas, transparent))',
}}>
  {/* Chart renders here */}
</div>
```

The fallback chain ensures:
1. Primary: System token (for theme switching)
2. Fallback: Component token (if system not available)
3. Final: Transparent (if no tokens loaded)

---

## 6. Trait Definitions

### 6.1 New Traits for Network & Flow

```yaml
# traits/viz/data-topology.trait.yaml
trait:
  id: DataTopology
  category: viz.data
  description: Defines topological data structure type
  properties:
    topology:
      type: enum
      values: [hierarchy, network, flow]
      required: true
    inputFormat:
      type: enum
      values: [adjacency_list, nested, nodes_links]
      required: true

# traits/viz/layout-hierarchy.trait.yaml
trait:
  id: LayoutHierarchy
  category: viz.layout
  extends: DataTopology
  properties:
    topology:
      const: hierarchy
    algorithm:
      type: enum
      values: [treemap, sunburst, icicle, pack]
      required: true
    tiling:
      type: enum
      values: [squarify, binary, slice, dice]
      default: squarify
      when: algorithm == treemap

# traits/viz/layout-network.trait.yaml
trait:
  id: LayoutNetwork
  category: viz.layout
  extends: DataTopology
  properties:
    topology:
      const: network
    algorithm:
      type: enum
      values: [force, circular, none]
      default: force
    forceStrength:
      type: number
      default: -50
      when: algorithm == force

# traits/viz/layout-flow.trait.yaml
trait:
  id: LayoutFlow
  category: viz.layout
  extends: DataTopology
  properties:
    topology:
      const: flow
    algorithm:
      type: enum
      values: [sankey, alluvial]
      default: sankey
    nodeAlign:
      type: enum
      values: [justify, left, right, center]
      default: justify
```

### 6.2 New Marks

```yaml
# traits/viz/mark-hierarchy.trait.yaml
trait:
  id: MarkHierarchy
  category: viz.mark
  description: Mark for hierarchy layouts (renders rect or arc based on algorithm)
  properties:
    type:
      const: hierarchy
    renderAs:
      type: enum
      values: [rect, arc]
      derived: true  # Derived from layout algorithm

# traits/viz/mark-network.trait.yaml  
trait:
  id: MarkNetwork
  category: viz.mark
  description: Mark for network graphs (nodes + links)
  properties:
    type:
      const: network
    nodeShape:
      type: enum
      values: [circle, rect, symbol]
      default: circle
    linkStyle:
      type: enum
      values: [line, curve, orthogonal]
      default: line

# traits/viz/mark-sankey.trait.yaml
trait:
  id: MarkSankey
  category: viz.mark
  description: Mark for Sankey/flow diagrams
  properties:
    type:
      const: sankey
    nodeWidth:
      type: number
      default: 15
    nodePadding:
      type: number
      default: 10
```

---

## 7. Normalized Spec Extensions

Extend `normalized-viz-spec.schema.json` with new transform types:

```json
{
  "definitions": {
    "Transform": {
      "properties": {
        "type": {
          "enum": [
            "aggregate", "calculate", "filter", "sort", "window", "stack", "bin",
            "stratify", "treemap", "partition", "force", "sankey"
          ]
        }
      }
    },
    
    "StratifyTransform": {
      "type": "object",
      "properties": {
        "type": { "const": "stratify" },
        "params": {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "Field for node ID" },
            "parentKey": { "type": "string", "description": "Field for parent ID" }
          },
          "required": ["key", "parentKey"]
        }
      }
    },
    
    "TreemapTransform": {
      "type": "object",
      "properties": {
        "type": { "const": "treemap" },
        "params": {
          "type": "object",
          "properties": {
            "field": { "type": "string", "description": "Value field for sizing" },
            "method": { "enum": ["squarify", "binary", "slice", "dice"] },
            "padding": { "type": "number" },
            "size": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 }
          }
        }
      }
    },
    
    "ForceTransform": {
      "type": "object",
      "properties": {
        "type": { "const": "force" },
        "params": {
          "type": "object",
          "properties": {
            "iterations": { "type": "integer", "default": 300 },
            "forces": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "force": { "enum": ["center", "collide", "link", "nbody", "x", "y"] }
                }
              }
            }
          }
        }
      }
    },
    
    "SankeyTransform": {
      "type": "object",
      "properties": {
        "type": { "const": "sankey" },
        "params": {
          "type": "object",
          "properties": {
            "nodeWidth": { "type": "number", "default": 15 },
            "nodePadding": { "type": "number", "default": 10 },
            "nodeAlign": { "enum": ["justify", "left", "right", "center"] },
            "iterations": { "type": "integer", "default": 32 }
          }
        }
      }
    }
  }
}
```

---

## 8. Error Handling

### 8.1 Data Validation

The Transformation Engine must validate inputs before processing:

| Validation | Check | Error |
|------------|-------|-------|
| **Missing Parent** | All `parentId` values exist in dataset | `HIERARCHY_ORPHAN_NODE` |
| **Cycle Detection** | No circular parent-child references | `HIERARCHY_CYCLE_DETECTED` |
| **Multiple Roots** | Only one node with `parentId: null` (or inject synthetic root) | `HIERARCHY_MULTIPLE_ROOTS` |
| **Missing Links** | All link `source`/`target` exist in nodes | `NETWORK_BROKEN_LINK` |
| **Sankey Cycles** | DAG validation (warn, don't fail—use d3-sankey-circular) | `SANKEY_CYCLE_WARNING` |

### 8.2 Fallback Behavior

```typescript
interface TransformResult {
  success: boolean;
  data?: TransformOutput;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    fallback?: 'inject_root' | 'remove_orphans' | 'break_cycles';
  };
}
```

---

## 9. Performance Considerations

### 9.1 Data Volume Thresholds

| Viz Type | Recommended Max | Soft Limit | Hard Limit |
|----------|-----------------|------------|------------|
| Treemap | 500 nodes | 2,000 nodes | 10,000 nodes |
| Sunburst | 300 nodes | 1,000 nodes | 5,000 nodes |
| Force Graph | 200 nodes | 500 nodes | 2,000 nodes |
| Sankey | 50 nodes | 200 nodes | 500 nodes |

### 9.2 Optimization Strategies

**Server-Side:**
- Cache computed layouts for identical data hashes
- Use Web Workers for force simulation (non-blocking)
- Pre-aggregate data before sending to transform

**Client-Side (ECharts):**
- Use Canvas renderer (not SVG) for large graphs
- Enable `progressive` rendering for treemaps
- Set `animation: false` for initial load on large datasets

---

## 10. File Structure

```
packages/viz-network-flow/
├── src/
│   ├── index.ts
│   ├── resolver/
│   │   ├── index.ts
│   │   └── resolver.ts
│   ├── transforms/
│   │   ├── index.ts
│   │   ├── hierarchy-transform.ts
│   │   ├── force-transform.ts
│   │   └── sankey-transform.ts
│   ├── adapters/
│   │   ├── echarts/
│   │   │   ├── treemap-adapter.ts
│   │   │   ├── sunburst-adapter.ts
│   │   │   ├── graph-adapter.ts
│   │   │   └── sankey-adapter.ts
│   │   ├── vega-lite/
│   │   │   ├── treemap-adapter.ts
│   │   │   ├── sunburst-adapter.ts
│   │   │   └── graph-adapter.ts
│   │   └── vega/
│   │       └── sankey-adapter.ts
│   ├── schemas/
│   │   ├── hierarchy-input.schema.json
│   │   ├── network-input.schema.json
│   │   ├── sankey-input.schema.json
│   │   └── transform-output.schema.json
│   └── types/
│       └── index.ts
├── traits/
│   ├── data-topology.trait.yaml
│   ├── layout-hierarchy.trait.yaml
│   ├── layout-network.trait.yaml
│   ├── layout-flow.trait.yaml
│   ├── mark-hierarchy.trait.yaml
│   ├── mark-network.trait.yaml
│   └── mark-sankey.trait.yaml
├── tests/
│   ├── resolver.test.ts
│   ├── transforms/
│   │   ├── hierarchy.test.ts
│   │   ├── force.test.ts
│   │   └── sankey.test.ts
│   └── adapters/
│       └── ...
├── package.json
└── tsconfig.json
```

---

## 11. Dependencies

```json
{
  "dependencies": {
    "d3-hierarchy": "^3.1.2",
    "d3-force": "^3.0.0",
    "d3-sankey": "^0.12.3",
    "d3-sankey-circular": "^0.33.0"
  },
  "devDependencies": {
    "@types/d3-hierarchy": "^3.1.0",
    "@types/d3-force": "^3.0.0",
    "@types/d3-sankey": "^0.12.0"
  }
}
```

---

## 12. Research Lineage

This architecture is derived from:

| Mission | Finding | Impact |
|---------|---------|--------|
| **RDS.11.1** | D3-hierarchy API, stratify/treemap/partition contracts | Transform implementations |
| **RDS.11.2** | D3-force API, deterministic batch processing, coordinate denormalization | Force transform + Node.js execution |
| **RDS.11.3** | D3-sankey API, SVG path generation, Vega-Lite impossibility | Vega escape hatch decision |
| **RDS.11.4** | Full Vega transforms exist, Vega-Lite lacks them | Dual-path architecture |
| **RDS.11.5** | ECharts native support, no transforms needed | ECharts-first strategy |

---

## 13. Implementation Roadmap

### 13.1 Sprint 33: ECharts-First Foundation (v1.0)

| Mission | Name | Deliverables |
|---------|------|--------------|
| B33.1 | Network Flow Schemas | Input/output schemas, TypeScript types, validators |
| B33.2 | Resolver Service (ECharts-First) | Simplified resolver routing to ECharts |
| B33.3 | ECharts Hierarchy Adapters | Treemap + Sunburst adapters |
| B33.4 | ECharts Graph Adapter | Force-directed graph adapter |
| B33.5 | ECharts Sankey Adapter | Sankey/flow diagram adapter |
| B33.6 | Network Flow Traits | Hierarchical, NetworkTopology, FlowConservation traits |

### 13.2 Sprint 34: Integration & Release (v1.0)

| Mission | Name | Deliverables |
|---------|------|--------------|
| B34.1 | Network Flow Components | React components for all four viz types |
| B34.2 | Dashboard Integration & CLI | Cross-filter support, CLI tooling |
| B34.3 | Documentation & Storybook | User docs, Storybook stories, examples |
| B34.4 | Network Flow v1.0 Release | Final testing, release notes, deployment |

### 13.3 Deferred Work (v1.1+ - Optional)

The following work is deferred pending user demand:

| Mission | Name | Trigger |
|---------|------|---------|
| D35.1 | D3 Hierarchy Transforms | User request for VL treemap/sunburst |
| D35.2 | D3 Force Transform | User request for VL force graph |
| D35.3 | D3 Sankey Transform | User request for VL sankey |
| D35.4 | Vega-Lite Adapters | Completion of D35.1-D35.3 |
| D35.5 | Vega Escape Hatch | VL Sankey impossible, Full Vega needed |

**Research Basis:** R33.0 established parameter mappings for future alignment work.

### 13.4 Key Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2025 | ECharts-First for v1.0 | R33.0 revealed significant D3/ECharts divergence; ECharts provides native support with better defaults |
| Dec 2025 | Defer VL path to v1.1+ | No immediate user demand; reduces sprint scope from 12 to 10 sessions |
| Dec 2025 | Accept ECharts requirement | Documented constraint, not limitation; ECharts handles all viz types natively |
