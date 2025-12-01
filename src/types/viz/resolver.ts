import type { HierarchyInput, NetworkInput, SankeyInput } from './network-flow.js';

export type NetworkFlowVizType = 'treemap' | 'sunburst' | 'force_graph' | 'sankey';

export type RenderingPath =
  | 'echarts_passthrough'
  | 'vega_passthrough'
  | 'server_transform'
  | 'vega_escape_hatch'
  | 'unsupported';

export interface ResolverInput {
  vizType: NetworkFlowVizType | string;
  data: HierarchyInput | NetworkInput | SankeyInput | unknown;
  availableRenderers: ('echarts' | 'vega-lite' | 'vega')[];
  dimensions: { width: number; height: number };
}

export interface ResolverOutput {
  path: RenderingPath;
  renderer: 'echarts' | 'vega-lite' | 'vega' | null;
  requiresTransform: boolean;
  transformType?: 'd3-hierarchy' | 'd3-force' | 'd3-sankey';
  reason: string;
}
