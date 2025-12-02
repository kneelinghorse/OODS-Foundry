# Network & Flow Module v1.0 Release Notes

**Release Date:** December 1, 2025
**Module Version:** 1.0.0
**OODS Foundry Version:** 0.2.0

## Overview

The Network & Flow Module v1.0 introduces four new visualization types for hierarchical, network, and flow data. This release provides native ECharts rendering for optimal performance, cross-filter integration for dashboards, and comprehensive accessibility support.

## New Visualization Types

### Treemap

Hierarchical rectangles showing part-to-whole relationships with interactive drill-down.

**Features:**
- Drill-down navigation with animated zoom transitions
- Breadcrumb trail for navigation history
- Golden ratio (φ ≈ 1.618) aspect ratio optimization
- Configurable depth levels with distinct styling
- Tooltip with hierarchical path display

**Usage:**
```tsx
import { Treemap } from '@oods/viz';

<Treemap
  spec={vizSpec}
  data={{
    type: 'adjacency_list',
    data: [
      { id: 'root', parentId: null, value: 1000, name: 'Total' },
      { id: 'a', parentId: 'root', value: 400, name: 'Category A' },
      { id: 'b', parentId: 'root', value: 600, name: 'Category B' },
    ],
  }}
/>
```

### Sunburst

Radial hierarchy visualization with ancestor highlighting.

**Features:**
- 360° radial layout with configurable start angle
- Ancestor emphasis on hover (focus mode)
- Radial and tangential label rotation per level
- Multi-ring depth support (up to 4 levels by default)
- Smooth sector transitions

**Usage:**
```tsx
import { Sunburst } from '@oods/viz';

<Sunburst
  spec={vizSpec}
  data={{
    type: 'nested',
    data: {
      name: 'Root',
      children: [
        { name: 'Branch A', value: 40 },
        { name: 'Branch B', children: [{ name: 'Leaf', value: 30 }] },
      ],
    },
  }}
/>
```

### Force Graph

Force-directed network layout for relationship visualization.

**Features:**
- Force simulation with gravity, repulsion, and collision detection
- Category-based node grouping with color coding
- Adjacency exploration (click to highlight connected nodes)
- Draggable nodes with physics-based positioning
- Link value-based edge thickness

**Usage:**
```tsx
import { ForceGraph } from '@oods/viz';

<ForceGraph
  spec={vizSpec}
  data={{
    nodes: [
      { id: 'alice', name: 'Alice', group: 'engineering' },
      { id: 'bob', name: 'Bob', group: 'marketing' },
    ],
    links: [{ source: 'alice', target: 'bob', value: 10 }],
  }}
/>
```

### Sankey

Flow diagram showing quantities between stages.

**Features:**
- Gradient links from source to target color
- Value-proportional link stroke width
- Automatic node positioning with minimal overlap
- Flow conservation validation
- Interactive link highlighting

**Usage:**
```tsx
import { Sankey } from '@oods/viz';

<Sankey
  spec={vizSpec}
  data={{
    nodes: [{ name: 'Source' }, { name: 'Process' }, { name: 'Output' }],
    links: [
      { source: 'Source', target: 'Process', value: 100 },
      { source: 'Process', target: 'Output', value: 80 },
    ],
  }}
/>
```

## Cross-Filter System

The new cross-filter system enables coordinated interactions across multiple visualizations in a dashboard.

### Filter Types

| Type | Description | Use Case |
|------|-------------|----------|
| Node | Single node selection | Click on graph node or sankey node |
| Path | Hierarchical path selection | Drill-down in treemap/sunburst |
| Link | Edge/flow selection | Click on graph edge or sankey link |
| Adjacency | Center + neighbors | Explore connections from a node |

### Integration

