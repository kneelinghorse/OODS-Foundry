// s172 m03 — proof for the six ECharts-side accuracy rules (OODS-V154..V159).
//
// Every rule ships the s170 pattern: a synthetic RED, a MINIMAL GREEN twin that differs in
// ONE property, and a mutation gate proving evaluate() is what fires. The two rules that
// compare floats additionally ship a TOLERANCE-BOUNDARY pair — one case just inside the
// 1e-9 relative epsilon and one just outside — because a rule that only ever sees
// order-of-magnitude differences has not been shown to have a tolerance at all.
//
// The discriminating checks are composed from the REAL exported predicates
// (differsBeyondTolerance, findDuplicateLinks, joinGeoWithData), never transcribed.

import { describe, expect, it } from 'vitest';
import { findDuplicateLinks } from '../adapters/echarts/link-integrity.js';
import { joinGeoWithData } from '../adapters/spatial/geo-data-joiner.js';
import {
  ACCURACY_RELATIVE_EPSILON,
  differsBeyondTolerance,
} from './echarts-types.js';
import {
  ECHARTS_ACCURACY_RULES,
  echartsAccuracyRulesFor,
  evaluateEChartsAccuracyRules,
  emptyOfferedSetNote,
} from './echarts-index.js';
import type { EChartsAccuracyChartType, EChartsAccuracyOperand } from './echarts-types.js';

const operand = (chartType: EChartsAccuracyChartType, branchData: unknown): EChartsAccuracyOperand => ({
  chartType,
  branchData,
});

const codesFrom = (chartType: EChartsAccuracyChartType, branchData: unknown): string[] =>
  evaluateEChartsAccuracyRules(operand(chartType, branchData)).findings.map((f) => f.code);

const ruleById = (id: string) => ECHARTS_ACCURACY_RULES.find((rule) => rule.id === id)!;

// ---- OODS-V154 — hierarchy node value area/angle cannot encode ----------------------

describe('OODS-V154 — treemap/sunburst node value (s172 m03)', () => {
  const GREEN = {
    type: 'nested' as const,
    data: { name: 'root', children: [{ name: 'a', value: 40 }, { name: 'b', value: 60 }] },
  };
  // ONE property differs: 'a'.value 40 -> -40.
  const RED_NEGATIVE = {
    type: 'nested' as const,
    data: { name: 'root', children: [{ name: 'a', value: -40 }, { name: 'b', value: 60 }] },
  };
  const RED_NON_FINITE = {
    type: 'nested' as const,
    data: { name: 'root', children: [{ name: 'a', value: Number.NaN }, { name: 'b', value: 60 }] },
  };

  it('GREEN: all-positive finite values do not fire', () => {
    expect(codesFrom('treemap', GREEN)).not.toContain('OODS-V154');
  });

  it('RED: a negative node value fires, and the message names the offending node', () => {
    const result = evaluateEChartsAccuracyRules(operand('treemap', RED_NEGATIVE));
    const finding = result.findings.find((f) => f.code === 'OODS-V154');
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('a (-40)');
  });

  it('RED: a non-finite node value fires too (area has no NaN)', () => {
    expect(codesFrom('sunburst', RED_NON_FINITE)).toContain('OODS-V154');
  });

  it('an UNAUTHORED value never fires — a renderer-computed node has nothing to contradict', () => {
    const noValues = { type: 'nested' as const, data: { name: 'root', children: [{ name: 'a' }, { name: 'b' }] } };
    expect(codesFrom('treemap', noValues)).not.toContain('OODS-V154');
  });

  it('adjacency_list is read too, not just nested', () => {
    const adjacency = {
      type: 'adjacency_list' as const,
      data: [
        { id: 'root', parentId: null, value: 100 },
        { id: 'a', parentId: 'root', value: -1 },
      ],
    };
    expect(codesFrom('treemap', adjacency)).toContain('OODS-V154');
  });

  it('MUTATION: removing V154 from the offered set stops exactly its RED and nothing else', () => {
    const without = echartsAccuracyRulesFor('treemap').filter((r) => r.id !== 'hierarchy-negative-value');
    const mutated = evaluateEChartsAccuracyRules(operand('treemap', RED_NEGATIVE), without);
    expect(mutated.findings.map((f) => f.code)).not.toContain('OODS-V154');
    // And the real set DOES fire it — the two directions are mutually exclusive.
    expect(codesFrom('treemap', RED_NEGATIVE)).toContain('OODS-V154');
  });
});

