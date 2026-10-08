import { describe, expect, it } from 'vitest';
import * as VizCorePublic from '@oods/viz-core';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCURACY_RULES,
  assertNormalizedVizSpec,
  buildVizSpecFromRows,
  evaluateAccuracyRules,
  NormalizedVizSpecError,
  toVegaLiteSpec,
  type AccuracyRule,
  type AccuracyRuleId,
  type NormalizedVizSpec,
} from '@oods/viz-core';
// Module-internal predicates, reached by RELATIVE path exactly as the drawn-value-guard proof
// spec reaches its subject. The two discriminating checks below compose their mutants out of
// THESE — the real predicates — so a mutant is a genuine composition and never a transcription
// that could drift from what ships.
import {
  compiledIndependentPositionalScales,
  layerScopeIndependentPositionalScales,
} from '../src/accuracy/dual-axis-rule.js';
import {
  anyGroupCollapses,
  carriedRowSets,
  collapseGroupKeyFields,
  declaredAggregations,
  NO_DECLARED_AGGREGATION_NOTE,
} from '../src/accuracy/aggregation-rule.js';

// ============================================================================
// Sprint-170 m01 — the four ACCURACY rules (#818, the fourth #977 pillar), proven RED-first.
//
// EVERY red here is SYNTHETIC by necessity: the committed corpus contains zero specs that trip
// any of the four (the 44-fixture sweep below is that fact, asserted). So each rule ships with
//   (a) a RED that positively trips it and a minimal GREEN twin differing in ONE property,
//   (b) a MUTATION GATE proving the rule's own evaluate() is the only thing that fires its RED,
//   (c) for the two scope-sensitive rules, a DISCRIMINATING check proving the scope term is what
//       keeps a legitimate committed fixture green,
//   (d) a faceted and a layered variant, because layout changes each rule's operand.
//
// R3 and R4's reds are produced by the PRODUCTION builder (buildVizSpecFromRows) — they are
// reachable through Forge's own generation path, not only through hand-authored IR. R1 and R2
// are hand-authored schema-valid IR, which is exactly certify's contract (an arbitrary-IR
// reader). Every red passes assertNormalizedVizSpec: a schema-invalid red proves nothing,
// because certify would reject it before any rule ran.
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

/** Compile the way certify does, and evaluate over the pair. */
function evaluate(spec: NormalizedVizSpec, rules: readonly AccuracyRule[] = ACCURACY_RULES) {
  return evaluateAccuracyRules(spec, toVegaLiteSpec(spec), rules);
}

function firedRuleIds(spec: NormalizedVizSpec): AccuracyRuleId[] {
  return evaluate(spec).findings.map((finding) => finding.ruleId);
}

function messageFor(spec: NormalizedVizSpec, ruleId: AccuracyRuleId): string {
  const finding = evaluate(spec).findings.find((entry) => entry.ruleId === ruleId);
  expect(finding, `expected ${ruleId} to fire`).toBeDefined();
  return finding!.message;
}

/** ACCURACY_RULES with one rule's evaluate() replaced by an inert always-silent stub. */
function withRuleGutted(ruleId: AccuracyRuleId): AccuracyRule[] {
  return ACCURACY_RULES.map((rule) =>
    rule.id === ruleId ? { ...rule, evaluate: () => ({ evaluated: true }) } : rule,
  );
}

const ROWS = [
  { region: 'North', revenue: 120 },
  { region: 'South', revenue: 135 },
  { region: 'East', revenue: 98 },
  { region: 'West', revenue: 150 },
];

/** A schema-valid single-bar IR. `options`/`scale`/`layout` are the per-red knobs. */
function barSpec(overrides: {
  options?: Record<string, unknown>;
  yScale?: 'linear' | 'log' | 'sqrt';
  layout?: NormalizedVizSpec['layout'];
  markTrait?: string;
  extraMarks?: NormalizedVizSpec['marks'];
}): NormalizedVizSpec {
  const y = {
    field: 'revenue',
    trait: 'EncodingPositionY',
    channel: 'y' as const,
    type: 'quantitative' as const,
    title: 'Revenue',
    ...(overrides.yScale ? { scale: overrides.yScale } : {}),
  };
  const x = { field: 'region', trait: 'EncodingPositionX', channel: 'x' as const, title: 'Region' };
  return assertNormalizedVizSpec({
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 's170:accuracy:probe',
    name: 'Revenue by region',
    data: { values: ROWS.map((row) => ({ ...row })) },
    marks: [
      {
        trait: overrides.markTrait ?? 'MarkBar',
        encodings: { x, y },
        ...(overrides.options ? { options: overrides.options } : {}),
      },
      ...(overrides.extraMarks ?? []),
    ],
    encoding: { x, y },
    ...(overrides.layout ? { layout: overrides.layout } : {}),
    a11y: { description: 'Revenue by region for the four sales territories in the current period.' },
  });
}

// ============================================================================
// R1 — non-zero bar baseline (OODS-V150)
// ============================================================================

