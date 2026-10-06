import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildFromIntent,
  buildVizSpecFromRows,
  validateVizEquivalenceRules,
  type StructuredIntent,
} from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import type { VizRenderInput } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/viz.render.js';

// Builder-path coverage for the a11y equivalence engine + the sprint-135 GATE.
//
// Sprint-134 proved "accessible by construction" was FALSE: A11Y-R-05 (error, axis titles) and
// A11Y-R-14 (warn, column order) fired on ~100% of default cartesian emissions because the builder
// synthesized neither. Sprint-135 m02 made the BUILDER conformant-BY-CONSTRUCTION (it synthesizes
// axis titles, a >=25-char description, an aria-label, and a deterministic column order), and m04
// flips the a11yEquivalence check from soft-warn to a BLOCKING gate (default-ON): error-severity
// failures BLOCK (status:'error', per-rule OODS-<rule.id> codes, no contentHash), warn-severity
// failures ride warnings[], and a11yEquivalence:false opts out byte-identically (#564).
//
// This file INVERTS the s134 "R-05/R-14 FIRE" regressions to "R-05/R-14 PASS". Because the builder
// now synthesizes those fields, R-05/R-08/R-09/R-14 can NEVER fire on viz.render output — the gate
// is exercised through the error rules the builder cannot fix (here R-12: an encoding field absent
// from the data) and stands as a regression lock for the builder-synthesized ones.

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/viz.render.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

const render = (input: Record<string, unknown>) => handle(input as unknown as VizRenderInput);

