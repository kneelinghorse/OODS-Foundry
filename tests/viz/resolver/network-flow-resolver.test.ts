import { describe, expect, it } from 'vitest';

import type { ResolverInput } from '../../../src/types/viz/resolver.js';
import type { HierarchyInput, NetworkInput, SankeyInput } from '../../../src/types/viz/network-flow.js';
import { RendererSelectionError, selectVizRenderer } from '../../../src/viz/adapters/renderer-selector.js';
import {
  isNetworkFlowVizType,
  resolveNetworkFlowPath,
} from '../../../src/viz/resolver/network-flow-resolver.js';

const hierarchyInput: HierarchyInput = {
  type: 'adjacency_list',
  data: [{ id: 'root', parentId: null, value: 1 }],
};

const networkInput: NetworkInput = {
  nodes: [{ id: 'a' }],
  links: [],
};

const sankeyInput: SankeyInput = {
  nodes: [{ name: 'from' }, { name: 'to' }],
  links: [{ source: 'from', target: 'to', value: 10 }],
};

const baseDimensions = { width: 640, height: 480 };

function createInput(vizType: ResolverInput['vizType'], availableRenderers: ResolverInput['availableRenderers']) {
  const data =
    vizType === 'force_graph' ? networkInput : vizType === 'sankey' ? sankeyInput : hierarchyInput;

  return {
    vizType,
    data,
    availableRenderers,
    dimensions: baseDimensions,
  } satisfies ResolverInput;
}

describe('resolveNetworkFlowPath', () => {
  it('returns echarts passthrough when ECharts is available', () => {
    const vizTypes = ['treemap', 'sunburst', 'force_graph', 'sankey'] as const;

    for (const vizType of vizTypes) {
      const result = resolveNetworkFlowPath(createInput(vizType, ['echarts', 'vega-lite']));

      expect(result).toEqual({
        path: 'echarts_passthrough',
        renderer: 'echarts',
        requiresTransform: false,
        reason: 'ECharts native support for Network & Flow visualizations',
      });
    }
  });

  it('returns unsupported with actionable guidance when ECharts is unavailable', () => {
    const scenarios: ResolverInput['vizType'][] = ['treemap', 'sunburst', 'force_graph', 'sankey'];

    for (const vizType of scenarios) {
      const result = resolveNetworkFlowPath(createInput(vizType, ['vega-lite']));

      expect(result.path).toBe('unsupported');
      expect(result.renderer).toBeNull();
      expect(result.requiresTransform).toBe(false);
      expect(result.reason).toContain(vizType);
      expect(result.reason).toContain('require ECharts');
      expect(result.reason).toContain('v1.0');
      expect(result.reason).toContain('Vega/Vega-Lite support is planned for v1.1+');
    }
  });

  it('flags invalid viz types as unsupported with validation guidance', () => {
    const result = resolveNetworkFlowPath(
      createInput('invalid-type', ['echarts']) as ResolverInput
    );

    expect(result).toEqual({
      path: 'unsupported',
      renderer: null,
      requiresTransform: false,
      reason: 'Unknown visualization type: invalid-type. Valid types: treemap, sunburst, force_graph, sankey',
    });
  });

  it('identifies network flow viz types correctly', () => {
    expect(isNetworkFlowVizType('treemap')).toBe(true);
    expect(isNetworkFlowVizType('force_graph')).toBe(true);
    expect(isNetworkFlowVizType('bar')).toBe(false);
  });
});

describe('renderer selector integration', () => {
  it('routes network flow specs to ECharts even when a different preference is set', () => {
    const spec = {
      mark: { type: 'sankey' },
      data: sankeyInput,
      dimensions: baseDimensions,
      portability: { preferredRenderer: 'vega-lite' },
    };

    const result = selectVizRenderer(spec, { available: ['vega-lite', 'echarts'] });
    expect(result).toEqual({ renderer: 'echarts', reason: 'network-flow' });
  });

  it('throws a renderer selection error when ECharts is unavailable for network flow specs', () => {
    const spec = {
      marks: [{ type: 'force_graph' }],
      data: networkInput,
      config: { layout: { width: 400, height: 300 } },
    };

    expect(() => selectVizRenderer(spec, { available: ['vega-lite'] })).toThrow(
      RendererSelectionError
    );
  });
});