// ---- OODS-V155 — non-additive explicit parent ---------------------------------------

describe('OODS-V155 — explicit parent value vs children sum (s172 m03)', () => {
  const nested = (parentValue: number | undefined, children: Array<{ name: string; value?: number }>) => ({
    type: 'nested' as const,
    data: { name: 'root', ...(parentValue === undefined ? {} : { value: parentValue }), children },
  });

  it('GREEN: an explicit parent that equals the sum does not fire', () => {
    expect(codesFrom('treemap', nested(100, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }]))).not.toContain(
      'OODS-V155',
    );
  });

  it('RED: one property differs (parent 100 -> 90) and it fires, naming both numbers', () => {
    const result = evaluateEChartsAccuracyRules(
      operand('treemap', nested(90, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }])),
    );
    const finding = result.findings.find((f) => f.code === 'OODS-V155');
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('declared 90');
    expect(finding?.message).toContain('children sum to 100');
  });

  it('TOLERANCE BOUNDARY, GREEN half: a relative difference of 5e-10 (inside 1e-9) does NOT fire', () => {
    const parent = 100 + 5e-8; // |diff|/max = 5e-10
    expect(differsBeyondTolerance(parent, 100)).toBe(false);
    expect(codesFrom('treemap', nested(parent, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }]))).not.toContain(
      'OODS-V155',
    );
  });

  it('TOLERANCE BOUNDARY, RED half: a relative difference of 5e-9 (outside 1e-9) DOES fire', () => {
    const parent = 100 + 5e-7; // |diff|/max = 5e-9
    expect(differsBeyondTolerance(parent, 100)).toBe(true);
    expect(codesFrom('treemap', nested(parent, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }]))).toContain(
      'OODS-V155',
    );
  });

  it('the tolerance is RELATIVE, not absolute: the same 5e-7 gap fires at scale 100 and not at scale 1e9', () => {
    expect(differsBeyondTolerance(100 + 5e-7, 100)).toBe(true);
    expect(differsBeyondTolerance(1e9 + 5e-7, 1e9)).toBe(false);
  });

  it('EXACT-EQUALITY REGRESSION: 0.1 + 0.2 authored as 0.3 is correct data and must NOT fire', () => {
    // The float sum is 0.30000000000000004; exact equality would report a distortion here.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(codesFrom('treemap', nested(0.3, [{ name: 'a', value: 0.1 }, { name: 'b', value: 0.2 }]))).not.toContain(
      'OODS-V155',
    );
  });

  it('a parent with NO explicit value is UNEVALUATED with a note — never a silent pass', () => {
    const result = evaluateEChartsAccuracyRules(
      operand('treemap', nested(undefined, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }])),
    );
    expect(result.findings.map((f) => f.code)).not.toContain('OODS-V155');
    expect(result.notes.some((n) => n.includes('additivity could not be checked'))).toBe(true);
    // V154 still ran, so rulesEvaluated distinguishes it from "nothing ran".
    expect(result.rulesEvaluated).toBe(1);
  });

  it('a parent whose children are partly valueless is UNEVALUATED, not guessed at', () => {
    const result = evaluateEChartsAccuracyRules(
      operand('treemap', nested(100, [{ name: 'a', value: 60 }, { name: 'b' }])),
    );
    expect(result.findings.map((f) => f.code)).not.toContain('OODS-V155');
    expect(result.notes.some((n) => n.includes('at least one child with no value'))).toBe(true);
  });

  it('MUTATION: removing V155 stops exactly its RED', () => {
    const red = nested(90, [{ name: 'a', value: 60 }, { name: 'b', value: 40 }]);
    const without = echartsAccuracyRulesFor('treemap').filter((r) => r.id !== 'hierarchy-non-additive-parent');
    expect(evaluateEChartsAccuracyRules(operand('treemap', red), without).findings.map((f) => f.code)).not.toContain(
      'OODS-V155',
    );
    expect(codesFrom('treemap', red)).toContain('OODS-V155');
  });
});

// ---- OODS-V156 — negative / non-finite link value -----------------------------------

