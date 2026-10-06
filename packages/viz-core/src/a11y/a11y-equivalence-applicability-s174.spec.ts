// s174 m01 — THE 16×8 APPLICABILITY MATRIX.
//
// Warn-first only means something if "not-applicable" is a DERIVED, discriminating state
// rather than a label. This spec pins, for every one of the 16 equivalence rules against
// every one of the 8 ECharts-primary chart families, whether the rule PASSES, FAILS, or is
// NOT-APPLICABLE with its absent precondition named.
//
// It lives in viz-core's own suite deliberately. The mcp-server suite resolves @oods/viz-core
// to DIST, so a matrix pinned there would go on passing against a stale build after an engine
// edit — the discrimination would be fake. viz-core's own vitest aliases the package to SRC,
// so flipping one cell here reds immediately. (The end-to-end proof that certify really emits
// these findings lives in mcp-server: artifact.certify.echarts-a11y-warnfirst.spec.ts.)
//
// The contexts below are built the way the certify path builds them — the type's family
// analyzer, then the shared table + narrative generators over the resulting analysis, against
// a metadata-only IR. That is a deliberate mirror of buildEChartsA11yContext (which lives in
// mcp-server and cannot be imported from here); the mcp-server spec is what proves the real
// path agrees, so this file is free to be about the ENGINE.

import { describe, expect, it } from 'vitest';
import { validateVizEquivalenceRulesForContext, type VizEquivalenceContext } from './equivalence-rules.js';
import { generateAccessibleTable } from './table-generator.js';
import { generateNarrativeSummary } from './narrative-generator.js';
import { analyzeHierarchy, analyzeNetwork, analyzeSankey } from './non-cartesian-analysis.js';
import { analyzeSpatial } from './spatial-analysis.js';
import type { VizDataAnalysis } from './data-analysis.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

type Cell = 'pass' | 'fail' | 'n/a';

const RULE_IDS = [
  'A11Y-R-01',
  'A11Y-R-02',
  'A11Y-R-03',
  'A11Y-R-04',
  'A11Y-R-05',
  'A11Y-R-06',
  'A11Y-R-07',
  'A11Y-R-08',
  'A11Y-R-09',
  'A11Y-R-10',
  'A11Y-R-11',
  'A11Y-R-12',
  'A11Y-R-13',
  'A11Y-R-14',
  'A11Y-R-15',
  'A11Y-R-16',
] as const;

/** The metadata-only IR shape every ECharts-primary type certifies from. */
function echartsIr(trait: string, chartType: string, name?: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: `viz:${chartType}`,
    ...(name ? { name } : {}),
    data: { values: [] },
    marks: [{ trait }],
    encoding: {},
    a11y: { description: `A ${chartType} of the operand data, generated for the matrix pin.` },
  } as unknown as NormalizedVizSpec;
}

const HIERARCHY = {
  type: 'nested' as const,
  data: {
    name: 'root',
    children: [
      { name: 'alpha', value: 30 },
      { name: 'beta', value: 70 },
      { name: 'gamma', value: 12 },
    ],
  },
};
const FLOW = {
  nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  links: [
    { source: 'A', target: 'B', value: 5 },
    { source: 'A', target: 'C', value: 15 },
  ],
};
const NETWORK = {
  nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
  links: [
    { source: 'n1', target: 'n2' },
    { source: 'n1', target: 'n3' },
  ],
};
const SPATIAL = [
  { id: 'CA', featureLabel: 'California', values: { state: 'CA', sales: 100 } },
  { id: 'TX', featureLabel: 'Texas', values: { state: 'TX', sales: 60 } },
  { id: 'NY', featureLabel: 'New York', values: { state: 'NY', sales: 85 } },
];

interface Family {
  readonly chartType: string;
  readonly trait: string;
  readonly label: string;
  readonly analyze: () => VizDataAnalysis;
  readonly measureLabel: string;
}

