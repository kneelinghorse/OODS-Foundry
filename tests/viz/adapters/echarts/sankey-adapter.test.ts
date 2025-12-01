import { describe, expect, it } from 'vitest';

import type { SankeyInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptSankeyToECharts, SankeyValidationError } from '../../../../src/viz/adapters/echarts/sankey-adapter.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:sankey:basic',
  name: 'Test Sankey',
  data: { values: [] },
  marks: [{ trait: 'MarkSankey' }],
  encoding: {},
  a11y: { description: 'Test Sankey diagram visualization' },
  config: { layout: { width: 800, height: 600 } },
};

const simpleInput: SankeyInput = {
  nodes: [
    { name: 'Source A' },
    { name: 'Source B' },
    { name: 'Process' },
    { name: 'Output' },
  ],
  links: [
    { source: 'Source A', target: 'Process', value: 100 },
    { source: 'Source B', target: 'Process', value: 50 },
    { source: 'Process', target: 'Output', value: 150 },
  ],
};

// Classic energy flow example
const energyFlowInput: SankeyInput = {
  nodes: [
    { name: 'Coal' },
    { name: 'Natural Gas' },
    { name: 'Nuclear' },
    { name: 'Renewables' },
    { name: 'Electricity' },
    { name: 'Heat' },
    { name: 'Residential' },
    { name: 'Commercial' },
    { name: 'Industrial' },
  ],
  links: [
    { source: 'Coal', target: 'Electricity', value: 250 },
    { source: 'Coal', target: 'Heat', value: 50 },
    { source: 'Natural Gas', target: 'Electricity', value: 180 },
    { source: 'Natural Gas', target: 'Heat', value: 120 },
    { source: 'Nuclear', target: 'Electricity', value: 200 },
    { source: 'Renewables', target: 'Electricity', value: 100 },
    { source: 'Electricity', target: 'Residential', value: 300 },
    { source: 'Electricity', target: 'Commercial', value: 280 },
    { source: 'Electricity', target: 'Industrial', value: 150 },
    { source: 'Heat', target: 'Residential', value: 100 },
    { source: 'Heat', target: 'Industrial', value: 70 },
  ],
};

