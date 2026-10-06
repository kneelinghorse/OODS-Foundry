import { describe, expect, it } from 'vitest';
import {
  adaptSunburstToECharts,
  type HierarchyInput,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// sprint-111 m03 — sunburst beachhead. Sunburst reuses the hierarchy-utils ported
// in m01 (convertToEChartsTreeData is already covered by treemap-adapter.spec), so
// these tests focus on the sunburst adapter's own output: a renderable sunburst
// series built from the SEPARATE hierarchy input (decoupled from the IR), resolved
// canvas colours, a11y/provenance flow, and determinism.

function sunburstSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:sunburst-test',
    name: 'Spend Breakdown',
    data: { values: [] },
    marks: [{ trait: 'MarkSunburst' }],
    encoding: {},
    a11y: { description: 'Sunburst of spend by category and sub-category.' },
    ...overrides,
  } as NormalizedVizSpec;
}

const NESTED: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Budget',
    value: 100,
    children: [
      { name: 'Engineering', value: 60, children: [{ name: 'Salaries', value: 50 }, { name: 'Tools', value: 10 }] },
      { name: 'Marketing', value: 40 },
    ],
  },
};

const MULTI_ROOT: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'p1', parentId: null, value: 30, name: 'Product A' },
    { id: 'p2', parentId: null, value: 50, name: 'Product B' },
  ],
};

describe('adaptSunburstToECharts', () => {
  it('builds a sunburst series from the input hierarchy, not the IR', () => {
    const option = adaptSunburstToECharts(sunburstSpec(), NESTED);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('sunburst');
    // the series data reflects the separate hierarchy input (spec.data is empty)
    const data = series.data as Record<string, unknown>[];
    expect(data[0].name).toBe('Budget');
  });

  it('emits RESOLVED palette colours (rgb/hex), never `var(--token)`', () => {
    const option = adaptSunburstToECharts(sunburstSpec(), NESTED);
    const palette = option.color as string[];
    expect(palette.length).toBeGreaterThan(0);
    for (const colour of palette) {
      expect(colour).toMatch(/^(#|rgb\()/);
      expect(colour).not.toContain('var(');
    }
  });

  it('colours the first visible level (a single root colours its children)', () => {
    const option = adaptSunburstToECharts(sunburstSpec(), NESTED);
    const root = (option.series as Record<string, unknown>[])[0];
    const children = (root.data as Record<string, unknown>[])[0].children as Record<string, unknown>[];
    for (const child of children) {
      expect((child.itemStyle as { color?: string } | undefined)?.color).toMatch(/^(#|rgb\()/);
    }
  });

  it('colours each root when the data has multiple roots', () => {
    const option = adaptSunburstToECharts(sunburstSpec(), MULTI_ROOT);
    const roots = (option.series as Record<string, unknown>[])[0].data as Record<string, unknown>[];
    expect(roots.length).toBe(2);
    for (const root of roots) {
      expect((root.itemStyle as { color?: string } | undefined)?.color).toMatch(/^(#|rgb\()/);
    }
  });

  it('flows the spec a11y description into the ECharts aria contract + carries provenance', () => {
    const spec = sunburstSpec({ a11y: { description: 'Budget allocation sunburst.' } });
    const option = adaptSunburstToECharts(spec, NESTED);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe('Budget allocation sunburst.');
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:sunburst-test');
  });

  it('is DETERMINISTIC — identical (spec, input) yields a byte-identical serialized option', () => {
    const a = JSON.stringify(adaptSunburstToECharts(sunburstSpec(), NESTED));
    const b = JSON.stringify(adaptSunburstToECharts(sunburstSpec(), NESTED));
    expect(a).toBe(b);
  });
});
