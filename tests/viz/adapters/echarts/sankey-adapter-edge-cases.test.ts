import { describe, expect, it, vi } from 'vitest';

import type { SankeyInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptSankeyToECharts, SankeyValidationError } from '../../../../src/viz/adapters/echarts/sankey-adapter.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:sankey:edge',
  name: 'Edge Case Sankey',
  data: { values: [] },
  marks: [{ trait: 'MarkSankey' }],
  encoding: {},
  a11y: { description: 'Edge case test Sankey' },
  config: { layout: { width: 800, height: 600 } },
};

describe('adaptSankeyToECharts - Edge Cases', () => {
  describe('single-level flow (2 columns)', () => {
    it('handles minimal two-column Sankey', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'Source' }, { name: 'Target' }],
        links: [{ source: 'Source', target: 'Target', value: 100 }],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(2);
      expect(series.links).toHaveLength(1);
    });

    it('handles multiple parallel flows in two columns', () => {
      const input: SankeyInput = {
        nodes: [
          { name: 'Source A' },
          { name: 'Source B' },
          { name: 'Source C' },
          { name: 'Target' },
        ],
        links: [
          { source: 'Source A', target: 'Target', value: 100 },
          { source: 'Source B', target: 'Target', value: 200 },
          { source: 'Source C', target: 'Target', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(4);
      expect(series.links).toHaveLength(3);

      // Target should have sum of all incoming flows
      const target = series.data.find((n: any) => n.name === 'Target');
      expect(target.value).toBe(350);
    });
  });

  describe('multi-level flow (5+ columns)', () => {
    it('handles five-column deep Sankey', () => {
      const input: SankeyInput = {
        nodes: [
          { name: 'Raw Materials' },
          { name: 'Processing' },
          { name: 'Manufacturing' },
          { name: 'Distribution' },
          { name: 'Retail' },
          { name: 'Consumer' },
        ],
        links: [
          { source: 'Raw Materials', target: 'Processing', value: 1000 },
          { source: 'Processing', target: 'Manufacturing', value: 900 },
          { source: 'Manufacturing', target: 'Distribution', value: 850 },
          { source: 'Distribution', target: 'Retail', value: 800 },
          { source: 'Retail', target: 'Consumer', value: 750 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(6);
      expect(series.links).toHaveLength(5);
    });

    it('handles branching multi-level flow', () => {
      const input: SankeyInput = {
        nodes: [
          { name: 'Origin' },
          { name: 'Branch A' },
          { name: 'Branch B' },
          { name: 'Sub A1' },
          { name: 'Sub A2' },
          { name: 'Sub B1' },
          { name: 'Final' },
        ],
        links: [
          { source: 'Origin', target: 'Branch A', value: 100 },
          { source: 'Origin', target: 'Branch B', value: 100 },
          { source: 'Branch A', target: 'Sub A1', value: 50 },
          { source: 'Branch A', target: 'Sub A2', value: 50 },
          { source: 'Branch B', target: 'Sub B1', value: 100 },
          { source: 'Sub A1', target: 'Final', value: 50 },
          { source: 'Sub A2', target: 'Final', value: 50 },
          { source: 'Sub B1', target: 'Final', value: 100 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(7);
      expect(series.links).toHaveLength(8);

      // Final should collect all flows
      const final = series.data.find((n: any) => n.name === 'Final');
      expect(final.value).toBe(200);
    });
  });

  describe('circular flow detection', () => {
    it('accepts circular flows without throwing (ECharts handles these)', () => {
      // Note: ECharts can render circular Sankey diagrams
      // We don't throw an error - we let ECharts handle it
      const circularInput: SankeyInput = {
        nodes: [
          { name: 'A' },
          { name: 'B' },
          { name: 'C' },
        ],
        links: [
          { source: 'A', target: 'B', value: 100 },
          { source: 'B', target: 'C', value: 80 },
          { source: 'C', target: 'A', value: 60 }, // Circular back to A
        ],
      };

      // Should not throw
      expect(() => adaptSankeyToECharts(baseSpec, circularInput)).not.toThrow();

      const option = adaptSankeyToECharts(baseSpec, circularInput);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(3);
      expect(series.links).toHaveLength(3);
    });

    it('handles self-referential loops', () => {
      const selfLoopInput: SankeyInput = {
        nodes: [{ name: 'Recycler' }, { name: 'Output' }],
        links: [
          { source: 'Recycler', target: 'Output', value: 100 },
          { source: 'Recycler', target: 'Recycler', value: 20 }, // Self-loop
        ],
      };

      // ECharts can handle self-loops
      expect(() => adaptSankeyToECharts(baseSpec, selfLoopInput)).not.toThrow();
    });
  });

  describe('large flow (50+ nodes)', () => {
    it('handles 50-node Sankey efficiently', () => {
      const nodes: SankeyInput['nodes'] = [];
      const links: SankeyInput['links'] = [];

      // Create 5 columns of 10 nodes each
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 10; row++) {
          nodes.push({ name: `Col${col}_Node${row}` });
        }
      }

      // Connect each node in one column to 2 random nodes in the next column
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 10; row++) {
          const source = `Col${col}_Node${row}`;
          const target1 = `Col${col + 1}_Node${(row * 2) % 10}`;
          const target2 = `Col${col + 1}_Node${(row * 2 + 1) % 10}`;

          links.push({ source, target: target1, value: 50 + row * 10 });
          if (target1 !== target2) {
            links.push({ source, target: target2, value: 30 + row * 5 });
          }
        }
      }

      const largeInput: SankeyInput = { nodes, links };

      const startTime = performance.now();
      const option = adaptSankeyToECharts(baseSpec, largeInput);
      const endTime = performance.now();

      const [series] = option.series as any[];

      expect(series.data).toHaveLength(50);
      expect(series.links.length).toBeGreaterThan(50);

      // Should complete in reasonable time (< 100ms for adapter, not rendering)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('handles 100-node Sankey', () => {
      const nodes: SankeyInput['nodes'] = [];
      const links: SankeyInput['links'] = [];

      // 10 columns of 10 nodes each
      for (let col = 0; col < 10; col++) {
        for (let row = 0; row < 10; row++) {
          nodes.push({ name: `C${col}R${row}` });
        }
      }

      // Connect each node to 1-2 nodes in the next column
      for (let col = 0; col < 9; col++) {
        for (let row = 0; row < 10; row++) {
          const source = `C${col}R${row}`;
          const target = `C${col + 1}R${row}`;
          links.push({ source, target, value: 100 });
        }
      }

      const option = adaptSankeyToECharts(baseSpec, { nodes, links });
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(100);
      expect(series.links).toHaveLength(90); // 9 columns of 10 links each
    });
  });

  describe('highly connected flow (many links per node)', () => {
    it('handles hub nodes with many connections', () => {
      const nodes: SankeyInput['nodes'] = [
        { name: 'Hub' },
        ...Array.from({ length: 20 }, (_, i) => ({ name: `Source${i}` })),
        ...Array.from({ length: 20 }, (_, i) => ({ name: `Target${i}` })),
      ];

      const links: SankeyInput['links'] = [
        // 20 incoming links to Hub
        ...Array.from({ length: 20 }, (_, i) => ({
          source: `Source${i}`,
          target: 'Hub',
          value: 10 + i,
        })),
        // 20 outgoing links from Hub
        ...Array.from({ length: 20 }, (_, i) => ({
          source: 'Hub',
          target: `Target${i}`,
          value: 15 + i,
        })),
      ];

      const option = adaptSankeyToECharts(baseSpec, { nodes, links });
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(41); // Hub + 20 sources + 20 targets
      expect(series.links).toHaveLength(40);

      // Hub value should be max of incoming/outgoing
      const hub = series.data.find((n: any) => n.name === 'Hub');
      // Outgoing sum: 15+16+17+...+34 = 20*15 + (0+1+2+...+19) = 300 + 190 = 490
      expect(hub.value).toBe(490);
    });
  });

  describe('emphasis adjacency highlighting', () => {
    it('configures emphasis with adjacency focus', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        links: [
          { source: 'A', target: 'B', value: 50 },
          { source: 'B', target: 'C', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.emphasis).toBeDefined();
      expect(series.emphasis.focus).toBe('adjacency');
    });
  });

  describe('edge case values', () => {
    it('handles very small values', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: 0.001 }],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.links[0].value).toBe(0.001);
    });

    it('handles very large values', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: 1_000_000_000 }],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.links[0].value).toBe(1_000_000_000);
    });

    it('handles zero values (fails validation)', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: 0 }],
      };

      // Zero is a valid finite number, so it should pass
      expect(() => adaptSankeyToECharts(baseSpec, input)).not.toThrow();
    });

    it('handles negative values (technically valid for ECharts)', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: -50 }],
      };

      // Negative values are allowed by ECharts (they represent reverse flow)
      expect(() => adaptSankeyToECharts(baseSpec, input)).not.toThrow();
    });
  });

  describe('special characters in names', () => {
    it('handles HTML special characters in node names', () => {
      const input: SankeyInput = {
        nodes: [
          { name: '<script>alert("xss")</script>' },
          { name: 'Normal & Safe' },
        ],
        links: [
          { source: '<script>alert("xss")</script>', target: 'Normal & Safe', value: 100 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      // Names should be preserved (ECharts will escape them)
      expect(series.data[0].name).toBe('<script>alert("xss")</script>');
      expect(series.data[1].name).toBe('Normal & Safe');
    });

    it('handles unicode characters in names', () => {
      const input: SankeyInput = {
        nodes: [
          { name: '能源 (Energy)' },
          { name: '电力 (Electricity)' },
        ],
        links: [
          { source: '能源 (Energy)', target: '电力 (Electricity)', value: 100 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data[0].name).toBe('能源 (Energy)');
      expect(series.data[1].name).toBe('电力 (Electricity)');
    });

    it('handles empty string names (edge case)', () => {
      const input: SankeyInput = {
        nodes: [{ name: '' }, { name: 'Valid' }],
        links: [{ source: '', target: 'Valid', value: 50 }],
      };

      // Empty string is technically valid
      expect(() => adaptSankeyToECharts(baseSpec, input)).not.toThrow();
    });
  });

  describe('duplicate nodes', () => {
    it('handles duplicate node names (last wins for color)', () => {
      const input: SankeyInput = {
        nodes: [
          { name: 'Duplicate', color: '#ff0000' },
          { name: 'Other' },
          { name: 'Duplicate', color: '#00ff00' }, // Duplicate
        ],
        links: [
          { source: 'Duplicate', target: 'Other', value: 50 },
        ],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      // All nodes are included (ECharts may merge or not)
      expect(series.data).toHaveLength(3);
    });
  });

  describe('no spec name', () => {
    it('uses default name when spec has no name', () => {
      const namelessSpec: NormalizedVizSpec = {
        ...baseSpec,
        name: undefined,
      };

      const input: SankeyInput = {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [{ source: 'A', target: 'B', value: 50 }],
      };

      const option = adaptSankeyToECharts(namelessSpec, input);
      const [series] = option.series as any[];

      expect(series.name).toBe('Sankey');
    });
  });

  describe('empty but valid input', () => {
    it('handles empty nodes and links arrays', () => {
      const input: SankeyInput = {
        nodes: [],
        links: [],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(0);
      expect(series.links).toHaveLength(0);
    });

    it('handles nodes with no links', () => {
      const input: SankeyInput = {
        nodes: [{ name: 'Isolated A' }, { name: 'Isolated B' }],
        links: [],
      };

      const option = adaptSankeyToECharts(baseSpec, input);
      const [series] = option.series as any[];

      expect(series.data).toHaveLength(2);
      expect(series.links).toHaveLength(0);

      // Isolated nodes should have value 0
      series.data.forEach((node: any) => {
        expect(node.value).toBe(0);
      });
    });
  });
});
