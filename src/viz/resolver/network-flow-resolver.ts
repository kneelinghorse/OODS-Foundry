import type { NetworkFlowVizType, ResolverInput, ResolverOutput } from '@/types/viz/resolver.js';

const NETWORK_FLOW_TYPES: readonly NetworkFlowVizType[] = ['treemap', 'sunburst', 'force_graph', 'sankey'];

export function isNetworkFlowVizType(vizType: string): vizType is NetworkFlowVizType {
  return (NETWORK_FLOW_TYPES as readonly string[]).includes(vizType);
}

/**
 * Resolve rendering path for Network & Flow visualizations.
 *
 * v1.0: ECharts-only implementation. Future versions may add Vega paths.
 */
export function resolveNetworkFlowPath(input: ResolverInput): ResolverOutput {
  const { vizType, availableRenderers } = input;

  if (!isNetworkFlowVizType(vizType)) {
    return {
      path: 'unsupported',
      renderer: null,
      requiresTransform: false,
      reason: `Unknown visualization type: ${vizType}. Valid types: ${NETWORK_FLOW_TYPES.join(', ')}`,
    };
  }

  if (availableRenderers.includes('echarts')) {
    return {
      path: 'echarts_passthrough',
      renderer: 'echarts',
      requiresTransform: false,
      reason: 'ECharts native support for Network & Flow visualizations',
    };
  }

  return {
    path: 'unsupported',
    renderer: null,
    requiresTransform: false,
    reason:
      `Network & Flow visualizations (${vizType}) require ECharts in OODS v1.0. ` +
      'Please ensure ECharts is included in your renderer configuration. ' +
      'Vega/Vega-Lite support is planned for v1.1+.',
  };
}