// A 3-FIELD dataset → the accessible table has 3 columns, so R-14 (>2-col column-order) applies.
const ROWS3 = [
  { region: 'North', quarter: 'Q1', revenue: 100 },
  { region: 'South', quarter: 'Q1', revenue: 120 },
  { region: 'East', quarter: 'Q1', revenue: 90 },
];
const CARTESIAN_ENCODINGS = { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' as const } };
// A y encoding whose field is ABSENT from every row → A11Y-R-12 (error). Since the builder
// synthesizes titles/description/aria-label/column-order, this is the reachable way to trip the
// gate through viz.render (the builder cannot invent data for a missing field).
const MISSING_FIELD_ENCODINGS = { x: { field: 'region' }, y: { field: 'nonexistent' } };
// A heatmap: two dimensions crossed by a quantitative COLOR measure. Since s149 F6d it
// reads the COLOR channel as the measure (was: the Y-dimension), so it now SURFACES key
// findings and PASSES A11Y-R-11 — it no longer warns on itself (the F6d regression guard).
const HEATMAP_ROWS = [
  { row: 'r1', col: 'c1', val: 5 }, { row: 'r2', col: 'c2', val: 8 },
  { row: 'r1', col: 'c2', val: 3 }, { row: 'r2', col: 'c1', val: 6 },
];
const HEATMAP_ENCODINGS = { x: { field: 'row' }, y: { field: 'col' }, color: { field: 'val' } };
// A bar whose measure field is present in every row but NON-NUMERIC → the analysis finds no
// numeric insights → A11Y-R-11 (warn, <2 key findings) with every ERROR rule still passing.
// The warn-never-blocks fixture (a genuine data-quality warn, replacing the s149-F6d-fixed
// heatmap self-warn).
const WARN_TRIP_ROWS = [
  { region: 'North', grade: 'low' }, { region: 'South', grade: 'mid' }, { region: 'East', grade: 'high' },
];
const WARN_TRIP_ENCODINGS = { x: { field: 'region' }, y: { field: 'grade' } };

// The error-severity rule ids — the set the gate enforces. Default builder output must pass ALL.
const ERROR_RULE_IDS = [
  'A11Y-R-01', 'A11Y-R-02', 'A11Y-R-03', 'A11Y-R-04', 'A11Y-R-05',
  'A11Y-R-06', 'A11Y-R-08', 'A11Y-R-09', 'A11Y-R-10', 'A11Y-R-12', 'A11Y-R-15',
];

describe('a11y equivalence engine over BUILDER-produced specs (conformant by construction, m02)', () => {
  it('A11Y-R-05 PASSES on a default cartesian bar — the builder now synthesizes axis titles (was FALSE pre-s135)', () => {
    const built = buildVizSpecFromRows({ rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    const r05 = validateVizEquivalenceRules(built.spec).find((r) => r.id === 'A11Y-R-05');
    expect(r05?.passed).toBe(true); // the claim is now TRUE by construction — the inverted regression
    expect(built.spec.encoding.x?.title).toBeTruthy();
    expect(built.spec.encoding.y?.title).toBeTruthy();
  });

  it('A11Y-R-05 PASSES on a buildFromIntent emission too (same builder, intent path)', () => {
    const intent: StructuredIntent = { goal: 'comparison', measures: [{ name: 'revenue' }], dimensions: [{ name: 'region' }] };
    const built = buildFromIntent({ intent, rows: ROWS3 });
    expect(validateVizEquivalenceRules(built.spec).find((r) => r.id === 'A11Y-R-05')?.passed).toBe(true);
  });

  it('A11Y-R-14 PASSES on a >2-column table — the builder now sets portability.tableColumnOrder', () => {
    const built = buildVizSpecFromRows({ rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    expect(validateVizEquivalenceRules(built.spec).find((r) => r.id === 'A11Y-R-14')?.passed).toBe(true);
    // Encoding channels first ([x,y,...]), then remaining first-row keys in encounter order.
    expect(built.spec.portability?.tableColumnOrder).toEqual(['region', 'revenue', 'quarter']);
  });

  it('default builder output PASSES every error-severity rule (the gate green target, by construction)', () => {
    const built = buildVizSpecFromRows({ rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    const results = validateVizEquivalenceRules(built.spec);
    // Returned-code metadata may include dashboard omission, but evaluator gates stay unchanged.
    expect(results.filter(rule => rule.severity === 'error')).toHaveLength(11);
    expect(results.filter(rule => rule.severity === 'warn')).toHaveLength(5);
    const failedError = results.filter((r) => !r.passed && r.severity === 'error');
    expect(failedError, `raw builder output tripped: ${failedError.map((r) => r.id).join(', ')}`).toEqual([]);
    for (const id of ERROR_RULE_IDS) {
      expect(results.find((r) => r.id === id)?.passed, `${id} not passing on default builder output`).toBe(true);
    }
  });
});

describe('viz.render a11yEquivalence GATE (default-ON, m04)', () => {
  it('default-ON: a conformant default emission is status:ok with NO a11y errors and a contentHash', async () => {
    const out = await render({ rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    expect(out.status).toBe('ok');
    expect(out.errors).toBeUndefined();
    expect(out.warnings.filter((w) => w.code.startsWith('OODS-A11Y-')).every((w) => w.severity === 'warning')).toBe(true);
    expect((out as Record<string, unknown>).contentHash).toBeTypeOf('string');
    expect(validateOutput(out)).toBe(true);
  });

  it('an error-severity failure BLOCKS: status:error, per-rule OODS-A11Y code in errors[], contentHash OMITTED', async () => {
    const out = await render({ rows: ROWS3, chartType: 'bar', encodings: MISSING_FIELD_ENCODINGS });
    expect(out.status).toBe('error');
    // Per-rule code preserved — NOT collapsed to OODS-V129 (which a thrown assertVizEquivalence would produce).
    expect((out.errors ?? []).map((e) => e.code)).toContain('OODS-A11Y-R-12');
    expect(out.errors?.every((e) => e.severity === 'error')).toBe(true);
    // Warn-severity a11y findings still ride warnings[] with severity preserved.
    expect(out.warnings.every((w) => w.severity === 'warning')).toBe(true);
    expect((out as Record<string, unknown>).contentHash).toBeUndefined();
    expect(validateOutput(out)).toBe(true);
  });

  it('a11yEquivalence:false OPTS OUT — the same non-conformant spec renders (status:ok, contentHash present)', async () => {
    const out = await render({ rows: ROWS3, chartType: 'bar', encodings: MISSING_FIELD_ENCODINGS, a11yEquivalence: false });
    expect(out.status).toBe('ok');
    expect(out.errors).toBeUndefined();
    expect((out as Record<string, unknown>).contentHash).toBeTypeOf('string');
  });

  it('flag OFF is byte-identical to flag ON for a CONFORMANT spec (#564 opt-out floor)', async () => {
    const base = { rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS };
    const off = await render({ ...base, a11yEquivalence: false });
    const on = await render({ ...base, a11yEquivalence: true });
    expect(JSON.stringify(on.spec)).toBe(JSON.stringify(off.spec));
    expect((on as Record<string, unknown>).contentHash).toBe((off as Record<string, unknown>).contentHash);
    expect(off.warnings).toEqual(on.warnings);
  });

  it('warn-severity rules NEVER block — a spec tripping A11Y-R-11 stays status:ok with a warning', async () => {
    const out = await render({ rows: WARN_TRIP_ROWS, chartType: 'bar', encodings: WARN_TRIP_ENCODINGS });
    expect(out.status).toBe('ok');
    expect(out.errors).toBeUndefined();
    const a11yWarnings = out.warnings.filter((w) => w.code.startsWith('OODS-A11Y-'));
    expect(a11yWarnings.some((w) => w.code === 'OODS-A11Y-R-11')).toBe(true);
    expect(a11yWarnings.every((w) => w.severity === 'warning')).toBe(true);
  });

  it('s149 F6d: a heatmap PASSES A11Y-R-11 — it reads COLOR as the measure and no longer warns on itself', async () => {
    // Pre-F6d resolvePrimaryBindings analyzed the Y-dimension as the measure → zero key
    // findings → the heatmap tripped its OWN A11Y-R-11 warn. Reading the COLOR channel as
    // the measure surfaces maxima/minima, so the default heatmap is now clean.
    const out = await render({ rows: HEATMAP_ROWS, chartType: 'heatmap', encodings: HEATMAP_ENCODINGS });
    expect(out.status).toBe('ok');
    const a11yWarnings = out.warnings.filter((w) => w.code.startsWith('OODS-A11Y-'));
    expect(a11yWarnings.some((w) => w.code === 'OODS-A11Y-R-11')).toBe(false);
  });

  it('ECharts-primary path is NOT gated even with the flag ON (the RENDER-SIDE GATE is cartesian-only; certify evaluates the rules warn-first with the operand)', async () => {
    const out = await render({
      chartType: 'treemap',
      hierarchy: {
        type: 'adjacency_list',
        data: [
          { id: 'root', parentId: null, value: 0 },
          { id: 'a', parentId: 'root', value: 30 },
          { id: 'b', parentId: 'root', value: 70 },
        ],
      },
      a11yEquivalence: true,
    });
    expect(out.status).toBe('ok');
    expect(out.warnings.filter((w) => w.code.startsWith('OODS-A11Y-'))).toEqual([]);
    expect(out.errors).toBeUndefined();
  });
});

describe('viz.render contentHash (determinism identity, m02)', () => {
  it('same input → identical contentHash', async () => {
    const input = { rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS };
    const a = await render(input);
    const b = await render(input);
    expect((a as Record<string, unknown>).contentHash).toBeTypeOf('string');
    expect((a as Record<string, unknown>).contentHash).toBe((b as Record<string, unknown>).contentHash);
  });

  it('a one-field payload mutation → different contentHash', async () => {
    const a = await render({ rows: ROWS3, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    const mutated = [{ ...ROWS3[0], revenue: 999 }, ...ROWS3.slice(1)];
    const b = await render({ rows: mutated, chartType: 'bar', encodings: CARTESIAN_ENCODINGS });
    expect((a as Record<string, unknown>).contentHash).not.toBe((b as Record<string, unknown>).contentHash);
  });

  it('the BUILD-error path OMITS contentHash, keeps warnings:[], and still passes the output AJV schema', async () => {
    // An empty encoding field throws VizSpecBuilderError → errorOut (cartesian catch) → OODS-V126.
    const out = await render({ rows: ROWS3, chartType: 'bar', encodings: { x: { field: '' }, y: { field: 'revenue' } } });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V126');
    expect((out as Record<string, unknown>).contentHash).toBeUndefined(); // optional, omitted on error
    expect(out.warnings).toEqual([]);
    expect(validateOutput(out)).toBe(true); // top-level additionalProperties:false → optional-not-required holds
  });
});
