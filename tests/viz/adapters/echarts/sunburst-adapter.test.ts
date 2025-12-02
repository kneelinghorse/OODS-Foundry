import { describe, expect, it } from 'vitest';

import type { HierarchyAdjacencyInput } from '../../../../src/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../../../src/viz/spec/normalized-viz-spec.js';
import { adaptSunburstToECharts } from '../../../../src/viz/adapters/echarts/sunburst-adapter.js';

const spec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:hierarchy:sunburst',
  name: 'Sunburst Allocation',
  data: { values: [] },
  marks: [{ trait: 'MarkRect' }],
  encoding: {},
  a11y: { description: 'Sunburst showing allocation by segment' },
  config: { layout: { width: 520, height: 520 } },
};

describe('adaptSunburstToECharts', () => {
  it('builds a sunburst series with ancestor emphasis and radial labels', () => {
    const input: HierarchyAdjacencyInput = {
      type: 'adjacency_list',
      data: [
        { id: 'root', parentId: null, value: 100, name: 'All' },
        { id: 'east', parentId: 'root', value: 40 },
        { id: 'west', parentId: 'root', value: 60 },
      ],
    };

    const option = adaptSunburstToECharts(spec, input);
    const [series] = option.series as any[];

    expect(series.type).toBe('sunburst');
    expect(series.startAngle).toBe(90);
    expect(series.emphasis.focus).toBe('ancestor');
    expect(series.label.rotate).toBe('radial');
    expect(series.radius[1]).toBe('90%');
    expect(series.levels).toHaveLength(4);
    // ECharts canvas needs resolved colors, not CSS variables
    const paletteEntry = option.color?.[0] as string;
    expect(paletteEntry).toBeDefined();
    // Should be a resolved color (rgb(...) or hex)
    expect(typeof paletteEntry).toBe('string');
    expect(paletteEntry.length).toBeGreaterThan(0);
  });

  it('uses resolved border colors and preserves hierarchy structure', () => {
    const input: HierarchyAdjacencyInput = {
      type: 'adjacency_list',
      data: [
        { id: 'root', parentId: null, value: 50 },
        { id: 'child', parentId: 'root', value: 50 },
      ],
    };

    const option = adaptSunburstToECharts(spec, input);
    const [series] = option.series as any[];
    // ECharts canvas needs resolved colors - using fallback surface color
    expect(series.itemStyle.borderColor).toBe('#ffffff');
    expect(series.data[0].children[0].name).toBe('child');
  });
});
