import { describe, expect, it } from 'vitest';

import type { NetworkInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptGraphToECharts } from '../../../../src/viz/adapters/echarts/graph-adapter.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:graph:basic',
  name: 'Test Graph',
  data: { values: [] },
  marks: [{ trait: 'MarkPoint' }],
  encoding: {},
  a11y: { description: 'Test graph visualization' },
  config: { layout: { width: 800, height: 600 } },
};

const simpleInput: NetworkInput = {
  nodes: [
    { id: 'a', group: 'alpha' },
    { id: 'b', group: 'alpha' },
    { id: 'c', group: 'beta' },
  ],
  links: [
    { source: 'a', target: 'b', value: 10 },
    { source: 'b', target: 'c', value: 5 },
  ],
};

describe('adaptGraphToECharts', () => {
  describe('series configuration', () => {
    it('produces a valid graph series with force layout', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.type).toBe('graph');
      expect(series.layout).toBe('force');
      expect(series.name).toBe('Test Graph');
    });

    it('uses ECharts force defaults from R33.0 research', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      // Default repulsion is 100 (higher than D3's -30 equivalent)
      expect(series.force.repulsion).toBe(100);
      // Default gravity is 0.1 (true centripetal force)
      expect(series.force.gravity).toBe(0.1);
      // Default edge length is 30
      expect(series.force.edgeLength).toBe(30);
      // Default friction is 0.6
      expect(series.force.friction).toBe(0.6);
      // Layout animation enabled
      expect(series.force.layoutAnimation).toBe(true);
    });

    it('allows custom force parameters via spec.layout.force', () => {
      const customSpec = {
        ...baseSpec,
        layout: {
          force: {
            repulsion: 200,
            gravity: 0.2,
            edgeLength: 50,
            friction: 0.8,
          },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(customSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.force.repulsion).toBe(200);
      expect(series.force.gravity).toBe(0.2);
      expect(series.force.edgeLength).toBe(50);
      expect(series.force.friction).toBe(0.8);
    });
  });

  describe('node transformation', () => {
    it('transforms nodes with id and name', () => {
      const input: NetworkInput = {
        nodes: [
          { id: 'node1', name: 'Node One' },
          { id: 'node2' },
        ],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(2);
      expect(series.data[0].id).toBe('node1');
      expect(series.data[0].name).toBe('Node One');
      expect(series.data[1].id).toBe('node2');
      expect(series.data[1].name).toBe('node2'); // Falls back to id
    });

    it('calculates node size from radius', () => {
      const input: NetworkInput = {
        nodes: [{ id: 'a', radius: 15 }],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data[0].symbolSize).toBe(30); // radius * 2
    });

    it('calculates node size from value when encoding specified', () => {
      const sizedSpec = {
        ...baseSpec,
        encoding: {
          size: { field: 'value', base: 10, max: 50 },
        },
      } as unknown as NormalizedVizSpec;

      const input: NetworkInput = {
        nodes: [
          { id: 'small', value: 4 },
          { id: 'large', value: 100 },
        ],
        links: [],
      };

      const option = adaptGraphToECharts(sizedSpec, input);
      const [series] = option.series as any[];

      // sqrt(4) * 2 = 4, clamped to base of 10
      expect(series.data[0].symbolSize).toBe(10);
      // sqrt(100) * 2 = 20
      expect(series.data[1].symbolSize).toBe(20);
    });

    it('uses default node size when no sizing specified', () => {
      const input: NetworkInput = {
        nodes: [{ id: 'a' }],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data[0].symbolSize).toBe(10); // DEFAULT_NODE_SIZE
    });

    it('handles fixed position nodes', () => {
      const input: NetworkInput = {
        nodes: [
          { id: 'fixed', fixed: true, x: 100, y: 200 },
          { id: 'free', fixed: false },
        ],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data[0].fixed).toBe(true);
      expect(series.data[0].x).toBe(100);
      expect(series.data[0].y).toBe(200);
      expect(series.data[1].fixed).toBe(false);
    });

    it('applies custom node colors', () => {
      const input: NetworkInput = {
        nodes: [{ id: 'colored', color: '#ff0000' }],
        links: [],
      };

      const option = adaptGraphToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data[0].itemStyle?.color).toBe('#ff0000');
    });
  });

  describe('link transformation', () => {
    it('transforms links with source and target', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.links).toHaveLength(2);
      expect(series.links[0].source).toBe('a');
      expect(series.links[0].target).toBe('b');
      expect(series.links[0].value).toBe(10);
    });

    it('calculates link width from value when encoding specified', () => {
      const widthSpec = {
        ...baseSpec,
        encoding: {
          linkWidth: { field: 'value', base: 1, max: 10 },
        },
      } as unknown as NormalizedVizSpec;

      const input: NetworkInput = {
        nodes: [{ id: 'a' }, { id: 'b' }],
        links: [{ source: 'a', target: 'b', value: 25 }],
      };

      const option = adaptGraphToECharts(widthSpec, input);
      const [series] = option.series as any[];

      // sqrt(25) = 5
      expect(series.links[0].lineStyle.width).toBe(5);
    });

    it('uses default link width when no encoding specified', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.links[0].lineStyle.width).toBe(1); // DEFAULT_LINK_WIDTH
    });
  });

  describe('category extraction and legend', () => {
    it('extracts categories from group field by default', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.categories).toHaveLength(2);
      expect(series.categories.map((c: any) => c.name)).toContain('alpha');
      expect(series.categories.map((c: any) => c.name)).toContain('beta');
    });

    it('maps nodes to category indices', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      // Nodes 'a' and 'b' are in 'alpha', node 'c' is in 'beta'
      // Categories are sorted alphabetically: [alpha=0, beta=1]
      const nodeA = series.data.find((n: any) => n.id === 'a');
      const nodeC = series.data.find((n: any) => n.id === 'c');

      expect(nodeA.category).toBe(0); // alpha
      expect(nodeC.category).toBe(1); // beta
    });

    it('generates legend for categorized data', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect(option.legend).toBeDefined();
      expect((option.legend as any).show).toBe(true);
      expect((option.legend as any).data).toContain('alpha');
      expect((option.legend as any).data).toContain('beta');
    });

    it('does not generate legend when no categories', () => {
      const input: NetworkInput = {
        nodes: [{ id: 'a' }, { id: 'b' }],
        links: [{ source: 'a', target: 'b' }],
      };

      const option = adaptGraphToECharts(baseSpec, input);

      expect(option.legend).toBeUndefined();
    });

    it('uses custom category field from encoding.color.field', () => {
      const customSpec = {
        ...baseSpec,
        encoding: {
          color: { field: 'type', trait: 'EncodingColor' },
        },
      } as unknown as NormalizedVizSpec;

      const input: NetworkInput = {
        nodes: [
          { id: 'a', type: 'server' },
          { id: 'b', type: 'client' },
        ],
        links: [],
      };

      const option = adaptGraphToECharts(customSpec, input);
      const [series] = option.series as any[];

      expect(series.categories).toHaveLength(2);
      expect(series.categories.map((c: any) => c.name)).toContain('server');
      expect(series.categories.map((c: any) => c.name)).toContain('client');
    });
  });

  describe('interactions', () => {
    it('enables roam (zoom) by default', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.roam).toBe(true);
    });

    it('enables draggable by default', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.draggable).toBe(true);
    });

    it('can disable zoom via interaction config', () => {
      const noZoomSpec = {
        ...baseSpec,
        interaction: { zoom: false },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(noZoomSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.roam).toBe(false);
    });

    it('can disable drag via interaction config', () => {
      const noDragSpec = {
        ...baseSpec,
        interaction: { drag: false },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(noDragSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.draggable).toBe(false);
    });

    it('sets emphasis focus to adjacency for hover highlighting', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.emphasis.focus).toBe('adjacency');
      expect(series.emphasis.lineStyle.width).toBe(4);
    });
  });

  describe('labels', () => {
    it('shows labels by default', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.show).toBe(true);
      expect(series.label.position).toBe('right');
      expect(series.label.formatter).toBe('{b}');
    });

    it('can hide labels via encoding config', () => {
      const noLabelSpec = {
        ...baseSpec,
        encoding: {
          label: { show: false },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(noLabelSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.show).toBe(false);
    });

    it('hides overlapping labels', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.labelLayout.hideOverlap).toBe(true);
    });

    it('can show edge labels', () => {
      const edgeLabelSpec = {
        ...baseSpec,
        encoding: {
          edgeLabel: { show: true },
        },
      } as unknown as NormalizedVizSpec;

      const option = adaptGraphToECharts(edgeLabelSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.edgeLabel.show).toBe(true);
    });
  });

  describe('edge styling', () => {
    it('uses source color for edges', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('source');
    });

    it('applies curveness to edges', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.curveness).toBe(0.3);
    });
  });

  describe('tooltip', () => {
    it('generates tooltip configuration', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect(option.tooltip).toBeDefined();
      expect((option.tooltip as any).trigger).toBe('item');
    });
  });

  describe('palette and colors', () => {
    it('includes categorical palette', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect(option.color).toBeDefined();
      expect(Array.isArray(option.color)).toBe(true);
      expect((option.color as string[]).length).toBeGreaterThan(0);
    });

    it('assigns palette colors to categories', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.categories[0].itemStyle?.color).toBeDefined();
      expect(series.categories[1].itemStyle?.color).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('includes OODS metadata in usermeta', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect((option as any).usermeta?.oods).toBeDefined();
      expect((option as any).usermeta.oods.specId).toBe('test:graph:basic');
      expect((option as any).usermeta.oods.name).toBe('Test Graph');
    });

    it('includes accessibility configuration', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect((option as any).aria?.enabled).toBe(true);
      expect((option as any).aria?.description).toBe('Test graph visualization');
    });

    it('includes title from spec', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);

      expect((option as any).title?.text).toBe('Test Graph');
    });
  });

  describe('dimensions', () => {
    it('applies width and height from config', () => {
      const option = adaptGraphToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.width).toBe(800);
      expect(series.height).toBe(600);
    });
  });
});