const FAMILIES: readonly Family[] = [
  { chartType: 'treemap', trait: 'MarkTreemap', label: 'Treemap', analyze: () => analyzeHierarchy(HIERARCHY), measureLabel: 'Value' },
  { chartType: 'sunburst', trait: 'MarkSunburst', label: 'Sunburst', analyze: () => analyzeHierarchy(HIERARCHY), measureLabel: 'Value' },
  { chartType: 'sankey', trait: 'MarkSankey', label: 'Sankey diagram', analyze: () => analyzeSankey(FLOW), measureLabel: 'Flow' },
  { chartType: 'chord', trait: 'MarkChord', label: 'Chord diagram', analyze: () => analyzeSankey(FLOW), measureLabel: 'Flow' },
  { chartType: 'force_graph', trait: 'MarkGraph', label: 'Force-directed graph', analyze: () => analyzeNetwork(NETWORK), measureLabel: 'Connections' },
  { chartType: 'choropleth', trait: 'MarkChoropleth', label: 'Choropleth map', analyze: () => analyzeSpatial({ features: SPATIAL, valueField: 'sales' }), measureLabel: 'sales' },
  { chartType: 'bubble_map', trait: 'MarkBubble', label: 'Bubble map', analyze: () => analyzeSpatial({ features: SPATIAL, valueField: 'sales' }), measureLabel: 'sales' },
  { chartType: 'flow_map', trait: 'MarkFlow', label: 'Flow map', analyze: () => analyzeSpatial({ features: SPATIAL, valueField: 'sales' }), measureLabel: 'sales' },
];

function contextFor(family: Family, name?: string): VizEquivalenceContext {
  const spec = echartsIr(family.trait, family.chartType, name);
  const analysis = family.analyze();
  const table = generateAccessibleTable({
    analysis,
    ...(spec.name ? { caption: `Data table for ${spec.name}` } : {}),
    id: spec.id,
  });
  const narrative = generateNarrativeSummary({
    analysis,
    chartLabel: spec.name ?? family.label,
    measureLabel: family.measureLabel,
    fallbackSummary: spec.a11y.description,
  });
  return { spec, table, narrative, analysis };
}

function cellsFor(family: Family, name?: string): Record<string, Cell> {
  const grid: Record<string, Cell> = {};
  for (const result of validateVizEquivalenceRulesForContext(contextFor(family, name))) {
    grid[result.id] = result.notApplicable ? 'n/a' : result.passed ? 'pass' : 'fail';
  }
  return grid;
}

// THE PIN. One row per chart type; the 16 cells are in RULE_IDS order (R-01 … R-16), an
// ordering the spec below asserts against the engine rather than assuming.
//
// What decides each cell:
//   n/a  R-01/R-02/R-05/R-12  no encoding channels at all — the IR is metadata-only, so there
//                             is no color/size binding, no x/y binding, no bound field.
//   n/a  R-04/R-06/R-10       the mark is not bar/area/line; these narrative rules name the
//                             mark they wanted, which is what makes the absence readable.
//   n/a  R-13                 no fixture carries more than 12 rows.
//   n/a  R-16                 no fixture declares a filter/zoom interaction.
//   pass R-03/R-07/R-08/R-09/R-15  the operand-built table and narrative genuinely satisfy
//                             these — real passes, which is exactly why not-applicable had to
//                             come out of the pass bucket.
//   fail R-14                 more than 2 table columns and no portability.tableColumnOrder.
//                             The finding warn-first surfaces on a well-formed ECharts
//                             operand, and it is correct.
//
// TWO cells are where the matrix DISCRIMINATES between families rather than repeating itself,
// and both were MEASURED here rather than predicted:
//   R-11 (>= 3 rows)          the flow fixture analyses to 2 rows (two links), so sankey and
//                             chord report not-applicable where the other six report a real
//                             pass. force_graph is a row per NODE (three of them), not a row
//                             per link — which is exactly why it is not in that group.
//   R-14 (> 2 table columns)  the network analysis projects a two-column table (node,
//                             connections), so force_graph is the ONE family whose
//                             column-ordering rule is NOT-APPLICABLE here rather than failing
//                             — two columns have no ordering ambiguity to declare.
const MATRIX: Readonly<Record<string, readonly Cell[]>> = {
  //             R-01   R-02   R-03    R-04   R-05   R-06   R-07    R-08    R-09    R-10   R-11    R-12   R-13   R-14    R-15    R-16
  treemap:     ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  sunburst:    ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  sankey:      ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'n/a',  'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  chord:       ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'n/a',  'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  force_graph: ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'n/a',  'pass', 'n/a'],
  choropleth:  ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  bubble_map:  ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'fail', 'pass', 'n/a'],
  flow_map:    ['n/a', 'n/a', 'pass', 'n/a', 'n/a', 'n/a', 'pass', 'pass', 'pass', 'n/a', 'pass', 'n/a', 'n/a', 'fail', 'pass', 'n/a'],
};

