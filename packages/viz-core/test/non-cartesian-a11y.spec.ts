import { describe, expect, it } from 'vitest';
import {
  analyzeHierarchy,
  analyzeNetwork,
  analyzeSankey,
  generateAccessibleTable,
  generateNarrativeSummary,
  type HierarchyInput,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
} from '@oods/viz-core';

// Sprint-128 m01 / Forge-Demos FD#10: the structured table + narrative an agent
// reads must derive from the SAME source the chart renders from. For the
// non-cartesian families that data arrives via a separate input the spec never
// carries, so before m01 a consumer had to build a throwaway cartesian bar spec
// over the same rows to obtain a11y. These tests pin that the input-shaped path
// produces the SAME structured alternative directly.

const ADJACENCY: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 0 },
    { id: 'a', parentId: 'root', value: 30, name: 'Alpha' },
    { id: 'b', parentId: 'root', value: 20, name: 'Beta' },
    { id: 'c', parentId: 'root', value: 50, name: 'Gamma' },
  ],
};

const NESTED: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'root',
    children: [
      { name: 'Alpha', value: 30 },
      { name: 'Group', children: [{ name: 'Beta', value: 20 }, { name: 'Gamma', value: 50 }] },
    ],
  },
};

const SANKEY: SankeyInput = {
  nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  links: [
    { source: 'A', target: 'B', value: 5 },
    { source: 'A', target: 'C', value: 15 },
    { source: 'B', target: 'C', value: 8 },
  ],
};

const NETWORK: NetworkInput = {
  nodes: [{ id: 'n1', group: 'x' }, { id: 'n2', group: 'y' }, { id: 'n3', group: 'x' }],
  links: [
    { source: 'n1', target: 'n2' },
    { source: 'n1', target: 'n3' },
  ],
};

describe('analyzeHierarchy (treemap / sunburst)', () => {
  it('analyzes leaf nodes only so the total is the whole, not a parent + child double-count', () => {
    const analysis = analyzeHierarchy(ADJACENCY);
    // root is an internal node — excluded; only the 3 leaves are surfaced.
    expect(analysis.rowCount).toBe(3);
    expect(analysis.total).toBe(100);
    expect(analysis.max).toEqual({ label: 'Gamma', value: 50 });
    expect(analysis.min).toEqual({ label: 'Beta', value: 20 });
    expect(analysis.rows[0]).toEqual({ name: 'Alpha', value: 30, parent: 'root' });
  });

  it('flattens a nested hierarchy to its leaves, carrying the immediate parent', () => {
    const analysis = analyzeHierarchy(NESTED);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.total).toBe(100);
    expect(analysis.rows).toEqual([
      { name: 'Alpha', value: 30, parent: 'root' },
      { name: 'Beta', value: 20, parent: 'Group' },
      { name: 'Gamma', value: 50, parent: 'Group' },
    ]);
  });

  it('does not derive a spurious trend (hierarchy rows have no inherent ordering)', () => {
    expect(analyzeHierarchy(ADJACENCY).trend).toBeUndefined();
  });
});

describe('analyzeSankey (sankey / chord)', () => {
  it('treats each link as a flow: total is total flow, extrema are largest/smallest flows', () => {
    const analysis = analyzeSankey(SANKEY);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.total).toBe(28);
    expect(analysis.max).toEqual({ label: 'A → C', value: 15 });
    expect(analysis.min).toEqual({ label: 'A → B', value: 5 });
    expect(analysis.rows[0]).toEqual({ source: 'A', target: 'B', value: 5 });
  });
});

describe('analyzeNetwork (force_graph)', () => {
  it('summarizes node connectivity by degree and surfaces groups as color categories', () => {
    const analysis = analyzeNetwork(NETWORK);
    expect(analysis.rowCount).toBe(3);
    // total degree = 2 × edge count (each of the 2 edges contributes to both endpoints).
    expect(analysis.total).toBe(4);
    expect(analysis.max).toEqual({ label: 'n1', value: 2 });
    expect(analysis.colorField).toBe('group');
    expect(analysis.colorCategories).toEqual(['x', 'y']);
    expect(analysis.rows[0]).toEqual({ id: 'n1', group: 'x', degree: 2 });
  });

  it('omits the group column entirely when no node carries a group', () => {
    const analysis = analyzeNetwork({ nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] });
    expect(analysis.colorField).toBeUndefined();
    expect(analysis.rows[0]).toEqual({ id: 'a', degree: 1 });
  });
});

