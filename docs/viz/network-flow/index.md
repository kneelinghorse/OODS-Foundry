# Network & Flow Module

**Version:** 1.0.0
**Status:** ECharts-First Implementation
**Last Updated:** December 2025

The Network & Flow Module extends OODS with four visualization types for hierarchical, network, and flow data:

| Category | Components | Use Case |
|----------|-----------|----------|
| **Hierarchy** | [Treemap](./treemap.md), [Sunburst](./sunburst.md) | Part-to-whole relationships, nested categories |
| **Network** | [ForceGraph](./force-graph.md) | Relationships between entities, graph structures |
| **Flow** | [Sankey](./sankey.md) | Directional flow, conversion funnels, resource allocation |

## Quick Start

```tsx
import { Treemap, Sunburst, ForceGraph, Sankey } from '@oods/viz';

// Hierarchy visualization
<Treemap
  data={{
    type: 'nested',
    data: { name: 'Root', children: [{ name: 'A', value: 100 }] }
  }}
  width={600}
  height={400}
/>

// Network visualization
<ForceGraph
  data={{
    nodes: [{ id: 'a' }, { id: 'b' }],
    links: [{ source: 'a', target: 'b', value: 10 }]
  }}
  width={800}
  height={600}
/>
```

## Key Features

- **Unified Data Formats** - Consistent input schemas across all viz types ([see Data Formats](./data-formats.md))
- **ECharts Rendering** - Native ECharts for optimal performance and interactivity
- **Accessibility Built-in** - ARIA labels, keyboard navigation, table fallbacks ([see Accessibility](./accessibility.md))
- **Dashboard Integration** - Cross-filter support for multi-chart dashboards ([see Cross-Filter](./cross-filter.md))

## Documentation

| Guide | Description |
|-------|-------------|
| [Treemap Guide](./treemap.md) | Hierarchical data as nested rectangles |
| [Sunburst Guide](./sunburst.md) | Hierarchical data as radial segments |
| [Force Graph Guide](./force-graph.md) | Network relationships with force simulation |
| [Sankey Guide](./sankey.md) | Flow/funnel diagrams with weighted links |
| [Data Formats](./data-formats.md) | Input data schemas and validation |
| [v1.0 Constraints](./v1-constraints.md) | ECharts requirement and roadmap |
| [Cross-Filter Patterns](./cross-filter.md) | Dashboard integration patterns |
| [Accessibility](./accessibility.md) | a11y features and compliance |
| [FAQ](./faq.md) | Common questions and troubleshooting |

## Architecture

The module follows an **ECharts-First** strategy (see [v1.0 Constraints](./v1-constraints.md)):

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Component  │ --> │   Adapter    │ --> │   ECharts   │
│  (React)    │     │ (treemap-    │     │  (canvas)   │
│             │     │  adapter.ts) │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                        │
       │                                        │
       v                                        v
┌─────────────┐                          ┌─────────────┐
│  A11y Table │                          │ Interactivity│
│  Fallback   │                          │ (drill,zoom) │
└─────────────┘                          └─────────────┘
```

## Installation

The Network & Flow components are part of the OODS viz package:

```bash
pnpm add @oods/viz echarts
```

ECharts is a peer dependency (see [v1.0 Constraints](./v1-constraints.md) for why).

## Storybook

Interactive examples are available in Storybook:

- `Components/Visualization/Treemap`
- `Components/Visualization/Sunburst`
- `Components/Visualization/ForceGraph`
- `Components/Visualization/Sankey`

Run locally: `pnpm storybook`

## Related Documentation

- [Viz System Overview](../system-overview.md)
- [Performance Guide](../performance-guide.md)
- [Accessibility Checklist](../accessibility-checklist.md)