describe('a11y equivalence — the 16×8 applicability matrix (s174 m01)', () => {
  it.each(FAMILIES.map((f) => [f.chartType, f] as const))(
    '%s: all 16 rules land on their pinned pass/fail/not-applicable cell',
    (chartType, family) => {
      const observed = cellsFor(family, 'Matrix fixture');
      expect(RULE_IDS.map((id) => observed[id])).toEqual(MATRIX[chartType]);
    },
  );

  it('the matrix covers every rule the engine actually ships, in the engine order — no rule can be added without a cell', () => {
    const observed = validateVizEquivalenceRulesForContext(contextFor(FAMILIES[0]!, 'Matrix fixture')).map(
      (r) => r.id,
    );
    expect(observed).toEqual([...RULE_IDS]);
    expect(Object.keys(MATRIX)).toEqual(FAMILIES.map((f) => f.chartType));
    for (const row of Object.values(MATRIX)) {
      expect(row).toHaveLength(RULE_IDS.length);
    }
  });

  it('the matrix is not a uniform grid — R-11 and R-14 separate the families', () => {
    // A matrix whose every row is identical could be produced by a broken engine that ignores
    // its input. These are the two axes on which the eight fixtures genuinely differ.
    const r11 = RULE_IDS.indexOf('A11Y-R-11');
    const r14 = RULE_IDS.indexOf('A11Y-R-14');
    expect(MATRIX.sankey![r11]).toBe('n/a');
    expect(MATRIX.treemap![r11]).toBe('pass');
    expect(MATRIX.force_graph![r14]).toBe('n/a');
    expect(MATRIX.treemap![r14]).toBe('fail');
  });
});

describe('a11y equivalence — not-applicable is DERIVED, not decorative (s174 m01)', () => {
  it('every not-applicable result NAMES its absent precondition and still reports passed:true', () => {
    const results = validateVizEquivalenceRulesForContext(contextFor(FAMILIES[0]!, 'Matrix fixture'));
    const na = results.filter((r) => r.notApplicable);
    expect(na.length).toBeGreaterThan(0);
    for (const result of na) {
      expect(result.passed).toBe(true);
      expect(result.preconditionAbsent).toBeTypeOf('string');
      expect(result.preconditionAbsent?.length).toBeGreaterThan(0);
    }
  });

  it('a genuine pass is DISTINGUISHABLE from a not-applicable one — the property the old engine lacked', () => {
    const results = validateVizEquivalenceRulesForContext(contextFor(FAMILIES[0]!, 'Matrix fixture'));
    const genuine = results.find((r) => r.id === 'A11Y-R-03');
    const absent = results.find((r) => r.id === 'A11Y-R-01');
    // Both are passed:true — that is the compatibility the sprint promised. The new field is
    // what tells them apart.
    expect(genuine?.passed).toBe(true);
    expect(absent?.passed).toBe(true);
    expect(genuine?.notApplicable).toBeUndefined();
    expect(absent?.notApplicable).toBe(true);
    expect(absent?.preconditionAbsent).toBe('a color encoding bound to a field');
  });

  it('SUPPLYING a precondition moves the cell off not-applicable — applicability tracks the input, not the chart type', () => {
    // R-16's declared precondition is a filter/zoom interaction. Add one to the same IR and
    // the rule stops being not-applicable and starts judging (it fails, because the IR has no
    // a11y.narrative.summary describing the announce workflow).
    const family = FAMILIES[0]!;
    const base = contextFor(family, 'Matrix fixture');
    const withInteraction: VizEquivalenceContext = {
      ...base,
      spec: {
        ...base.spec,
        interactions: [{ id: 'zoom-1', rule: { bindTo: 'zoom' } }],
      } as unknown as NormalizedVizSpec,
    };
    const before = validateVizEquivalenceRulesForContext(base).find((r) => r.id === 'A11Y-R-16');
    const after = validateVizEquivalenceRulesForContext(withInteraction).find((r) => r.id === 'A11Y-R-16');
    expect(before?.notApplicable).toBe(true);
    expect(after?.notApplicable).toBeUndefined();
    expect(after?.passed).toBe(false);
  });

  it('an UNNAMED metadata-only IR fails R-09 — the operand cannot supply a name, so this is a real finding', () => {
    const results = validateVizEquivalenceRulesForContext(contextFor(FAMILIES[0]!));
    const r09 = results.find((r) => r.id === 'A11Y-R-09');
    expect(r09?.passed).toBe(false);
    expect(r09?.notApplicable).toBeUndefined();
    expect(r09?.severity).toBe('error');
  });
});