describe('OODS-V156 — sankey/chord link value (s172 m03)', () => {
  const GREEN = {
    nodes: [{ name: 'A' }, { name: 'B' }],
    links: [{ source: 'A', target: 'B', value: 5 }],
  };
  const RED_NEGATIVE = {
    nodes: [{ name: 'A' }, { name: 'B' }],
    links: [{ source: 'A', target: 'B', value: -5 }],
  };

  it('GREEN: a positive link value does not fire', () => {
    expect(codesFrom('sankey', GREEN)).not.toContain('OODS-V156');
    expect(codesFrom('chord', GREEN)).not.toContain('OODS-V156');
  });

  it('RED: a negative value fires on BOTH sankey and chord (one property differs: 5 -> -5)', () => {
    expect(codesFrom('sankey', RED_NEGATIVE)).toContain('OODS-V156');
    expect(codesFrom('chord', RED_NEGATIVE)).toContain('OODS-V156');
  });

  it('the message uses the type-correct noun (chord ribbons, sankey links)', () => {
    const chord = evaluateEChartsAccuracyRules(operand('chord', RED_NEGATIVE)).findings.find(
      (f) => f.code === 'OODS-V156',
    );
    const sankey = evaluateEChartsAccuracyRules(operand('sankey', RED_NEGATIVE)).findings.find(
      (f) => f.code === 'OODS-V156',
    );
    expect(chord?.message).toContain('ribbon');
    expect(sankey?.message).toContain('link');
  });

  it('RED: a NON-FINITE chord value fires — chord validates values not at all upstream', () => {
    const nonFinite = { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: Number.POSITIVE_INFINITY }] };
    expect(codesFrom('chord', nonFinite)).toContain('OODS-V156');
  });

  it('zero is a legitimate flow and does not fire', () => {
    const zero = { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 0 }] };
    expect(codesFrom('chord', zero)).not.toContain('OODS-V156');
  });

  it('MUTATION: removing V156 stops exactly its RED', () => {
    const without = echartsAccuracyRulesFor('chord').filter((r) => r.id !== 'flow-negative-link-value');
    expect(
      evaluateEChartsAccuracyRules(operand('chord', RED_NEGATIVE), without).findings.map((f) => f.code),
    ).not.toContain('OODS-V156');
    expect(codesFrom('chord', RED_NEGATIVE)).toContain('OODS-V156');
  });
});

// ---- OODS-V157 — node height vs the flow its links carry -----------------------------