describe('s170 m01 R1 — non-zero bar baseline', () => {
  it('RED: a bar whose baseline is moved off zero fires; the GREEN twin differs only in that', () => {
    const red = barSpec({ options: { baseline: 'min' } });
    const green = barSpec({});
    expect(firedRuleIds(red)).toEqual(['non-zero-bar-baseline']);
    expect(firedRuleIds(green)).toEqual([]);
    // The twin really is one property apart — the compiled scale is the only difference.
    expect(toVegaLiteSpec(red).encoding).not.toEqual(toVegaLiteSpec(green).encoding);
    expect(toVegaLiteSpec(red).mark).toEqual(toVegaLiteSpec(green).mark);
  });

  it('the RED is schema-valid and certifies through the same compile certify uses', () => {
    // assertNormalizedVizSpec inside barSpec already threw if not; pin the compile too.
    expect(() => toVegaLiteSpec(barSpec({ options: { baseline: 'min' } }))).not.toThrow();
  });

  it('PER-CAUSE messages: sqrt is never described as a moved baseline', () => {
    const moved = messageFor(barSpec({ options: { baseline: 'min' } }), 'non-zero-bar-baseline');
    const log = messageFor(barSpec({ yScale: 'log' }), 'non-zero-bar-baseline');
    const sqrt = messageFor(barSpec({ yScale: 'sqrt' }), 'non-zero-bar-baseline');

    expect(moved).toContain('baseline is moved off zero');
    expect(log).toContain('log scale');
    expect(log).not.toContain('baseline is moved');
    // Vega-Lite zero-defaults sqrt TRUE — a sqrt bar IS zero-anchored. Saying otherwise would
    // be a false statement about the chart, which is worse than saying nothing.
    expect(sqrt).toContain('square root');
    expect(sqrt).not.toContain('baseline is moved');
    expect(new Set([moved, log, sqrt]).size).toBe(3);
  });

  it('a bar with baseline 0 (the committed diverging-bar spelling) compiles zero-anchored and stays green', () => {
    const spec = barSpec({ options: { baseline: 0 } });
    expect((toVegaLiteSpec(spec).encoding as Record<string, { scale?: { zero?: boolean } }>).y.scale?.zero).toBe(true);
    expect(firedRuleIds(spec)).toEqual([]);
  });

  it('FACET/LAYER axis: the red fires under a faceted and under a layered layout', () => {
    const faceted = barSpec({
      options: { baseline: 'min' },
      layout: { trait: 'LayoutFacet', rows: { field: 'region' } },
    });
    const layered = barSpec({
      options: { baseline: 'min' },
      layout: { trait: 'LayoutLayer' },
      extraMarks: [
        {
          trait: 'MarkLine',
          encodings: {
            x: { field: 'region', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative' },
          },
        },
      ],
    });
    expect(firedRuleIds(faceted)).toEqual(['non-zero-bar-baseline']);
    expect(firedRuleIds(layered)).toEqual(['non-zero-bar-baseline']);
  });

  it('MUTATION GATE: gutting R1 silences exactly its own red, and no other rule covers it', () => {
    const red = barSpec({ options: { baseline: 'min' } });
    expect(evaluate(red, withRuleGutted('non-zero-bar-baseline')).findings).toEqual([]);
  });
});

// ============================================================================
// R2 — dual axis (OODS-V151)
// ============================================================================

function layeredSpec(sharedScales: Record<string, 'shared' | 'independent'>, marks = 2): NormalizedVizSpec {
  const x = { field: 'region', trait: 'EncodingPositionX', channel: 'x' as const, title: 'Region' };
  const revenue = {
    field: 'revenue',
    trait: 'EncodingPositionY',
    channel: 'y' as const,
    type: 'quantitative' as const,
    title: 'Revenue',
  };
  const margin = {
    field: 'margin',
    trait: 'EncodingPositionY',
    channel: 'y' as const,
    type: 'quantitative' as const,
    title: 'Margin',
  };
  return assertNormalizedVizSpec({
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 's170:accuracy:dual',
    name: 'Revenue and margin by region',
    data: { values: ROWS.map((row, index) => ({ ...row, margin: 3 + index })) },
    marks: [
      { trait: 'MarkBar', encodings: { x, y: revenue } },
      ...(marks > 1 ? [{ trait: 'MarkLine', encodings: { x, y: margin } }] : []),
    ],
    encoding: { x, y: revenue },
    layout: { trait: 'LayoutLayer', sharedScales },
    a11y: { description: 'Revenue bars with a margin line layered over the same four regions.' },
  });
}

describe('s170 m01 R2 — dual axis', () => {
  it('RED: layer-scope independent y fires; the GREEN twin differs only in shared vs independent', () => {
    const red = layeredSpec({ x: 'shared', y: 'independent' });
    const green = layeredSpec({ x: 'shared', y: 'shared' });
    expect(firedRuleIds(red)).toEqual(['dual-axis']);
    expect(firedRuleIds(green)).toEqual([]);
  });

  it('fires on a SINGLE-mark LayoutLayer, which compiles NO `layer` sibling key', () => {
    // The compiled resolve node is byte-identical for layer/facet/concat, and its sibling key
    // is the only compiled discriminator — but a one-mark LayoutLayer emits no `layer` key at
    // all (committed: linked-brush-scatter, stacked-area-projection). A sibling-key-only rule
    // would miss this real dual axis, which is why the scope is read off the IR.
    const spec = layeredSpec({ y: 'independent' }, 1);
    expect(Object.keys(toVegaLiteSpec(spec))).not.toContain('layer');
    expect(firedRuleIds(spec)).toEqual(['dual-axis']);
  });

  it('non-positional independence (color) never fires', () => {
    expect(firedRuleIds(layeredSpec({ color: 'independent' }))).toEqual([]);
  });

  it('GUARDS: facet-scope and concat-scope independent y are legitimate and stay silent', () => {
    for (const relative of [
      'examples/viz/patterns-v2/sparkline-grid.spec.json', // LayoutFacet + independent y
      'examples/viz/patterns-v2/focus-context-line.spec.json', // LayoutConcat + independent y
    ]) {
      const spec = assertNormalizedVizSpec(
        JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8')),
      );
      expect(firedRuleIds(spec), relative).toEqual([]);
    }
  });

  it('DISCRIMINATING CHECK: a scope-blind mutant reds both guards — the scope term is what saves them', () => {
    // The mutant is composed from the REAL compiled-half predicate, with the IR scope term
    // dropped. If R2 ever loses its scope term, these two committed fixtures start firing.
    for (const relative of [
      'examples/viz/patterns-v2/sparkline-grid.spec.json',
      'examples/viz/patterns-v2/focus-context-line.spec.json',
    ]) {
      const spec = assertNormalizedVizSpec(
        JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8')),
      );
      const compiled = toVegaLiteSpec(spec);
      // Scope-blind: the compiled half alone SEES independence here...
      expect(compiledIndependentPositionalScales(compiled), relative).toContain('y');
      // ...and the scope half is what rejects it (neither fixture is a LayoutLayer).
      expect(layerScopeIndependentPositionalScales(spec), relative).toEqual([]);
    }
    // ...while a real dual axis satisfies BOTH halves.
    const red = layeredSpec({ y: 'independent' });
    expect(compiledIndependentPositionalScales(toVegaLiteSpec(red))).toContain('y');
    expect(layerScopeIndependentPositionalScales(red)).toEqual(['y']);
  });

  it('MUTATION GATE: gutting R2 silences exactly its own red', () => {
    expect(evaluate(layeredSpec({ y: 'independent' }), withRuleGutted('dual-axis')).findings).toEqual([]);
  });
});

// ============================================================================
// R3 — area encodes linear (OODS-V152)
// ============================================================================

const AREA_ROWS = [
  { week: '2026-01-05', leadTime: 4 },
  { week: '2026-01-12', leadTime: 9 },
  { week: '2026-01-19', leadTime: 6 },
  { week: '2026-01-26', leadTime: 14 },
];

/** R3's red comes out of the PRODUCTION builder — reachable through Forge's own generation path. */
function builtArea(scale?: 'log'): NormalizedVizSpec {
  return buildVizSpecFromRows({
    rows: AREA_ROWS,
    chartType: 'area',
    encodings: {
      x: { field: 'week' },
      y: { field: 'leadTime', ...(scale ? { scale } : {}) },
    },
    id: 's170:accuracy:area',
    name: 'Lead time by week',
  }).spec;
}

describe('s170 m01 R3 — area encodes linear', () => {
  it('RED (production builder): a log-scaled area fires; the linear twin does not', () => {
    expect(firedRuleIds(builtArea('log'))).toEqual(['area-encodes-linear']);
    expect(firedRuleIds(builtArea())).toEqual([]);
  });

  it('EXCLUSION: a y2-ranged band area stays green even on a log scale', () => {
    const band = assertNormalizedVizSpec({
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 's170:accuracy:band',
      name: 'SLA band',
      data: { values: AREA_ROWS.map((row, i) => ({ ...row, low: 2 + i, high: 20 + i })) },
      marks: [
        {
          trait: 'MarkArea',
          encodings: {
            x: { field: 'week', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'high', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', scale: 'log' },
            y2: { field: 'low', trait: 'EncodingPositionY', channel: 'y2' },
          },
        },
      ],
      encoding: {
        x: { field: 'week', trait: 'EncodingPositionX', channel: 'x' },
        y: { field: 'high', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', scale: 'log' },
        y2: { field: 'low', trait: 'EncodingPositionY', channel: 'y2' },
      },
      a11y: { description: 'A shaded service-level band drawn between a low and a high bound per week.' },
    });
    expect(firedRuleIds(band)).toEqual([]);
    // ...and the exclusion is stated where a reader of the pillar will look for it.
    const rule = ACCURACY_RULES.find((entry) => entry.id === 'area-encodes-linear');
    expect(rule?.summary).toContain('Ranged (x2/y2) areas are EXCLUDED');
  });

  it('the three committed band fixtures are the exclusion guards and stay green', () => {
    for (const relative of [
      'examples/viz/patterns/target-band-line.spec.json',
      'examples/viz/patterns-v2/target-band-line.spec.json',
      'examples/viz/patterns-v2/facet-target-band.spec.json',
    ]) {
      const spec = assertNormalizedVizSpec(
        JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8')),
      );
      expect(firedRuleIds(spec), relative).toEqual([]);
    }
  });

  it('FACET/LAYER axis: the red fires under a faceted and under a layered layout', () => {
    const base = builtArea('log');
    const faceted: NormalizedVizSpec = {
      ...base,
      layout: { trait: 'LayoutFacet', columns: { field: 'week' } },
    };
    const layered: NormalizedVizSpec = {
      ...base,
      layout: { trait: 'LayoutLayer' },
      marks: [
        ...base.marks,
        {
          trait: 'MarkLine',
          encodings: {
            x: { field: 'week', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'leadTime', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative' },
          },
        },
      ] as NormalizedVizSpec['marks'],
    };
    expect(firedRuleIds(assertNormalizedVizSpec(faceted))).toEqual(['area-encodes-linear']);
    expect(firedRuleIds(assertNormalizedVizSpec(layered))).toEqual(['area-encodes-linear']);
  });

  it('R3 does NOT fire on a log-scaled bar and R1 does NOT fire on a log-scaled area', () => {
    // The two rules share a predicate but not a domain; a shared-predicate refactor that lost
    // the mark filter would make both fire on both.
    expect(firedRuleIds(barSpec({ yScale: 'log' }))).toEqual(['non-zero-bar-baseline']);
    expect(firedRuleIds(builtArea('log'))).toEqual(['area-encodes-linear']);
  });

  it('MUTATION GATE: gutting R3 silences exactly its own red', () => {
    expect(evaluate(builtArea('log'), withRuleGutted('area-encodes-linear')).findings).toEqual([]);
  });
});

// ============================================================================
// R4 — aggregation hiding (OODS-V153)
// ============================================================================

/** Two rows per region — the aggregate genuinely MERGES rows. */
const COLLAPSING_ROWS = [
  { region: 'North', quarter: 'Q1', revenue: 60 },
  { region: 'North', quarter: 'Q2', revenue: 60 },
  { region: 'South', quarter: 'Q1', revenue: 70 },
  { region: 'South', quarter: 'Q2', revenue: 65 },
];

/** One row per region — an IDENTITY aggregation, which merges nothing. */
const IDENTITY_ROWS = [
  { region: 'North', quarter: 'Q1', revenue: 120 },
  { region: 'South', quarter: 'Q1', revenue: 135 },
];

function builtAggregateBar(
  rows: ReadonlyArray<Record<string, unknown>>,
  description?: string,
): NormalizedVizSpec {
  return buildVizSpecFromRows({
    rows,
    chartType: 'bar',
    encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } },
    id: 's170:accuracy:agg',
    ...(description !== undefined ? { description } : {}),
  }).spec;
}

// The caller-supplied description that ERASES the builder's synthesized "sum of" disclosure.
const OVERRIDE = 'Revenue by region across the sales territories for the current fiscal period.';

describe('s170 m01 R4 — aggregation hiding', () => {
  it('RED (production builder): a collapsing sum with an overridden description fires', () => {
    const red = builtAggregateBar(COLLAPSING_ROWS, OVERRIDE);
    expect(firedRuleIds(red)).toEqual(['aggregation-hiding']);
    // The leak is real and lives on the generation path: the builder synthesizes the
    // disclosure, and a caller `description` silently replaces it while the compiled axis
    // title stays the bare humanized field name.
    expect(red.a11y.description).toBe(OVERRIDE);
    expect((toVegaLiteSpec(red).encoding as Record<string, { title?: string }>).y.title).toBe('Revenue');
  });

  it('GREEN twin: the same spec with the synthesized disclosure restored is silent', () => {
    const green = builtAggregateBar(COLLAPSING_ROWS);
    expect(green.a11y.description).toContain('sum of');
    expect(firedRuleIds(green)).toEqual([]);
    // One property apart: same rows, same encodings, same aggregate.
    expect(green.encoding).toEqual(builtAggregateBar(COLLAPSING_ROWS, OVERRIDE).encoding);
  });

  it('COLLAPSE is the precondition: an IDENTITY aggregation stays silent even with the override', () => {
    // This is why a title-keyword-only predicate was rejected: it would red every one of the
    // 13 committed aggregate bindings, all of which are identity.
    expect(firedRuleIds(builtAggregateBar(IDENTITY_ROWS, OVERRIDE))).toEqual([]);
  });

  it('DISCLOSURE can come from the chart title or the aggregated axis title, not only the description', () => {
    const viaTitle = buildVizSpecFromRows({
      rows: COLLAPSING_ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } },
      name: 'Total revenue by region',
      description: OVERRIDE,
    }).spec;
    expect(firedRuleIds(viaTitle)).toEqual([]);

    const viaAxisTitle = buildVizSpecFromRows({
      rows: COLLAPSING_ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum', title: 'Sum of revenue' } },
      description: OVERRIDE,
    }).spec;
    expect(firedRuleIds(viaAxisTitle)).toEqual([]);
  });

  it('mean/average aliasing: an "average" aggregate is disclosed by the word "mean"', () => {
    const spec = buildVizSpecFromRows({
      rows: COLLAPSING_ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'average' } },
      description: 'The mean revenue recorded in each sales region over the reporting period.',
    }).spec;
    expect(firedRuleIds(spec)).toEqual([]);
    // ...and without any disclosure the same spec fires, so the pass above is the word's doing.
    expect(firedRuleIds(builtAggregateBar(COLLAPSING_ROWS, OVERRIDE))).toEqual(['aggregation-hiding']);
  });

  it('word-boundary matching: "administration" does not disclose min, "minimum" does', () => {
    const withAggregate = (description: string, aggregate: 'min') =>
      buildVizSpecFromRows({
        rows: COLLAPSING_ROWS,
        chartType: 'bar',
        encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate } },
        description,
      }).spec;
    expect(
      firedRuleIds(withAggregate('Revenue by region under the current administration and its policy.', 'min')),
    ).toEqual(['aggregation-hiding']);
    expect(
      firedRuleIds(withAggregate('The minimum revenue recorded in each region across the period.', 'min')),
    ).toEqual([]);
  });

  it('the TRANSFORM spelling of an aggregation is read too', () => {
    const transformRed = assertNormalizedVizSpec({
      ...builtAggregateBar(COLLAPSING_ROWS, OVERRIDE),
      // Drop the binding aggregate; declare it as a transform instead.
      encoding: {
        x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', title: 'Region' },
        y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', title: 'Revenue' },
      },
      marks: [{ trait: 'MarkBar' }],
      transforms: [
        { type: 'aggregate', params: { aggregate: [{ op: 'sum', field: 'revenue', as: 'revenue' }], groupby: ['region'] } },
      ],
    });
    expect(declaredAggregations(transformRed)).toHaveLength(1);
    expect(firedRuleIds(transformRed)).toEqual(['aggregation-hiding']);
  });

  it('an op OUTSIDE the IR vocabulary is fail-safe SILENT and says so in a note', () => {
    const spec = assertNormalizedVizSpec({
      ...builtAggregateBar(COLLAPSING_ROWS, OVERRIDE),
      encoding: {
        x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', title: 'Region' },
        y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', title: 'Revenue' },
      },
      marks: [{ trait: 'MarkBar' }],
      transforms: [
        { type: 'aggregate', params: { aggregate: [{ op: 'variance', field: 'revenue' }], groupby: ['region'] } },
      ],
    });
    const result = evaluate(spec);
    expect(result.findings).toEqual([]);
    expect(result.rulesEvaluated).toBe(3);
    expect(result.notes.join(' ')).toContain("'variance'");
  });

  // s239: a data url is now refused by assertNormalizedVizSpec (renderers must never fetch it),
  // so an IR without inline rows is a named data reference.
  it('data without inline rows leaves the collapse half unevaluable — silent, counted out, and noted', () => {
    const spec = assertNormalizedVizSpec({
      ...builtAggregateBar(COLLAPSING_ROWS, OVERRIDE),
      data: { name: 'revenue' },
    });
    const result = evaluate(spec);
    expect(result.findings).toEqual([]);
    expect(result.rulesEvaluated).toBe(3);
    expect(result.notes.join(' ')).toContain('carries no rows');
  });

  it('FACET/LAYER axis: the group key includes facet fields, so a per-facet identity stays silent', () => {
    // 8 rows; (region × quarter) is identity, and quarter is the FACET field. The full key
    // therefore yields 8 groups of 1 — no collapse — while dropping the facet field yields
    // 2 groups of 4, which is the facet-blind mutant checked below.
    const rows = [
      { region: 'North', quarter: 'Q1', revenue: 60 },
      { region: 'South', quarter: 'Q1', revenue: 70 },
      { region: 'East', quarter: 'Q1', revenue: 50 },
      { region: 'West', quarter: 'Q1', revenue: 80 },
      { region: 'North', quarter: 'Q2', revenue: 66 },
      { region: 'South', quarter: 'Q2', revenue: 75 },
      { region: 'East', quarter: 'Q2', revenue: 55 },
      { region: 'West', quarter: 'Q2', revenue: 85 },
    ];
    const faceted = assertNormalizedVizSpec({
      ...builtAggregateBar(rows, OVERRIDE),
      layout: { trait: 'LayoutFacet', columns: { field: 'quarter' } },
    });
    expect(firedRuleIds(faceted)).toEqual([]);

    // ...and a layered variant of the collapsing red still fires.
    const layered = assertNormalizedVizSpec({
      ...builtAggregateBar(COLLAPSING_ROWS, OVERRIDE),
      layout: { trait: 'LayoutLayer', sharedScales: { x: 'shared', y: 'shared' } },
    });
    expect(firedRuleIds(layered)).toEqual(['aggregation-hiding']);
  });

  it('DISCRIMINATING CHECK: a facet-blind group key INVENTS a collapse the full key does not see', () => {
    // Built from the REAL predicates — drop the facet fields from the real key list and re-run
    // the real collapse test — so the mutant can never drift from what ships.
    //
    // Committed evidence first: facet-layout.spec.json facets on region × segment with x=metric
    // and a declared sum. Under the full key that is 8 groups of 1; drop the facet fields and it
    // becomes 2 groups of 4 — a collapse the data does not contain.
    const spec = assertNormalizedVizSpec(
      JSON.parse(readFileSync(path.join(REPO_ROOT, 'examples/viz/facet-layout.spec.json'), 'utf8')),
    );
    const [aggregation] = declaredAggregations(spec);
    const fields = collapseGroupKeyFields(spec, aggregation);
    const [rows] = carriedRowSets(spec);

    expect(fields).toEqual(expect.arrayContaining(['region', 'segment']));
    expect(anyGroupCollapses(rows, fields)).toBe(false); // 8 groups of 1
    const facetBlind = fields.filter((field) => field !== 'region' && field !== 'segment');
    expect(anyGroupCollapses(rows, facetBlind)).toBe(true); // 2 groups of 4
    expect(firedRuleIds(spec)).toEqual([]);
    // Stated so the evidence is not overread: this fixture is silent for TWO independent
    // reasons — the identity key above AND its description, which says "totals". Its facet
    // term is therefore load-bearing for the COLLAPSE predicate, not for the whole rule.
    expect(spec.a11y.description).toContain('totals');
  });

  it('DISCRIMINATING CHECK: a facet-blind key would make a NON-disclosing faceted spec fire', () => {
    // The rule-level half of the check, on a spec whose description discloses nothing — so the
    // facet term in the key is the ONLY thing standing between it and a false accusation.
    const rows = [
      { region: 'North', quarter: 'Q1', revenue: 60 },
      { region: 'South', quarter: 'Q1', revenue: 70 },
      { region: 'North', quarter: 'Q2', revenue: 66 },
      { region: 'South', quarter: 'Q2', revenue: 75 },
    ];
    const spec = assertNormalizedVizSpec({
      ...builtAggregateBar(rows, OVERRIDE),
      layout: { trait: 'LayoutFacet', columns: { field: 'quarter' } },
    });
    const [aggregation] = declaredAggregations(spec);
    const fields = collapseGroupKeyFields(spec, aggregation);
    const [carried] = carriedRowSets(spec);

    expect(fields).toContain('quarter');
    expect(anyGroupCollapses(carried, fields)).toBe(false); // 4 groups of 1 — silent
    expect(anyGroupCollapses(carried, fields.filter((field) => field !== 'quarter'))).toBe(true);
    expect(firedRuleIds(spec)).toEqual([]);
    // No disclosure anywhere: a facet-blind key has nothing else to stop it.
    expect(spec.a11y.description).toBe(OVERRIDE);
    expect(firedRuleIds(builtAggregateBar(rows.slice(0, 2).concat(rows.slice(2)), OVERRIDE))).toEqual([
      'aggregation-hiding',
    ]);
  });

  it('MUTATION GATE: gutting R4 silences exactly its own red', () => {
    const red = builtAggregateBar(COLLAPSING_ROWS, OVERRIDE);
    expect(evaluate(red, withRuleGutted('aggregation-hiding')).findings).toEqual([]);
  });
});