describe('generateAccessibleTable — pre-built analysis input', () => {
  it('builds a ready table from a hierarchy analysis with spec-path defaults', () => {
    const table = generateAccessibleTable({ analysis: analyzeHierarchy(ADJACENCY) });
    expect(table.status).toBe('ready');
    if (table.status !== 'ready') return;
    expect(table.caption).toBe('Data table for Visualization');
    expect(table.columns.map((c) => c.field)).toEqual(['name', 'value', 'parent']);
    expect(table.columns.find((c) => c.field === 'value')?.isNumeric).toBe(true);
    expect(table.rows[0].key).toBe('viz:row:0');
    expect(table.rows[0].cells.map((cell) => cell.text)).toEqual(['Alpha', '30', 'root']);
  });

  it('honors caller-supplied caption, id prefix, column order, and labels', () => {
    const table = generateAccessibleTable({
      analysis: analyzeHierarchy(ADJACENCY),
      caption: 'Budget by team',
      id: 'tree1',
      columnOrder: ['value', 'name'],
      columnLabels: { value: 'Size', name: 'Category' },
    });
    expect(table.status).toBe('ready');
    if (table.status !== 'ready') return;
    expect(table.caption).toBe('Budget by team');
    expect(table.rows[0].key).toBe('tree1:row:0');
    expect(table.columns.map((c) => c.field)).toEqual(['value', 'name', 'parent']);
    expect(table.columns.map((c) => c.label)).toEqual(['Size', 'Category', 'Parent']);
  });

  it('reports unavailable when the analysis has no rows', () => {
    const empty = analyzeSankey({ nodes: [], links: [] });
    expect(generateAccessibleTable({ analysis: empty }).status).toBe('unavailable');
  });
});

describe('generateNarrativeSummary — pre-built analysis input', () => {
  it('narrates a non-cartesian analysis using the supplied labels', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      chartLabel: 'Corridor flows',
      measureLabel: 'Flow',
    });
    expect(narrative.status).toBe('ready');
    expect(narrative.summary).toContain('Corridor flows covers 3 data points');
    expect(narrative.keyFindings).toContain('High Flow: Flow 15 (A → C)');
    expect(narrative.keyFindings).toContain('Total Flow: 28');
  });

  it('lets an author override win through the SHARED precedence path', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSankey(SANKEY),
      narrative: { summary: 'Hand-written.', keyFindings: ['Only this'] },
    });
    expect(narrative.summary).toBe('Hand-written.');
    expect(narrative.keyFindings).toEqual(['Only this']);
  });
});

describe('FD#10 — a11y from the same source (input vs throwaway cartesian spec)', () => {
  // The pre-m01 workaround: build a throwaway cartesian bar spec over the same
  // rows to obtain the table. This pins that the direct input-shaped path yields
  // the SAME numbers an agent would read, so the throwaway spec is no longer
  // needed.
  const throwawaySpec = {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'throwaway',
    data: { values: SANKEY.links.map((l) => ({ source: l.source, target: l.target, value: l.value })) },
    marks: [{ trait: 'MarkBar' }],
    encoding: {
      x: { field: 'source', trait: 'EncodingPositionX', channel: 'x' },
      y: { field: 'value', trait: 'EncodingPositionY', channel: 'y' },
    },
    a11y: { description: 'Throwaway bar over the corridor rows.' },
  } as NormalizedVizSpec;

  it('produces the same total/extrema and value-column cells as the throwaway spec', () => {
    const fromInput = generateAccessibleTable({ analysis: analyzeSankey(SANKEY) });
    const fromSpec = generateAccessibleTable(throwawaySpec);
    expect(fromInput.status).toBe('ready');
    expect(fromSpec.status).toBe('ready');
    if (fromInput.status !== 'ready' || fromSpec.status !== 'ready') return;

    expect(fromInput.analysis.total).toBe(fromSpec.analysis.total);
    expect(fromInput.analysis.max?.value).toBe(fromSpec.analysis.max?.value);
    expect(fromInput.analysis.min?.value).toBe(fromSpec.analysis.min?.value);
    expect(fromInput.columns.map((c) => c.field)).toEqual(fromSpec.columns.map((c) => c.field));

    const valueCells = (t: typeof fromInput) =>
      t.status === 'ready' ? t.rows.map((r) => r.cells.find((c) => c.field === 'value')?.text) : [];
    expect(valueCells(fromInput)).toEqual(valueCells(fromSpec));
  });
});