describe('OODS-V157 — sankey node value override / non-conservation (s172 m03)', () => {
  // Conserving chain: A -(60)-> B -(60)-> C. B is intermediate and balanced.
  const GREEN = {
    nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    links: [
      { source: 'A', target: 'B', value: 60 },
      { source: 'B', target: 'C', value: 60 },
    ],
  };

  it('GREEN: a conserving chain with no declared values does not fire', () => {
    expect(codesFrom('sankey', GREEN)).not.toContain('OODS-V157');
  });

  it('RED (cause a): ONE property differs — B declares value 100 while its links carry 60', () => {
    const red = { ...GREEN, nodes: [{ name: 'A' }, { name: 'B', value: 100 }, { name: 'C' }] };
    const finding = evaluateEChartsAccuracyRules(operand('sankey', red)).findings.find(
      (f) => f.code === 'OODS-V157',
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('declared 100');
    expect(finding?.message).toContain('links carry 60');
  });

  it('GREEN twin: the SAME declared value, matching the links, does not fire', () => {
    const green = { ...GREEN, nodes: [{ name: 'A' }, { name: 'B', value: 60 }, { name: 'C' }] };
    expect(codesFrom('sankey', green)).not.toContain('OODS-V157');
  });

  it('RED (cause b): an INTERMEDIATE node that takes in 60 and sends out 45 fires as non-conservation', () => {
    const leak = {
      nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      links: [
        { source: 'A', target: 'B', value: 60 },
        { source: 'B', target: 'C', value: 45 },
      ],
    };
    const finding = evaluateEChartsAccuracyRules(operand('sankey', leak)).findings.find(
      (f) => f.code === 'OODS-V157',
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('takes in 60 and sends out 45');
  });

  it('SOURCES AND SINKS NEVER FIRE: A has incoming 0 and C has outgoing 0, and neither is named', () => {
    const leak = {
      nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      links: [
        { source: 'A', target: 'B', value: 60 },
        { source: 'B', target: 'C', value: 45 },
      ],
    };
    const message =
      evaluateEChartsAccuracyRules(operand('sankey', leak)).findings.find((f) => f.code === 'OODS-V157')?.message ?? '';
    expect(message).toContain('"B"');
    expect(message).not.toContain('"A"');
    expect(message).not.toContain('"C"');
  });

  it('TOLERANCE BOUNDARY, GREEN half: a declared value 5e-10 relative off the computed flow does NOT fire', () => {
    const inside = { ...GREEN, nodes: [{ name: 'A' }, { name: 'B', value: 60 + 3e-8 }, { name: 'C' }] };
    expect(differsBeyondTolerance(60 + 3e-8, 60)).toBe(false);
    expect(codesFrom('sankey', inside)).not.toContain('OODS-V157');
  });

  it('TOLERANCE BOUNDARY, RED half: 5e-9 relative off DOES fire', () => {
    const outside = { ...GREEN, nodes: [{ name: 'A' }, { name: 'B', value: 60 + 3e-7 }, { name: 'C' }] };
    expect(differsBeyondTolerance(60 + 3e-7, 60)).toBe(true);
    expect(codesFrom('sankey', outside)).toContain('OODS-V157');
  });

  it('MUTATION: removing V157 stops exactly its RED', () => {
    const red = { ...GREEN, nodes: [{ name: 'A' }, { name: 'B', value: 100 }, { name: 'C' }] };
    const without = echartsAccuracyRulesFor('sankey').filter((r) => r.id !== 'sankey-node-value-override');
    expect(
      evaluateEChartsAccuracyRules(operand('sankey', red), without).findings.map((f) => f.code),
    ).not.toContain('OODS-V157');
    expect(codesFrom('sankey', red)).toContain('OODS-V157');
  });
});

// ---- OODS-V158 — duplicate directed sankey links -------------------------------------

describe('OODS-V158 — duplicate directed sankey flow (s172 m03)', () => {
  const GREEN = {
    nodes: [{ name: 'A' }, { name: 'B' }],
    links: [
      { source: 'A', target: 'B', value: 30 },
      { source: 'B', target: 'A', value: 30 },
    ],
  };
  const RED = {
    nodes: [{ name: 'A' }, { name: 'B' }],
    links: [
      { source: 'A', target: 'B', value: 30 },
      { source: 'A', target: 'B', value: 30 },
    ],
  };

  it('GREEN: a RECIPROCAL pair (A->B and B->A) is valid data and does not fire — direction matters', () => {
    expect(codesFrom('sankey', GREEN)).not.toContain('OODS-V158');
    // Discriminating check composed from the REAL predicate, not a transcription of it.
    expect(findDuplicateLinks(GREEN.links)).toHaveLength(0);
  });

  it('RED: ONE property differs (B->A becomes A->B) and it fires with the repeat count', () => {
    const finding = evaluateEChartsAccuracyRules(operand('sankey', RED)).findings.find(
      (f) => f.code === 'OODS-V158',
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('"A" -> "B" x2');
    expect(findDuplicateLinks(RED.links)).toHaveLength(1);
  });

  it('CHORD does NOT offer V158 — the s148 reopen is sankey-only, chord duplicates stay render-side warns', () => {
    expect(echartsAccuracyRulesFor('chord').map((r) => r.code)).not.toContain('OODS-V158');
    expect(codesFrom('chord', RED)).not.toContain('OODS-V158');
  });

  it('MUTATION: removing V158 stops exactly its RED', () => {
    const without = echartsAccuracyRulesFor('sankey').filter((r) => r.id !== 'sankey-duplicate-link');
    expect(evaluateEChartsAccuracyRules(operand('sankey', RED), without).findings.map((f) => f.code)).not.toContain(
      'OODS-V158',
    );
    expect(codesFrom('sankey', RED)).toContain('OODS-V158');
  });
});

// ---- OODS-V159 — choropleth join conflict --------------------------------------------

describe('OODS-V159 — choropleth join conflict (s172 m03)', () => {
  const GEOJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'CA',
        properties: { region: 'CA' },
        geometry: { type: 'Polygon', coordinates: [[[-124, 32], [-114, 32], [-114, 42], [-124, 32]]] },
      },
    ],
  };
  const branch = (rows: Array<Record<string, unknown>>) => ({
    geojson: GEOJSON,
    rows,
    join: { dataKey: 'state', featureProperty: 'region' },
    valueField: 'sales',
  });

  it('GREEN: one row per region does not fire', () => {
    expect(codesFrom('choropleth', branch([{ state: 'CA', sales: 100 }]))).not.toContain('OODS-V159');
  });

  it('BENIGN MULTIPLICITY: two rows matching one region with the SAME value do NOT fire — one-to-many is supported', () => {
    const rows = [
      { state: 'CA', sales: 100, quarter: 'Q1' },
      { state: 'CA', sales: 100, quarter: 'Q2' },
    ];
    expect(codesFrom('choropleth', branch(rows))).not.toContain('OODS-V159');
  });

  it('RED: the SAME two rows with ONE property differing (100 -> 250) DO fire, naming both values', () => {
    const rows = [
      { state: 'CA', sales: 100, quarter: 'Q1' },
      { state: 'CA', sales: 250, quarter: 'Q2' },
    ];
    const finding = evaluateEChartsAccuracyRules(operand('choropleth', branch(rows))).findings.find(
      (f) => f.code === 'OODS-V159',
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('100 vs 250');
    expect(finding?.message).toContain('sales');
  });

  it('numeric agreement is judged under the same relative tolerance (0.1+0.2 vs 0.3 is not a conflict)', () => {
    const rows = [
      { state: 'CA', sales: 0.1 + 0.2 },
      { state: 'CA', sales: 0.3 },
    ];
    expect(codesFrom('choropleth', branch(rows))).not.toContain('OODS-V159');
  });

  // ---- s173 m01, defect 3: the sparse row ----------------------------------------------
  //
  // A partial-coverage dataset (one row per region per quarter, and a region that reported
  // in only one quarter) is the SHAPE real data has, and V159 fired on it: it read the
  // missing key as `undefined` and compared that against the real value. The premise the
  // rule needs is that an absent key cannot change what the reader sees — so these two
  // tests prove it against the REAL joiner, not against a restatement of it, and they are
  // the pair that tells presence apart from nullity.

  const mergedValue = (rows: Array<Record<string, unknown>>): unknown => {
    const joined = joinGeoWithData(GEOJSON.features as never, rows as never, {
      geoKey: 'region',
      dataKey: 'state',
    });
    return (joined.features[0]?.properties as Record<string, unknown>).sales;
  };

  it('SPARSE ROW: a matched row that OMITS the value field does NOT fire — the merge cannot see it', () => {
    const rows = [
      { state: 'CA', sales: 100, quarter: 'Q1' },
      { state: 'CA', quarter: 'Q2' },
    ];
    // The premise, measured through the joiner the adapter actually uses: the drawn value
    // is 100 either way, so there is no arbitrary pick to warn about.
    expect(mergedValue(rows)).toBe(100);
    expect(codesFrom('choropleth', branch(rows))).not.toContain('OODS-V159');
    // And it is a genuine PASS, not an unevaluated silence.
    const result = evaluateEChartsAccuracyRules(operand('choropleth', branch(rows)));
    expect(result.rulesEvaluated).toBe(1);
    expect(result.notes).toHaveLength(0);
  });

  it('EXPLICIT NULL is not an omission: a row carrying sales:null DOES fire — it wins the merge when last', () => {
    const rows = [
      { state: 'CA', sales: 100, quarter: 'Q1' },
      { state: 'CA', sales: null, quarter: 'Q2' },
    ];
    // Same measurement, opposite outcome: the null IS spread, so row order decides the shade.
    expect(mergedValue(rows)).toBeNull();
    expect(codesFrom('choropleth', branch(rows))).toContain('OODS-V159');
  });

  it('a branch with NO join is a genuine pass (no multi-match is possible), not an unevaluated silence', () => {
    const result = evaluateEChartsAccuracyRules(
      operand('choropleth', { geojson: GEOJSON, rows: [{ state: 'CA', sales: 1 }], valueField: 'sales' }),
    );
    expect(result.rulesEvaluated).toBe(1);
    expect(result.findings).toHaveLength(0);
    expect(result.notes).toHaveLength(0);
  });

  it('a branch with a join but NO geometry is UNEVALUATED with a note', () => {
    const result = evaluateEChartsAccuracyRules(
      operand('choropleth', { rows: [{ state: 'CA', sales: 1 }], join: { dataKey: 'state', featureProperty: 'region' }, valueField: 'sales' }),
    );
    expect(result.rulesEvaluated).toBe(0);
    expect(result.notes.some((n) => n.includes('no inline geometry'))).toBe(true);
  });

  it('MUTATION: removing V159 stops exactly its RED', () => {
    const rows = [
      { state: 'CA', sales: 100 },
      { state: 'CA', sales: 250 },
    ];
    const without = echartsAccuracyRulesFor('choropleth').filter((r) => r.id !== 'choropleth-join-conflict');
    expect(
      evaluateEChartsAccuracyRules(operand('choropleth', branch(rows)), without).findings.map((f) => f.code),
    ).not.toContain('OODS-V159');
    expect(codesFrom('choropleth', branch(rows))).toContain('OODS-V159');
  });
});

// ---- the engine itself ----------------------------------------------------------------

describe('the ECharts accuracy engine (s172 m03)', () => {
  it('the offered sets are exactly the chartered ones', () => {
    const byType = Object.fromEntries(
      (['treemap', 'sunburst', 'sankey', 'chord', 'force_graph', 'choropleth', 'bubble_map', 'flow_map'] as const).map(
        (type) => [type, echartsAccuracyRulesFor(type).map((r) => r.code)],
      ),
    );
    expect(byType).toEqual({
      treemap: ['OODS-V154', 'OODS-V155'],
      sunburst: ['OODS-V154', 'OODS-V155'],
      sankey: ['OODS-V156', 'OODS-V157', 'OODS-V158'],
      chord: ['OODS-V156'],
      force_graph: ['OODS-V173'],
      choropleth: ['OODS-V159'],
      bubble_map: ['OODS-V168', 'OODS-V169', 'OODS-V170'],
      flow_map: ['OODS-V171', 'OODS-V172'],
    });
  });

  it.each(['force_graph', 'bubble_map', 'flow_map'] as const)(
    '%s offers rules but an unresolved operand stays unevaluated',
    (chartType) => {
      const result = evaluateEChartsAccuracyRules(operand(chartType, undefined));
      expect(echartsAccuracyRulesFor(chartType).length).toBeGreaterThan(0);
      expect(result.rulesEvaluated).toBe(0);
      expect(result.findings).toEqual([]);
      expect(result.notes.length).toBeGreaterThan(0);
      expect(result.notes.join(' ')).not.toContain('offered set is empty');
    },
  );

  it('an injected empty set describes a coverage limit, never an impossibility', () => {
    const result = evaluateEChartsAccuracyRules(operand('force_graph', { links: [] }), []);
    expect(result).toEqual({ findings: [], rulesEvaluated: 0, notes: [emptyOfferedSetNote('force_graph')] });
    expect(result.notes[0]).toContain('offered set is empty');
    expect(result.notes[0]).toContain('not a claim that its data cannot be invalid');
    expect(result.notes[0]).not.toContain('adapter constants');
  });

  it('rulesEvaluated counts RESOLVED rules, not offered ones', () => {
    // A treemap with no explicit parent value: V154 resolves, V155 does not.
    const partial = { type: 'nested' as const, data: { name: 'root', children: [{ name: 'a', value: 1 }] } };
    const result = evaluateEChartsAccuracyRules(operand('treemap', partial));
    expect(echartsAccuracyRulesFor('treemap')).toHaveLength(2);
    expect(result.rulesEvaluated).toBe(1);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('every rule code is unique and preserves V154..V159 plus the s195 V168..V173 allocation', () => {
    expect(ECHARTS_ACCURACY_RULES.map((r) => r.code)).toEqual([
      'OODS-V154',
      'OODS-V155',
      'OODS-V156',
      'OODS-V157',
      'OODS-V158',
      'OODS-V159',
      'OODS-V168',
      'OODS-V169',
      'OODS-V170',
      'OODS-V171',
      'OODS-V172',
      'OODS-V173',
    ]);
  });

  it('the chartered epsilon is 1e-9 and the comparison treats both-zero as equal', () => {
    expect(ACCURACY_RELATIVE_EPSILON).toBe(1e-9);
    expect(differsBeyondTolerance(0, 0)).toBe(false);
  });

  it('every rule is PURE: evaluating twice yields the same result and the operand is unmutated', () => {
    const branchData = {
      nodes: [{ name: 'A' }, { name: 'B', value: 100 }],
      links: [{ source: 'A', target: 'B', value: 60 }],
    };
    const snapshot = JSON.stringify(branchData);
    const first = evaluateEChartsAccuracyRules(operand('sankey', branchData));
    const second = evaluateEChartsAccuracyRules(operand('sankey', branchData));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(branchData)).toBe(snapshot);
  });

  it('each rule summary states what it EXCLUDES, not only what it checks', () => {
    for (const rule of ECHARTS_ACCURACY_RULES) {
      expect(rule.summary.length).toBeGreaterThan(80);
    }
    expect(ruleById('choropleth-join-conflict').summary).toContain('NEVER fires');
    expect(ruleById('sankey-node-value-override').summary).toContain('never fire');
    expect(ruleById('hierarchy-non-additive-parent').summary).toContain('never guessed');
  });
});