// ============================================================================
// Engine-level properties
// ============================================================================

describe('s170 m01 — the engine', () => {
  it('exposes exactly four rules with unique ids and unique registered codes', () => {
    expect(ACCURACY_RULES).toHaveLength(4);
    expect(ACCURACY_RULES.map((rule) => rule.id)).toEqual([
      'non-zero-bar-baseline',
      'dual-axis',
      'area-encodes-linear',
      'aggregation-hiding',
    ]);
    expect(new Set(ACCURACY_RULES.map((rule) => rule.code)).size).toBe(4);
    for (const rule of ACCURACY_RULES) {
      expect(rule.code).toMatch(/^OODS-V1\d\d$/);
      expect(rule.summary.length).toBeGreaterThan(40);
    }
  });

  it('the PUBLIC surface is the engine only — the internals and the borrowed keyFor stay off the barrel', () => {
    // The two discriminating checks above import module internals by relative path; that must
    // not turn them into owned public API. `keyFor` is borrowed from data-analysis by module
    // export for the same reason (re-typing it is the s159 defect) and is likewise not a public
    // contract — the same treatment drawnCellKeyFields already has.
    const surface = VizCorePublic as Record<string, unknown>;
    expect(typeof surface.evaluateAccuracyRules).toBe('function');
    expect(Array.isArray(surface.ACCURACY_RULES)).toBe(true);
    for (const name of [
      'keyFor',
      'compiledUnitViews',
      'valueAxisChannels',
      'nonLinearZeroCauses',
      'compiledIndependentPositionalScales',
      'layerScopeIndependentPositionalScales',
      'declaredAggregations',
      'collapseGroupKeyFields',
      'carriedRowSets',
      'anyGroupCollapses',
      'disclosureSurfaces',
    ]) {
      expect(surface[name], `${name} must not be a public export`).toBeUndefined();
    }
  });

  it('rulesEvaluated counts the rules that RESOLVED their operand, not the rules offered', () => {
    const clean = evaluate(barSpec({}));
    expect(clean.rulesEvaluated).toBe(4);
    // s176 m03b (declared movement — was toEqual([])): barSpec({}) declares no
    // aggregation, so the aggregation-hiding pass now says its subjectlessness out loud.
    // The verdict channel is untouched: zero findings, rulesEvaluated still 4.
    expect(clean.findings).toEqual([]);
    expect(clean.notes).toEqual([NO_DECLARED_AGGREGATION_NOTE]);

    // No compiled spec at all: the three compiled-scale rules cannot run and say so; R4 still
    // resolves (this spec declares no aggregation), so silence here is a real answer —
    // and (s176 m03b, declared movement — was toHaveLength(1)) R4's no-subject pass adds
    // its own note beside the three unresolved-operand notes' dedupe survivor.
    const unresolvable = evaluateAccuracyRules(barSpec({ options: { baseline: 'min' } }), undefined);
    expect(unresolvable.findings).toEqual([]);
    expect(unresolvable.rulesEvaluated).toBe(1);
    expect(unresolvable.notes).toHaveLength(2);
    expect(unresolvable.notes).toContain(NO_DECLARED_AGGREGATION_NOTE);
  });

  it('s176 m03b invariant: the no-subject note NEVER appears when an aggregation is declared, and verdicts are byte-unmoved', () => {
    // A declared-aggregation spec (the honest disclosure pass): no no-subject note.
    const declared = evaluate(builtAggregateBar(COLLAPSING_ROWS));
    expect(declared.notes).not.toContain(NO_DECLARED_AGGREGATION_NOTE);
    // The strict invariant's rule-level half: only notes[] moved on zero-declared specs —
    // findings (the verdict channel) and rulesEvaluated are identical to the pre-s176
    // values asserted above (0 findings / 4 evaluated).
  });

  it('is PURE: it mutates neither the IR nor the compiled spec, and is deterministic', () => {
    const spec = builtAggregateBar(COLLAPSING_ROWS, OVERRIDE);
    const compiled = toVegaLiteSpec(spec);
    const specBefore = JSON.stringify(spec);
    const compiledBefore = JSON.stringify(compiled);

    const first = evaluateAccuracyRules(spec, compiled);
    const second = evaluateAccuracyRules(spec, compiled);

    // contentHash is taken over this exact compiled object — a mutation here would move it.
    expect(JSON.stringify(spec)).toBe(specBefore);
    expect(JSON.stringify(compiled)).toBe(compiledBefore);
    expect(second).toEqual(first);
  });

  it('emits at most ONE finding per rule, so failing-rule count equals findings length', () => {
    // A spec that trips R1 and R3 at once, with two offending bars, must still yield one
    // finding per rule (the m02 accuracySummary.failing count depends on this).
    const spec = assertNormalizedVizSpec({
      ...barSpec({ yScale: 'log' }),
      marks: [
        {
          trait: 'MarkBar',
          encodings: {
            x: { field: 'region', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', scale: 'log' },
          },
        },
        {
          trait: 'MarkBar',
          encodings: {
            x: { field: 'region', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', scale: 'sqrt' },
          },
        },
        {
          trait: 'MarkArea',
          encodings: {
            x: { field: 'region', trait: 'EncodingPositionX', channel: 'x' },
            y: { field: 'revenue', trait: 'EncodingPositionY', channel: 'y', type: 'quantitative', scale: 'log' },
          },
        },
      ] as NormalizedVizSpec['marks'],
    });
    const result = evaluate(spec);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'non-zero-bar-baseline',
      'area-encodes-linear',
    ]);
    expect(new Set(result.findings.map((finding) => finding.ruleId)).size).toBe(result.findings.length);
  });
});

