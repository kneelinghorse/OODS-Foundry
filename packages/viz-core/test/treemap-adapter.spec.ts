import { describe, expect, it } from 'vitest';
import {
  adaptTreemapToECharts,
  convertToEChartsTreeData,
  isAdjacencyList,
  resolveTokenToColor,
  type HierarchyInput,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// sprint-111 m01 — the treemap beachhead. These tests travel with the port and
// import through the package barrel (aliased to src/ in vitest.config.ts), so they
// also prove the new adapter + data-contract types + shared token-resolver are
// reachable on the public surface the viz.render handler (m02) will consume.
//
// They encode the WHY of the headless network/hierarchy path, not just the shapes:
//   - spec+data are DECOUPLED (the series is built from the `input` param, never
//     from the IR) — the architecture decision the mission-start audit ratified;
//   - ECharts canvas needs RESOLVED colours, not `var(--token)` references;
//   - the output is DETERMINISTIC (the Q1 moat) — identical input → identical spec.

/** A minimal treemap spec. Treemap carries NO x/y encoding — its data is the
 *  separate HierarchyInput, so the IR only supplies metadata/a11y/layout. */
function treemapSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:treemap-test',
    name: 'Org Headcount',
    data: { values: [] },
    marks: [{ trait: 'MarkTreemap' }],
    encoding: {},
    a11y: { description: 'Treemap of headcount by division and team.' },
    ...overrides,
  } as NormalizedVizSpec;
}

const ADJACENCY: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 0, name: 'Company', region: 'global' },
    { id: 'eng', parentId: 'root', value: 0, name: 'Engineering' },
    { id: 'sales', parentId: 'root', value: 0, name: 'Sales' },
    { id: 'eng-fe', parentId: 'eng', value: 12, name: 'Frontend' },
    { id: 'eng-be', parentId: 'eng', value: 18, name: 'Backend' },
    { id: 'sales-amer', parentId: 'sales', value: 9, name: 'AMER' },
  ],
};

const NESTED: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Portfolio',
    value: 100,
    children: [
      { name: 'Growth', value: 60, owner: 'Dana' },
      { name: 'Income', value: 40 },
    ],
  },
};

describe('hierarchy data contract — convertToEChartsTreeData', () => {
  it('discriminates the two HierarchyInput formats', () => {
    expect(isAdjacencyList(ADJACENCY)).toBe(true);
    expect(isAdjacencyList(NESTED)).toBe(false);
  });

  it('reparents an adjacency_list into a rooted tree (parentId drives nesting)', () => {
    const tree = convertToEChartsTreeData(ADJACENCY);

    // One root (Company); its two divisions become children, each with their teams.
    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.name).toBe('Company');
    // Non-id/parent/name/value fields are preserved (e.g. region) for tooltips/encodings.
    expect(root.region).toBe('global');

    const divisions = root.children as Record<string, unknown>[];
    expect(divisions.map((d) => d.name).sort()).toEqual(['Engineering', 'Sales']);

    const eng = divisions.find((d) => d.name === 'Engineering')!;
    const engTeams = (eng.children as Record<string, unknown>[]).map((t) => t.name).sort();
    expect(engTeams).toEqual(['Backend', 'Frontend']);
  });

  it('treats a node whose parent is missing as its own root (no silent drop)', () => {
    const orphaned: HierarchyInput = {
      type: 'adjacency_list',
      data: [
        { id: 'a', parentId: 'ghost', value: 5, name: 'A' },
        { id: 'b', parentId: null, value: 7, name: 'B' },
      ],
    };
    const tree = convertToEChartsTreeData(orphaned);
    // Both surface as roots — the dangling parentId must not lose the node.
    expect(tree.map((n) => n.name).sort()).toEqual(['A', 'B']);
  });

  it('normalizes a nested tree, recursing children and preserving extra fields', () => {
    const tree = convertToEChartsTreeData(NESTED);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Portfolio');

    const children = tree[0].children as Record<string, unknown>[];
    expect(children.map((c) => c.name)).toEqual(['Growth', 'Income']);
    expect(children[0].owner).toBe('Dana');
    // Leaves get a normalized empty children array.
    expect(children[1].children).toEqual([]);
  });
});

