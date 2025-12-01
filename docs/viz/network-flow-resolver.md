# Network & Flow Resolver (v1.0)

ECharts-first resolver for Network & Flow visualizations (treemap, sunburst, force_graph, sankey). The resolver returns `echarts_passthrough` when ECharts is available and an actionable `unsupported` response when it is not.

## Decision Logic (v1.0)
- Valid types: `treemap`, `sunburst`, `force_graph`, `sankey`
- If ECharts is in the renderer pool → `echarts_passthrough` (no server transforms, native layouts)
- If ECharts is missing → `unsupported` with guidance to enable ECharts; message notes the v1.0 constraint and v1.1+ Vega roadmap
- Invalid viz type → `unsupported` with the accepted type list

## Usage
```ts
import { selectVizRenderer } from '@/viz/adapters/renderer-selector.js';
import { resolveNetworkFlowPath } from '@/viz/resolver/network-flow-resolver.js';

// Direct resolver usage
const result = resolveNetworkFlowPath({
  vizType: 'sankey',
  data: sankeyInput,
  availableRenderers: ['vega-lite', 'echarts'],
  dimensions: { width: 800, height: 600 },
});

// Renderer selection integration
const renderer = selectVizRenderer(
  { mark: { type: 'sankey' }, data: sankeyInput, dimensions: { width: 800, height: 600 } },
  { available: ['vega-lite', 'echarts'] }
);
```

## Roadmap (v1.1+ placeholders)
- `vega_passthrough`: when full Vega is available
- `server_transform`: D3 hierarchy/force layouts precomputed for Vega-Lite-only environments
- `vega_escape_hatch`: Sankey path generation for Vega escape hatch