// ============================================================================
// The committed corpus: the standing false-positive guard
// ============================================================================

describe('s170 m01 — 44-fixture corpus sweep (zero findings)', () => {
  const FIXTURES = globSync(path.join(REPO_ROOT, 'examples/viz/**/*.spec.json')).sort();

  it('the corpus is exactly the 44 mark-bearing committed fixtures (a corpus move cannot hollow this gate)', () => {
    expect(FIXTURES).toHaveLength(44);
  });

  type ValidationEvidence = readonly [path: string, keyword: string, message: string, count?: number];
  type FailSafeExerciser = {
    readonly reason: string;
    readonly errorCount: number;
    readonly evidence: readonly ValidationEvidence[];
  };

  // These five examples are DELIBERATELY retained as artifact.certify fail-safe exercisers.
  // They are not valid NormalizedVizSpec examples: certify rejects them before accuracy rules
  // can run, and this sweep then supplies an absent compiled operand to prove fail-safe silence.
  // Fixing one requires a deliberate fixture-hygiene change to this closed manifest; each entry
  // pins its authored incompatibilities plus the exact assertNormalizedVizSpec evidence count.
  const CERTIFY_FAIL_SAFE_EXERCISERS = {
    'examples/viz/before-after/accessibility-tighten/after.spec.json': {
      reason:
        'missing encoding; mark color scheme; array-valued point events; visual rule missing else; narrative interactions; table headings/summary',
      errorCount: 29,
      evidence: [
        ['/', 'required', "must have required property 'encoding'"],
        ['/marks/0/encodings/color', 'additionalProperties', 'must NOT have additional properties'],
        ['/interactions/0/select/on', 'type', 'must be string', 2],
        ['/interactions/0/rule', 'required', "must have required property 'else'"],
        ['/interactions/1/select/on', 'type', 'must be string', 2],
        ['/a11y/narrative', 'additionalProperties', 'must NOT have additional properties'],
        ['/a11y/tableFallback', 'additionalProperties', 'must NOT have additional properties', 2],
      ],
    },
    'examples/viz/before-after/accessibility-tighten/before.spec.json': {
      reason: 'mark-local color binding uses the unsupported scheme property',
      errorCount: 1,
      evidence: [['/marks/0/encodings/color', 'additionalProperties', 'must NOT have additional properties']],
    },
    'examples/viz/before-after/facet-small-multiples/after.spec.json': {
      reason: 'point selection uses array-valued events; tableFallback uses unsupported headings',
      errorCount: 7,
      evidence: [
        ['/interactions/0/select/on', 'type', 'must be string', 2],
        ['/a11y/tableFallback', 'additionalProperties', 'must NOT have additional properties'],
      ],
    },
    'examples/viz/before-after/renderer-density-upgrade/after.spec.json': {
      reason:
        'missing encoding; top-level meta; array-valued point events; config.renderer; portability.rendererJustification',
      errorCount: 16,
      evidence: [
        ['/', 'required', "must have required property 'encoding'"],
        ['/', 'additionalProperties', 'must NOT have additional properties'],
        ['/interactions/0/select/on', 'type', 'must be string', 2],
        ['/interactions/1/select/on', 'type', 'must be string', 2],
        ['/config', 'additionalProperties', 'must NOT have additional properties'],
        ['/portability', 'additionalProperties', 'must NOT have additional properties'],
      ],
    },
    'examples/viz/before-after/renderer-density-upgrade/before.spec.json': {
      reason: 'missing encoding; top-level meta; array-valued point events; filter rule carries unsupported target',
      errorCount: 26,
      evidence: [
        ['/', 'required', "must have required property 'encoding'"],
        ['/', 'additionalProperties', 'must NOT have additional properties'],
        ['/interactions/0/select/on', 'type', 'must be string', 2],
        ['/interactions/1/select/on', 'type', 'must be string', 2],
        ['/interactions/2/rule', 'additionalProperties', 'must NOT have additional properties', 4],
      ],
    },
  } as const satisfies Record<string, FailSafeExerciser>;

  it('exactly the 5 deliberate certify fail-safe exercisers reject, for their pinned reasons', () => {
    const rejected = new Map<string, NormalizedVizSpecError>();
    for (const file of FIXTURES) {
      const name = path.relative(REPO_ROOT, file);
      try {
        assertNormalizedVizSpec(JSON.parse(readFileSync(file, 'utf8')));
      } catch (error) {
        expect(error, `${name} must reject through NormalizedVizSpec validation`).toBeInstanceOf(
          NormalizedVizSpecError,
        );
        rejected.set(name, error as NormalizedVizSpecError);
      }
    }

    const expectedNames = Object.keys(CERTIFY_FAIL_SAFE_EXERCISERS).sort();
    expect([...rejected.keys()].sort()).toEqual(expectedNames);
    for (const name of expectedNames) {
      const expected = CERTIFY_FAIL_SAFE_EXERCISERS[name as keyof typeof CERTIFY_FAIL_SAFE_EXERCISERS];
      const errors = rejected.get(name)!.errors;
      expect(errors, `${name}: ${expected.reason}`).toHaveLength(expected.errorCount);
      for (const [errorPath, keyword, message, count = 1] of expected.evidence) {
        const matches = errors.filter(
          (error) => error.path === errorPath && error.keyword === keyword && error.message === message,
        );
        expect(matches, `${name}: ${expected.reason}`).toHaveLength(count);
      }
    }
  });

  for (const file of FIXTURES) {
    const name = path.relative(REPO_ROOT, file);
    it(`${name}: evaluates to zero accuracy findings`, () => {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as NormalizedVizSpec;
      const isFailSafeExerciser = Object.prototype.hasOwnProperty.call(
        CERTIFY_FAIL_SAFE_EXERCISERS,
        name,
      );
      let compiled: unknown;
      if (isFailSafeExerciser) {
        const expected =
          CERTIFY_FAIL_SAFE_EXERCISERS[name as keyof typeof CERTIFY_FAIL_SAFE_EXERCISERS];
        expect(
          () => assertNormalizedVizSpec(raw),
          `${name} remains a deliberate fail-safe exerciser: ${expected.reason}`,
        ).toThrow(NormalizedVizSpecError);
        compiled = undefined;
      } else {
        compiled = toVegaLiteSpec(assertNormalizedVizSpec(raw));
      }
      const result = evaluateAccuracyRules(raw, compiled);
      expect(result.findings).toEqual([]);
      expect(result.rulesEvaluated).toBe(isFailSafeExerciser ? 1 : 4);
    });
  }
});