describe('adaptSankeyToECharts', () => {
  describe('series configuration', () => {
    it('produces a valid sankey series', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.type).toBe('sankey');
      expect(series.name).toBe('Test Sankey');
    });

    it('uses ECharts defaults from R33.0 research', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      // Default layout iterations is 32 (vs D3's 6)
      expect(series.layoutIterations).toBe(32);
      // Default node width is 20 (slightly narrower than D3's 24)
      expect(series.nodeWidth).toBe(20);
      // Default node gap is 8 (same as D3)
      expect(series.nodeGap).toBe(8);
      // Default node align is justify (same as D3)
      expect(series.nodeAlign).toBe('justify');
    });

    it('defaults to horizontal orientation', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.orient).toBe('horizontal');
    });
  });

  describe('orientation', () => {
    it('supports horizontal orientation', () => {
      const horizontalSpec = {
        ...baseSpec,
        layout: { orientation: 'horizontal' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(horizontalSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.orient).toBe('horizontal');
      expect(series.label.position).toBe('right');
    });

    it('supports vertical orientation', () => {
      const verticalSpec = {
        ...baseSpec,
        layout: { orientation: 'vertical' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(verticalSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.orient).toBe('vertical');
      expect(series.label.position).toBe('top');
    });
  });

  describe('node alignment', () => {
    it('supports justify alignment', () => {
      const spec = {
        ...baseSpec,
        layout: { nodeAlign: 'justify' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.nodeAlign).toBe('justify');
    });

    it('supports left alignment', () => {
      const spec = {
        ...baseSpec,
        layout: { nodeAlign: 'left' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.nodeAlign).toBe('left');
    });

    it('supports right alignment', () => {
      const spec = {
        ...baseSpec,
        layout: { nodeAlign: 'right' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.nodeAlign).toBe('right');
    });
  });

  describe('custom layout parameters', () => {
    it('allows custom nodeWidth', () => {
      const spec = {
        ...baseSpec,
        layout: { nodeWidth: 30 },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.nodeWidth).toBe(30);
    });

    it('allows custom nodeGap', () => {
      const spec = {
        ...baseSpec,
        layout: { nodeGap: 15 },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.nodeGap).toBe(15);
    });

    it('allows custom layout iterations', () => {
      const spec = {
        ...baseSpec,
        layout: { iterations: 64 },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.layoutIterations).toBe(64);
    });
  });

  describe('node transformation', () => {
    it('transforms nodes with names', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(4);
      expect(series.data[0].name).toBe('Source A');
      expect(series.data[1].name).toBe('Source B');
      expect(series.data[2].name).toBe('Process');
      expect(series.data[3].name).toBe('Output');
    });

    it('calculates node values from flows', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      // Source A: only outgoing (100)
      const sourceA = series.data.find((n: any) => n.name === 'Source A');
      expect(sourceA.value).toBe(100);

      // Process: incoming 150 (100+50), outgoing 150
      const process = series.data.find((n: any) => n.name === 'Process');
      expect(process.value).toBe(150);

      // Output: only incoming (150)
      const output = series.data.find((n: any) => n.name === 'Output');
      expect(output.value).toBe(150);
    });

    it('uses explicit node values when provided', () => {
      const inputWithValues: SankeyInput = {
        nodes: [
          { name: 'A', value: 999 },
          { name: 'B' },
        ],
        links: [
          { source: 'A', target: 'B', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, inputWithValues);
      const [series] = option.series as any[];

      const nodeA = series.data.find((n: any) => n.name === 'A');
      expect(nodeA.value).toBe(999); // Explicit value preserved
    });

    it('applies custom node colors', () => {
      const inputWithColors: SankeyInput = {
        nodes: [
          { name: 'A', color: '#ff0000' },
          { name: 'B', color: '#00ff00' },
        ],
        links: [
          { source: 'A', target: 'B', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, inputWithColors);
      const [series] = option.series as any[];

      expect(series.data[0].itemStyle?.color).toBe('#ff0000');
      expect(series.data[1].itemStyle?.color).toBe('#00ff00');
    });

    it('preserves extra node fields', () => {
      const inputWithExtra: SankeyInput = {
        nodes: [
          { name: 'A', department: 'Engineering', priority: 1 },
          { name: 'B', department: 'Sales' },
        ],
        links: [
          { source: 'A', target: 'B', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, inputWithExtra);
      const [series] = option.series as any[];

      expect(series.data[0].department).toBe('Engineering');
      expect(series.data[0].priority).toBe(1);
      expect(series.data[1].department).toBe('Sales');
    });
  });

  describe('link transformation', () => {
    it('transforms links with source, target, and value', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.links).toHaveLength(3);
      expect(series.links[0].source).toBe('Source A');
      expect(series.links[0].target).toBe('Process');
      expect(series.links[0].value).toBe(100);
    });

    it('preserves extra link fields', () => {
      const inputWithExtra: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [
          { source: 'A', target: 'B', value: 50, category: 'transfer', year: 2024 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, inputWithExtra);
      const [series] = option.series as any[];

      expect(series.links[0].category).toBe('transfer');
      expect(series.links[0].year).toBe(2024);
    });
  });

  describe('link coloring', () => {
    it('uses gradient link color by default', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('gradient');
    });

    it('supports source-based link color', () => {
      const spec = {
        ...baseSpec,
        encoding: { link: { color: 'source' } },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('source');
    });

    it('supports target-based link color', () => {
      const spec = {
        ...baseSpec,
        encoding: { link: { color: 'target' } },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('target');
    });

    it('supports custom link color', () => {
      const spec = {
        ...baseSpec,
        encoding: { link: { color: '#808080' } },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(spec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.color).toBe('#808080');
    });

    it('applies default curveness to links', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.curveness).toBe(0.5);
    });

    it('applies default opacity to links', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.lineStyle.opacity).toBe(0.5);
    });
  });

  describe('emphasis (hover highlighting)', () => {
    it('sets emphasis focus to adjacency', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.emphasis.focus).toBe('adjacency');
    });
  });

  describe('labels', () => {
    it('shows labels by default', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.show).toBe(true);
    });

    it('can hide labels via encoding config', () => {
      const noLabelSpec = {
        ...baseSpec,
        encoding: { label: { show: false } },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(noLabelSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.show).toBe(false);
    });

    it('positions labels on right for horizontal orientation', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.position).toBe('right');
    });

    it('positions labels on top for vertical orientation', () => {
      const verticalSpec = {
        ...baseSpec,
        layout: { orientation: 'vertical' },
      } as unknown as NormalizedVizSpec;

      const option = adaptSankeyToECharts(verticalSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.label.position).toBe('top');
    });
  });

  describe('tooltip', () => {
    it('generates tooltip configuration', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);

      expect(option.tooltip).toBeDefined();
      expect((option.tooltip as any).trigger).toBe('item');
    });
  });

  describe('palette and colors', () => {
    it('includes categorical palette', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);

      expect(option.color).toBeDefined();
      expect(Array.isArray(option.color)).toBe(true);
      expect((option.color as string[]).length).toBeGreaterThan(0);
    });

    it('assigns palette colors to nodes', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      // Each node should have an itemStyle with color from palette
      series.data.forEach((node: any) => {
        expect(node.itemStyle?.color).toBeDefined();
      });
    });
  });

  describe('node styling', () => {
    it('applies border to nodes', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.itemStyle.borderWidth).toBe(1);
      expect(series.itemStyle.borderColor).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('includes OODS metadata in usermeta', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);

      expect((option as any).usermeta?.oods).toBeDefined();
      expect((option as any).usermeta.oods.specId).toBe('test:sankey:basic');
      expect((option as any).usermeta.oods.name).toBe('Test Sankey');
    });

    it('includes accessibility configuration', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);

      expect((option as any).aria?.enabled).toBe(true);
      expect((option as any).aria?.description).toBe('Test Sankey diagram visualization');
    });

    it('includes title from spec', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);

      expect((option as any).title?.text).toBe('Test Sankey');
    });
  });

  describe('dimensions', () => {
    it('applies width and height from config', () => {
      const option = adaptSankeyToECharts(baseSpec, simpleInput);
      const [series] = option.series as any[];

      expect(series.width).toBe(800);
      expect(series.height).toBe(600);
    });
  });

  describe('validation', () => {
    it('throws error when links are missing values', () => {
      const invalidInput: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [
          { source: 'A', target: 'B', value: undefined as any },
        ],
      };

      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(SankeyValidationError);
      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(/require 'value' on all links/);
    });

    it('throws error when links have null values', () => {
      const invalidInput: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [
          { source: 'A', target: 'B', value: null as any },
        ],
      };

      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(SankeyValidationError);
    });

    it('throws error when links have non-finite values', () => {
      const invalidInput: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [
          { source: 'A', target: 'B', value: NaN },
        ],
      };

      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(SankeyValidationError);
    });

    it('throws error when link references non-existent node', () => {
      const invalidInput: SankeyInput = {
        nodes: [{ name: 'A' }],
        links: [
          { source: 'A', target: 'NonExistent', value: 50 },
        ],
      };

      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(SankeyValidationError);
      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(/non-existent node/);
    });

    it('reports number of invalid links in error message', () => {
      const invalidInput: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        links: [
          { source: 'A', target: 'B', value: 50 },
          { source: 'B', target: 'C', value: undefined as any },
          { source: 'A', target: 'C', value: null as any },
        ],
      };

      expect(() => adaptSankeyToECharts(baseSpec, invalidInput)).toThrow(/Found 2 links/);
    });
  });

  describe('real-world example: energy flow', () => {
    it('handles multi-level energy flow diagram', () => {
      const option = adaptSankeyToECharts(
        { ...baseSpec, id: 'test:sankey:energy', name: 'Energy Flow' },
        energyFlowInput
      );
      const [series] = option.series as any[];

      // Should have all 9 nodes
      expect(series.data).toHaveLength(9);

      // Should have all 11 links
      expect(series.links).toHaveLength(11);

      // Electricity node should have correct calculated value
      // Incoming: 250+180+200+100 = 730
      const electricity = series.data.find((n: any) => n.name === 'Electricity');
      expect(electricity.value).toBe(730);
    });
  });
});
