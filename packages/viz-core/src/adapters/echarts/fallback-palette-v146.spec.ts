import { describe, expect, it, vi } from 'vitest';

import { adaptChordToECharts } from './chord-adapter.js';
import { adaptGraphToECharts } from './graph-adapter.js';
import { adaptSankeyToECharts } from './sankey-adapter.js';
import { adaptSunburstToECharts } from './sunburst-adapter.js';
import { adaptTreemapToECharts } from './treemap-adapter.js';
import type { HierarchyInput, NetworkInput, SankeyInput } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';

// s149 #864/#869 — the token-less FALLBACK-palette V146-threshold guard, at the VIZ-CORE
// layer. viz.render's never-cycle warning (OODS-V146) thresholds the distinct-group count
// against `echartsOption.color.length` — the ACTUAL emitted palette length, not a hardcoded
// 6. When the @oods viz-scale categorical tokens do NOT resolve, each ECharts adapter's
// buildPalette() returns its FALLBACK_PALETTE, which is LONGER than the 6-slot resolved
// palette (chord/graph/sunburst/sankey = 9, treemap = 8). So V146's threshold must be 8/9
// in that regime, not 6 — else a 7-to-9-group chart would falsely warn on cycling.
//
// A mcp-server vi.mock of this is INFEASIBLE: @oods/viz-core is tsup-bundled from a single
// src/index.ts, so no internal module specifier survives at the dist boundary and the mock
// silently no-ops against the REAL 6-slot palette. This spec is COLOCATED in viz-core (whose
// vitest resolves @oods/viz-core→src and honours the relative token-resolver mock below), so
// it forces the fallback for real and pins the exact lengths V146 reads.
//
// The mock is SELECTIVE: it drops only the `--viz-scale-*` categorical tokens so buildPalette
// falls back, while `--oods-sys-*` chrome tokens still resolve for real — otherwise the shared
// resolveOodsEchartsChrome (which THROWS on an unresolved chrome token) would blow up before
// the adapter returns its option.
vi.mock('./token-resolver.js', async (importActual) => {
  const actual = await importActual<typeof import('./token-resolver.js')>();
  return {
    ...actual,
    resolveTokenToColor: (token: string): string | undefined =>
      token.startsWith('--viz-scale') ? undefined : actual.resolveTokenToColor(token),
  };
});

const spec = (): NormalizedVizSpec =>
  ({
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:fallback',
    name: 'Fallback probe',
    data: { values: [] },
    marks: [{ trait: 'MarkChord' }],
    encoding: {},
    a11y: { description: 'Token-less fallback palette probe.' },
  }) as NormalizedVizSpec;

const FLOW: SankeyInput = {
  nodes: [{ name: 'AMER' }, { name: 'EMEA' }, { name: 'APAC' }],
  links: [
    { source: 'AMER', target: 'EMEA', value: 42 },
    { source: 'EMEA', target: 'APAC', value: 31 },
  ],
};

const NET: NetworkInput = {
  nodes: [
    { id: 'a', group: 'web' },
    { id: 'b', group: 'api' },
    { id: 'c', group: 'db' },
  ],
  links: [{ source: 'a', target: 'b', value: 3 }],
};

const HIER: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 0, name: 'Company' },
    { id: 'eng', parentId: 'root', value: 12, name: 'Engineering' },
    { id: 'sales', parentId: 'root', value: 9, name: 'Sales' },
  ],
};

const colorLen = (option: unknown): number => (option as { color: readonly string[] }).color.length;

describe('ECharts-primary fallback palette — V146 threshold length (s149 #864/#869)', () => {
  // The resolved palette clamps to 6 slots (getVizScaleTokens caps at the 6-token array), so
  // a length of 8/9 here PROVES the fallback fired (6 would mean tokens still resolved). This
  // is exactly the number V146 reads as its never-cycle threshold in the token-less regime.
  it('chord falls back to the 9-slot palette (V146 threshold = 9, not 6)', () => {
    expect(colorLen(adaptChordToECharts(spec(), FLOW))).toBe(9);
  });

  it('force_graph falls back to the 9-slot palette', () => {
    expect(colorLen(adaptGraphToECharts(spec(), NET))).toBe(9);
  });

  it('sankey falls back to the 9-slot palette', () => {
    expect(colorLen(adaptSankeyToECharts(spec(), FLOW))).toBe(9);
  });

  it('sunburst falls back to the 9-slot palette', () => {
    expect(colorLen(adaptSunburstToECharts(spec(), HIER))).toBe(9);
  });

  it('treemap falls back to the 8-slot palette (its FALLBACK_PALETTE is 8, not 9)', () => {
    expect(colorLen(adaptTreemapToECharts(spec(), HIER))).toBe(8);
  });
});
