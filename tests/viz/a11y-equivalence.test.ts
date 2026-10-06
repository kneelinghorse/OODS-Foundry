import { describe, expect, it } from 'vitest';
import { generateAccessibleTable } from '@oods/viz-core';
import { generateNarrativeSummary } from '@oods/viz-core';
import { validateVizEquivalenceRules } from '@oods/viz-core';
import {
  analyzeHierarchy,
  analyzeNetwork,
  analyzeSankey,
  analyzeSpatial,
  type HierarchyInput,
  type NetworkInput,
  type SankeyInput,
  type SpatialFeatureRow,
} from '@oods/viz-core';
import { createBarChartSpec } from '../components/viz/__fixtures__/barChartSpec.js';
import { createLineChartSpec } from '../components/viz/__fixtures__/lineChartSpec.js';

describe('Viz accessibility suite', () => {
  it('generates an accessible table descriptor for inline data', () => {
    const spec = createBarChartSpec();
    const table = generateAccessibleTable(spec);

    expect(table.status).toBe('ready');
    expect(table.columns.map((column) => column.label)).toEqual(['Region', 'Revenue (USD)']);
    expect(table.rows[0]?.cells[0]?.text).toBe('North');
    expect(table.caption).toContain('Regional revenue');
  });

  it('creates narrative summaries even when specs omit manual text', () => {
    const base = createLineChartSpec();
    const spec = createLineChartSpec({
      a11y: {
        ...base.a11y,
        narrative: undefined,
      },
    });

    const narrative = generateNarrativeSummary(spec);
    expect(narrative.status).toBe('ready');
    expect(narrative.summary).toMatch(/rises|declines|flat/i);
    expect(narrative.keyFindings.length).toBeGreaterThan(0);
  });

  // s174 m01: the count was stale — the engine has had 16 rules since s149. The assertion
  // itself is unchanged (and is a chartered NON-mover: `passed` stays a boolean, and a rule
  // whose declared precondition is absent still reports passed:true, now alongside
  // notApplicable:true).
  it('passes all 16 equivalence rules for the reference spec', () => {
    const results = validateVizEquivalenceRules(createBarChartSpec());
    expect(results).toHaveLength(16);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('flags rule A11Y-R-03 when the table fallback is disabled', () => {
    const base = createBarChartSpec();
    const spec = createBarChartSpec({
      a11y: {
        ...base.a11y,
        tableFallback: {
          ...base.a11y.tableFallback,
          enabled: false,
        },
      },
    });

    const results = validateVizEquivalenceRules(spec);
    const rule = results.find((entry) => entry.id === 'A11Y-R-03');
    expect(rule?.passed).toBe(false);
    expect(rule?.message).toMatch(/table fallback/i);
  });
});

// FD#10 (sprint-128 m03): the non-cartesian families now derive the SAME
// structured two-part a11y (accessible table + narrative) from their own input
// contracts via the shared generators — no throwaway cartesian spec.
describe('Non-cartesian a11y equivalence (FD#10)', () => {
  const HIERARCHY: HierarchyInput = {
    type: 'adjacency_list',
    data: [
      { id: 'root', parentId: null, value: 0 },
      { id: 'a', parentId: 'root', value: 30, name: 'Alpha' },
      { id: 'b', parentId: 'root', value: 70, name: 'Beta' },
    ],
  };
  const SANKEY: SankeyInput = {
    nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    links: [
      { source: 'A', target: 'B', value: 5 },
      { source: 'A', target: 'C', value: 15 },
    ],
  };
  const NETWORK: NetworkInput = {
    nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
    links: [
      { source: 'n1', target: 'n2' },
      { source: 'n1', target: 'n3' },
    ],
  };
  const SPATIAL: SpatialFeatureRow[] = [
    { id: 's1', featureLabel: 'California', values: { region: 's1', value: 100 } },
    { id: 's2', featureLabel: 'Texas', values: { region: 's2', value: 60 } },
  ];

  const cases = [
    { name: 'treemap/sunburst (hierarchy)', analyze: () => analyzeHierarchy(HIERARCHY) },
    { name: 'sankey/chord (flow)', analyze: () => analyzeSankey(SANKEY) },
    { name: 'force_graph (network)', analyze: () => analyzeNetwork(NETWORK) },
    { name: 'choropleth/bubble_map/flow_map (spatial)', analyze: () => analyzeSpatial({ features: SPATIAL }) },
  ];

  it.each(cases)('produces a ready table + narrative for $name', ({ analyze }) => {
    const analysis = analyze();
    const table = generateAccessibleTable({ analysis });
    const narrative = generateNarrativeSummary({ analysis, chartLabel: 'Chart' });
    expect(table.status).toBe('ready');
    expect(narrative.status).toBe('ready');
    expect(narrative.keyFindings.length).toBeGreaterThan(0);
  });

  it.each(cases)('is deterministic across repeated derivation for $name', ({ analyze }) => {
    const once = generateAccessibleTable({ analysis: analyze() });
    const twice = generateAccessibleTable({ analysis: analyze() });
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});
