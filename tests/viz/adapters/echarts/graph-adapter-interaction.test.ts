import { describe, expect, it } from 'vitest';

import type { NetworkInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptGraphToECharts } from '../../../../src/viz/adapters/echarts/graph-adapter.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:graph:interaction',
  name: 'Interaction Test Graph',
  data: { values: [] },
  marks: [{ trait: 'MarkPoint' }],
  encoding: {},
  a11y: { description: 'Graph for testing interactions' },
  config: { layout: { width: 600, height: 400 } },
};

const networkInput: NetworkInput = {
  nodes: [
    { id: 'server1', group: 'servers', name: 'Server 1', value: 100 },
    { id: 'server2', group: 'servers', name: 'Server 2', value: 80 },
    { id: 'client1', group: 'clients', name: 'Client 1', value: 40 },
    { id: 'client2', group: 'clients', name: 'Client 2', value: 30 },
    { id: 'db1', group: 'databases', name: 'Database 1', value: 120 },
  ],
  links: [
    { source: 'client1', target: 'server1', value: 50 },
    { source: 'client2', target: 'server1', value: 30 },
    { source: 'client1', target: 'server2', value: 20 },
    { source: 'server1', target: 'db1', value: 100 },
    { source: 'server2', target: 'db1', value: 60 },
  ],
};

describe('Graph Adapter - Interaction Tests', () => {
  describe('drag interaction', () => {
    it('enables node dragging by default', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.draggable).toBe(true);
    });

    it('respects fixed nodes during drag', () => {
      const input: NetworkInput = {
        nodes: [
          { id: 'fixed-node', fixed: true, x: 300, y: 200 },
          { id: 'free-node' },
        ],
        links: [{ source: 'fixed-node', target: 'free-node' }],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      const fixedNode = series.data.find((n: any) => n.id === 'fixed-node');
      const freeNode = series.data.find((n: any) => n.id === 'free-node');

      expect(fixedNode.fixed).toBe(true);
      expect(fixedNode.x).toBe(300);
      expect(fixedNode.y).toBe(200);
      expect(freeNode.fixed).toBe(false);
    });
  });

  describe('zoom interaction', () => {
    it('enables zoom/pan by default via roam', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.roam).toBe(true);
    });

    it('can be disabled via spec.interaction.zoom', () => {
      const noZoomSpec = {
        ...baseSpec,
        interaction: { zoom: false, drag: true },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(noZoomSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.roam).toBe(false);
    });
  });

  describe('adjacency highlighting', () => {
    it('sets emphasis focus to adjacency for connected node highlighting', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.emphasis).toBeDefined();
      expect(series.emphasis.focus).toBe('adjacency');
    });

    it('increases line width on hover', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.emphasis.lineStyle).toBeDefined();
      expect(series.emphasis.lineStyle.width).toBe(4);
    });
  });

  describe('tooltip for nodes', () => {
    it('shows node name in tooltip', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const nodeParams = {
        dataType: 'node',
        name: 'Server 1',
        value: 100,
        data: { category: 0 },
      };

      const result = tooltip.formatter(nodeParams);

      expect(result).toContain('<strong>Server 1</strong>');
      expect(result).toContain('Value: 100');
    });

    it('shows node category in tooltip', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const nodeParams = {
        dataType: 'node',
        name: 'Client 1',
        value: 40,
        data: { category: 1 },
      };

      const result = tooltip.formatter(nodeParams);

      expect(result).toContain('Category: 1');
    });

    it('handles nodes without value', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const nodeParams = {
        dataType: 'node',
        name: 'Simple Node',
        data: {},
      };

      const result = tooltip.formatter(nodeParams);

      expect(result).toContain('<strong>Simple Node</strong>');
      expect(result).not.toContain('Value:');
    });
  });

  describe('tooltip for edges', () => {
    it('shows edge source and target', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const edgeParams = {
        dataType: 'edge',
        data: {
          source: 'client1',
          target: 'server1',
          value: 50,
        },
      };

      const result = tooltip.formatter(edgeParams);

      expect(result).toContain('client1');
      expect(result).toContain('→');
      expect(result).toContain('server1');
      expect(result).toContain('50');
    });

    it('handles edges without value', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const edgeParams = {
        dataType: 'edge',
        data: {
          source: 'a',
          target: 'b',
        },
      };

      const result = tooltip.formatter(edgeParams);

      expect(result).toContain('a');
      expect(result).toContain('→');
      expect(result).toContain('b');
      expect(result).not.toContain(':');
    });
  });

  describe('legend filtering', () => {
    it('generates legend with all category names', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);

      expect(option.legend).toBeDefined();
      const legend = option.legend as { show: boolean; data: string[] };

      expect(legend.show).toBe(true);
      expect(legend.data).toContain('servers');
      expect(legend.data).toContain('clients');
      expect(legend.data).toContain('databases');
    });

    it('legend data matches category order', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];
      const legend = option.legend as { data: string[] };

      const categoryNames = series.categories.map((c: any) => c.name);
      expect(legend.data).toEqual(categoryNames);
    });

    it('can hide legend via spec.legend.show', () => {
      const hiddenLegendSpec = {
        ...baseSpec,
        legend: { show: false },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(hiddenLegendSpec, networkInput);

      expect((option.legend as any).show).toBe(false);
    });
  });

  describe('edge labels', () => {
    it('hides edge labels by default', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.edgeLabel.show).toBe(false);
    });

    it('shows edge labels when configured', () => {
      const edgeLabelSpec = {
        ...baseSpec,
        encoding: {
          edgeLabel: { show: true },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(edgeLabelSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.edgeLabel.show).toBe(true);
    });

    it('edge label formatter shows value', () => {
      const edgeLabelSpec = {
        ...baseSpec,
        encoding: {
          edgeLabel: { show: true },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(edgeLabelSpec, networkInput);
      const [series] = option.series as any[];

      const formatted = series.edgeLabel.formatter({ data: { value: 42 } });
      expect(formatted).toBe('42');
    });

    it('edge label formatter handles missing value', () => {
      const edgeLabelSpec = {
        ...baseSpec,
        encoding: {
          edgeLabel: { show: true },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(edgeLabelSpec, networkInput);
      const [series] = option.series as any[];

      const formatted = series.edgeLabel.formatter({ data: {} });
      expect(formatted).toBe('');
    });
  });

  describe('label overlap handling', () => {
    it('enables hide overlap for label layout', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.labelLayout).toBeDefined();
      expect(series.labelLayout.hideOverlap).toBe(true);
    });
  });

  describe('edge curvature', () => {
    it('applies curveness to prevent edge overlap', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.curveness).toBe(0.3);
    });

    it('uses source color for edges', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('source');
    });
  });

  describe('force layout animation', () => {
    it('enables layout animation for smooth transitions', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const [series] = option.series as any[];

      expect(series.force.layoutAnimation).toBe(true);
    });
  });

  describe('XSS prevention in tooltips', () => {
    it('escapes HTML in node names', () => {
      const input: NetworkInput = {
        nodes: [{ id: 'xss', name: '<script>alert("xss")</script>' }],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const result = tooltip.formatter({
        dataType: 'node',
        name: '<script>alert("xss")</script>',
        data: {},
      });

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes HTML in edge source/target', () => {
      const option = adaptGraphToECharts(baseSpec, networkInput);
      const tooltip = option.tooltip as { formatter: (params: any) => string };

      const result = tooltip.formatter({
        dataType: 'edge',
        data: {
          source: '<img onerror="alert(1)">',
          target: 'normal',
        },
      });

      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
    });
  });
});
