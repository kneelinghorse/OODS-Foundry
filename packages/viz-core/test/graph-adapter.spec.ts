import { describe, expect, it } from 'vitest';
import {
  adaptGraphToECharts,
  type NetworkInput,
  type NormalizedVizSpec,
} from '@oods/viz-core';
import { sparseForceDefaults } from '../src/adapters/echarts/graph-adapter.js';

// sprint-111 m04 — force-graph beachhead. The mission-start audit's determinism
// boundary is the point of these tests: the emitted OPTION is deterministic (the
// categories come from a SORTED Set, the transforms preserve input order, the force
// params are static config), while the iterative force LAYOUT (rendered node x/y)
// is computed client-side and is OUT of scope. So we assert the option's stable
// structure + byte-determinism — never rendered coordinates.

function graphSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:graph-test',
    name: 'Service Map',
    data: { values: [] },
    marks: [{ trait: 'MarkGraph' }],
    encoding: {},
    a11y: { description: 'Force-directed graph of service dependencies.' },
    ...overrides,
  } as NormalizedVizSpec;
}

const NET: NetworkInput = {
  nodes: [
    { id: 'a', group: 'web', value: 9 },
    { id: 'b', group: 'api', value: 4 },
    { id: 'c', group: 'web' },
    { id: 'd', group: 'db' },
  ],
  links: [
    { source: 'a', target: 'b', value: 3 },
    { source: 'b', target: 'd', value: 1 },
    { source: 'c', target: 'a' },
  ],
};

describe('adaptGraphToECharts', () => {
  it('builds a force-layout graph series from the NetworkInput (decoupled from the IR)', () => {
    const option = adaptGraphToECharts(graphSpec(), NET);
    const series = (option.series as Record<string, any>[])[0];

    expect(series.type).toBe('graph');
    expect(series.layout).toBe('force');
    expect(series.data).toHaveLength(4);
    expect(series.links).toHaveLength(3);
  });

  it('emits the deterministic force PARAMS (the renderable config we golden), not coordinates', () => {
    const option = adaptGraphToECharts(graphSpec(), NET);
    const force = (option.series as Record<string, any>[])[0].force;
    // Sparse graphs spread to the canvas (Sprint 201 m06): four nodes on the default 600×400 canvas get
    // 100px edges and 250 repulsion; dense graphs fall back to the researched 30/100 defaults.
    expect(force).toMatchObject({ ...sparseForceDefaults(4), gravity: 0.1, friction: 0.6 });
    expect(sparseForceDefaults(4)).toEqual({ edgeLength: 100, repulsion: 250 });
    expect(sparseForceDefaults(400)).toEqual({ edgeLength: 30, repulsion: 100 });
  });

  it('derives node categories from the group field as a SORTED set (the determinism anchor)', () => {
    const option = adaptGraphToECharts(graphSpec(), NET);
    const series = (option.series as Record<string, any>[])[0];
    // 'web','api','db' -> sorted -> ['api','db','web']; node category index follows.
    expect(series.categories.map((c: { name: string }) => c.name)).toEqual(['api', 'db', 'web']);
    const nodeA = (series.data as Record<string, any>[]).find((n) => n.id === 'a');
    expect(nodeA.category).toBe(2); // 'web' is index 2 in the sorted category list
    const nodeB = (series.data as Record<string, any>[]).find((n) => n.id === 'b');
    expect(nodeB.category).toBe(0); // 'api' is index 0
  });

  it('colours categories with RESOLVED palette colours (rgb/hex), never `var(--token)`', () => {
    const option = adaptGraphToECharts(graphSpec(), NET);
    const palette = option.color as string[];
    expect(palette.length).toBeGreaterThan(0);
    for (const colour of palette) {
      expect(colour).toMatch(/^(#|rgb\()/);
      expect(colour).not.toContain('var(');
    }
  });

  it('sizes nodes: radius doubles, value scales when size.field=value, else the base', () => {
    const sized = adaptGraphToECharts(
      graphSpec({ encoding: { size: { field: 'value', base: 10, max: 50 } } } as Partial<NormalizedVizSpec>),
      { nodes: [{ id: 'r', radius: 7 }, { id: 'v', value: 16 }, { id: 'p' }], links: [] },
    );
    const data = (sized.series as Record<string, any>[])[0].data as Record<string, any>[];
    expect(data.find((n) => n.id === 'r').symbolSize).toBe(14); // radius 7 * 2
    expect(data.find((n) => n.id === 'v').symbolSize).toBe(10); // max(10, min(50, sqrt(16)*2=8)) = 10
    expect(data.find((n) => n.id === 'p').symbolSize).toBe(10); // base
  });

  it('flows a11y into aria + carries usermeta provenance + a legend for categories', () => {
    const option = adaptGraphToECharts(graphSpec(), NET);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe(
      'Force-directed graph of service dependencies.',
    );
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:graph-test');
    expect((option.legend as { data?: string[] }).data).toEqual(['api', 'db', 'web']);
  });

  it('is DETERMINISTIC — identical (spec, input) yields a byte-identical serialized option', () => {
    const a = JSON.stringify(adaptGraphToECharts(graphSpec(), NET));
    const b = JSON.stringify(adaptGraphToECharts(graphSpec(), NET));
    expect(a).toBe(b);
  });
});