```tsx
import {
  DEFAULT_NETWORK_FILTER_STATE,
  networkFilterReducer,
  createNetworkInteractionBindings,
} from '@oods/dashboard';

function Dashboard() {
  const [filterState, dispatch] = useReducer(
    networkFilterReducer,
    DEFAULT_NETWORK_FILTER_STATE
  );

  const treemapBindings = createNetworkInteractionBindings('treemap', dispatch);
  const graphBindings = createNetworkInteractionBindings('graph', dispatch);

  return (
    <>
      <Treemap onNodeClick={treemapBindings.onPathSelect} />
      <ForceGraph onNodeClick={graphBindings.onNodeSelect} />
    </>
  );
}
```

## Widget Registration

Register Network & Flow visualizations as dashboard widgets:

```tsx
import {
  registerNetworkDashboardWidgets,
  createTreemapWidget,
  createForceGraphWidget,
} from '@oods/dashboard';

const extensions = registerNetworkDashboardWidgets({
  traitId: 'Analytics',
  widgets: [
    createTreemapWidget({ id: 'org-chart', title: 'Organization' }),
    createForceGraphWidget({ id: 'team-network', title: 'Team Connections' }),
  ],
});
```

## Performance

All adapters are highly optimized for large datasets:

| Visualization | Node Count | Transform Time | Budget |
|--------------|------------|----------------|--------|
| Treemap | 500 | <1ms | 200ms |
| Sunburst | 300 | <1ms | 200ms |
| Force Graph | 100 | <1ms | 500ms |
| Sankey | 50 | <1ms | 100ms |

Performance tests are included at `tests/performance/network-flow-perf.test.ts`.

## Accessibility

All visualizations include:

- ARIA labels with role and description attributes
- Screen reader-friendly data summaries
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators for interactive elements
- Reduced motion support via CSS media queries

## Known Limitations

### v1.0 Constraints

1. **ECharts Only**: This release uses ECharts as the rendering engine. Vega-Lite support is planned for v1.1+.

2. **Canvas Rendering**: Colors are resolved at adapter time (CSS variables converted to RGB). SVG rendering is not supported.

3. **Maximum Dataset Sizes**:
   - Treemap: ~2,000 nodes recommended
   - Sunburst: ~1,000 nodes recommended
   - Force Graph: ~500 nodes + 1,500 links recommended
   - Sankey: ~200 nodes + 500 links recommended

4. **No Server-Side Rendering**: ECharts requires a browser environment.

See `docs/viz/network-flow/v1-constraints.md` for complete details.

## Migration Guide

If upgrading from earlier prototype implementations:

1. **Data Format**: Hierarchy data now requires explicit `type` field:
   ```ts
   // Old
   { data: [...] }

   // New
   { type: 'adjacency_list', data: [...] }
   // or
   { type: 'nested', data: {...} }
   ```

2. **Cross-Filter**: Replace custom filter logic with `networkFilterReducer`:
   ```ts
   // Old
   const [selected, setSelected] = useState(null);

   // New
   const [state, dispatch] = useReducer(networkFilterReducer, DEFAULT_NETWORK_FILTER_STATE);
   ```

3. **Widget Registration**: Use the new factory functions:
   ```ts
   // Old
   { type: 'treemap', id: 'tm' }

   // New
   createTreemapWidget({ id: 'tm', title: 'My Treemap' })
   ```

## Testing

The module includes comprehensive test coverage:

- **Unit Tests**: 166+ tests for adapters, cross-filter, widgets, CLI
- **Integration Tests**: 21 tests for end-to-end functionality
- **Performance Tests**: 11 tests with budget validation

Run tests:
```bash
pnpm vitest run tests/integration/network-flow-full.test.ts
pnpm vitest run tests/performance/network-flow-perf.test.ts
```

## Future Roadmap

### v1.1 (Planned)
- Vega-Lite rendering support
- Progressive rendering for large datasets
- WebGL acceleration option
- Custom color scale configuration

### v1.2 (Planned)
- Animation customization API
- Export to PNG/SVG
- Embed code generation
- Dashboard templates

## Support

- Documentation: `docs/viz/network-flow/`
- Examples: `src/stories/viz/network-flow/`
- Issues: File in project issue tracker

## Contributors

This module was developed as part of Sprint 33-34 (Network & Flow visualization initiative).
