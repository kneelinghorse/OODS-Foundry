import { describe, expect, it } from 'vitest';

import type { HierarchyAdjacencyInput, HierarchyNestedInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import {
  convertToEChartsTreeData,
  generateHierarchyTooltip,
  isAdjacencyList,
} from '../../../../src/viz/adapters/echarts/hierarchy-utils.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'test:hierarchy:spec',
  name: 'Hierarchy Demo',
  data: { values: [] },
  marks: [{ trait: 'MarkRect' }],
  encoding: {},
  a11y: { description: 'Hierarchy visualization' },
};

describe('hierarchy utils', () => {
  it('detects adjacency list inputs', () => {
    const adjacency: HierarchyAdjacencyInput = { type: 'adjacency_list', data: [] };
    const nested: HierarchyNestedInput = { type: 'nested', data: { name: 'root' } };

    expect(isAdjacencyList(adjacency)).toBe(true);
    expect(isAdjacencyList(nested as unknown as HierarchyAdjacencyInput)).toBe(false);
  });

  it('converts adjacency list to ECharts tree data while preserving extra fields', () => {
    const input: HierarchyAdjacencyInput = {
      type: 'adjacency_list',
      data: [
        { id: 'root', parentId: null, value: 10, note: 'root-node' },
        { id: 'child-1', parentId: 'root', value: 4, color: 'blue' },
        { id: 'child-2', parentId: 'root', value: 6, weight: 1.2 },
      ],
    };

    const result = convertToEChartsTreeData(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('root');
    expect((result[0].children as any[])).toHaveLength(2);
    expect((result[0].children as any[])[0]).toMatchObject({ name: 'child-1', color: 'blue' });
    expect((result[0].children as any[])[1]).toMatchObject({ value: 6, weight: 1.2 });
    expect(result[0]).toHaveProperty('note', 'root-node');
  });

  it('converts nested data to ECharts tree data and escapes tooltip output', () => {
    const input: HierarchyNestedInput = {
      type: 'nested',
      data: {
        name: 'Root <A>',
        children: [
          { name: 'Branch &1', value: 5 },
          { name: 'Branch 2', value: 7 },
        ],
      },
    };

    const result = convertToEChartsTreeData(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Root <A>');
    expect((result[0].children as any[])[0].name).toBe('Branch &1');

    const tooltip = generateHierarchyTooltip(baseSpec, 'treemap');
    const formatted = (tooltip.formatter as (params: unknown) => string)({
      name: 'Root <A>',
      value: 12,
      treePathInfo: [{ name: 'Root <A>' }, { name: 'Branch &1' }],
    });

    expect(formatted).toContain('&lt;A&gt;');
    expect(formatted).toContain('Branch &amp;1');
    expect(formatted).toContain('Root &lt;A&gt; &gt; Branch &amp;1');
  });
});
