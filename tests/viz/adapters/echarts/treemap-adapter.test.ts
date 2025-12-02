import { describe, expect, it } from 'vitest';

import type { HierarchyAdjacencyInput, HierarchyNestedInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptTreemapToECharts } from '../../../../src/viz/adapters/echarts/treemap-adapter.js';

const baseSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:hierarchy:treemap',
  name: 'Hierarchy Treemap',
  data: { values: [] },
  marks: [{ trait: 'MarkRect' }],
  encoding: {},
  a11y: { description: 'Treemap showing allocation by category' },
  config: { layout: { width: 600, height: 420 } },
};

describe('adaptTreemapToECharts', () => {
  it('builds a treemap series with drilldown and resolved styling', () => {
    const input: HierarchyAdjacencyInput = {
      type: 'adjacency_list',
      data: [
        { id: 'root', parentId: null, value: 100, name: 'All' },
        { id: 'north', parentId: 'root', value: 40 },
        { id: 'south', parentId: 'root', value: 60 },
      ],
    };

    const option = adaptTreemapToECharts(baseSpec, input);
    const [series] = option.series as any[];

    expect(series.type).toBe('treemap');
    expect(series.squareRatio).toBeCloseTo(1.618);
    expect(series.nodeClick).toBe('zoomToNode');
    // ECharts canvas needs resolved colors - using fallback colors
    expect(series.breadcrumb.itemStyle.color).toBe('#ffffff');
    expect(series.itemStyle.borderColor).toBe('#e0e0e0');
    expect(Array.isArray(option.color)).toBe(true);
    // Palette should contain resolved colors (rgb or hex)
    const paletteEntry = (option.color as string[])[0];
    expect(typeof paletteEntry).toBe('string');
    expect(paletteEntry.length).toBeGreaterThan(0);

    const tooltip = option.tooltip as { formatter?: (params: unknown) => string };
    const formatted = tooltip.formatter?.({
      name: 'north',
      value: 40,
      treePathInfo: [{ name: 'All' }, { name: 'north' }],
    });
    expect(formatted).toContain('All &gt; north');
    expect(option.aria?.enabled).toBe(true);
  });

  it('honors interaction overrides and handles nested input', () => {
    const nested: HierarchyNestedInput = {
      type: 'nested',
      data: {
        name: 'Root',
        children: [
          { name: 'A', value: 12 },
          { name: 'B', value: 30 },
        ],
      },
    };

    const spec: NormalizedVizSpec = {
      ...baseSpec,
      id: 'stories:hierarchy:treemap:nested',
      interaction: { drilldown: false, zoom: true, breadcrumb: false },
      interactions: [
        {
          id: 'zoom',
          select: { type: 'interval', on: 'drag', encodings: ['x'] },
          rule: { bindTo: 'zoom' },
        },
      ],
    } as NormalizedVizSpec;

    const option = adaptTreemapToECharts(spec, nested);
    const [series] = option.series as any[];

    expect(series.nodeClick).toBe(false);
    expect(series.roam).toBe(true);
    expect(series.breadcrumb.show).toBe(false);
    expect(series.data[0].children).toHaveLength(2);
  });
});