describe('shared echarts token-resolver (the m01 extraction reaches @oods/tokens)', () => {
  it('resolves an OODS categorical token to a concrete colour, converting oklch→rgb', () => {
    // The categorical tokens are stored as oklch() under --oods- prefixed keys while
    // getVizScaleTokens emits unprefixed names — so this exercises BOTH the prefix
    // fallback and the oklch→sRGB conversion in the shared resolver.
    const colour = resolveTokenToColor('--viz-scale-categorical-01');
    expect(colour).toBeDefined();
    expect(colour).toMatch(/^rgb\(/);
  });

  it('returns undefined for an unknown token (no guessing)', () => {
    expect(resolveTokenToColor('--definitely-not-a-real-token')).toBeUndefined();
  });

  it('is deterministic — identical token yields identical colour', () => {
    expect(resolveTokenToColor('--viz-scale-categorical-02')).toBe(
      resolveTokenToColor('--viz-scale-categorical-02'),
    );
  });
});

describe('adaptTreemapToECharts — decoupled spec+data → renderable ECharts option', () => {
  it('builds a treemap series from the INPUT hierarchy, not the IR', () => {
    const option = adaptTreemapToECharts(treemapSpec(), ADJACENCY);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('treemap');
    // The series data reflects the separate `input` param — the spec carries no
    // hierarchy data at all (data.values is empty), proving the decoupling.
    const seriesData = series.data as Record<string, unknown>[];
    expect(seriesData).toHaveLength(1);
    expect(seriesData[0].name).toBe('Company');
  });

  it('emits RESOLVED palette colours (rgb/hex), never `var(--token)` — canvas can\'t use CSS', () => {
    const option = adaptTreemapToECharts(treemapSpec(), ADJACENCY);
    const palette = option.color as string[];

    expect(palette.length).toBeGreaterThan(0);
    for (const colour of palette) {
      expect(colour).toMatch(/^(#|rgb\()/);
      expect(colour).not.toContain('var(');
    }
  });

  it('colours the first visible level (a single root colours its children)', () => {
    const option = adaptTreemapToECharts(treemapSpec(), ADJACENCY);
    const root = (option.series as Record<string, unknown>[])[0];
    const children = (root.data as Record<string, unknown>[])[0].children as Record<string, unknown>[];

    for (const child of children) {
      const itemStyle = child.itemStyle as { color?: string } | undefined;
      expect(itemStyle?.color).toMatch(/^(#|rgb\()/);
    }
  });

  it('colours each root when the data has multiple roots', () => {
    const option = adaptTreemapToECharts(treemapSpec(), NESTED_MULTI_ROOT);
    const roots = (option.series as Record<string, unknown>[])[0].data as Record<string, unknown>[];

    expect(roots.length).toBeGreaterThan(1);
    for (const root of roots) {
      const itemStyle = root.itemStyle as { color?: string } | undefined;
      expect(itemStyle?.color).toMatch(/^(#|rgb\()/);
    }
  });

  it('flows the spec a11y description into the ECharts aria contract', () => {
    const spec = treemapSpec({ a11y: { description: 'Headcount distribution across the org.' } });
    const option = adaptTreemapToECharts(spec, ADJACENCY);
    expect((option.aria as { enabled?: boolean; description?: string }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe(
      'Headcount distribution across the org.',
    );
  });

  it('carries OODS provenance (specId/name) in usermeta for downstream round-tripping', () => {
    const option = adaptTreemapToECharts(treemapSpec(), ADJACENCY);
    const oods = (option.usermeta as { oods?: Record<string, unknown> }).oods!;
    expect(oods.specId).toBe('viz:treemap-test');
    expect(oods.name).toBe('Org Headcount');
  });

  it('is DETERMINISTIC — identical (spec, input) yields a byte-identical serialized option', () => {
    // The Q1 determinism moat. Compared via JSON so the tooltip formatter closure
    // (a non-serialized function) does not introduce false reference inequality —
    // this mirrors how m05 will golden the serializable ECharts option.
    const a = JSON.stringify(adaptTreemapToECharts(treemapSpec(), ADJACENCY));
    const b = JSON.stringify(adaptTreemapToECharts(treemapSpec(), ADJACENCY));
    expect(a).toBe(b);
  });
});

const NESTED_MULTI_ROOT: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'p1', parentId: null, value: 30, name: 'Product A' },
    { id: 'p2', parentId: null, value: 50, name: 'Product B' },
    { id: 'p3', parentId: null, value: 20, name: 'Product C' },
  ],
};
