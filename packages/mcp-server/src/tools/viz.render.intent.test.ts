// viz.render structured-intent goldens + acceptance fixtures (sprint-131 m04).
//
// Locks the deterministic NL→viz CORE shipped in m02 (buildFromIntent) + m03 (the
// viz.render `intent` surface + the governed-measure narrative overlay):
//   - BOTH-direction determinism (Amendment F): intent-PRESENT same-input
//     byte-identical AND intent-ABSENT byte-identical (the #564 additive floor).
//   - GOVERNED-measure acceptance ('vs target 300' / 'unit 1000 USD'), includeA11y-gated.
//   - RAW-field graceful degradation (no governed clause when no measureRef).
//   - NEGATIVE fixtures: explicit-only chartFamily AJV-rejected; named field absent →
//     fail-loud (V126); unknown measureRef → V130.
//
// The ACCEPTANCE_CASES table doubles as the s132 nvBench-style NL→viz eval SKELETON:
// each case carries the natural-language `utterance` the s132 parser must map to the
// `intent` object, the expected recommender chartType, and the expected governed
// narrative clause. s132 plugs the utterance→intent parser ABOVE this exact contract.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import type { VizRenderInput } from '../schemas/generated.js';
import { handle } from './viz.render.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../schemas/viz.render.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const inputSchema = JSON.parse(
  readFileSync(new URL('../schemas/viz.render.input.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);
const validateInput = getAjv().compile(inputSchema);

const render = (input: Record<string, unknown>) => handle(input as unknown as VizRenderInput);

// --- fixtures ----------------------------------------------------------------
// revenue+month → the governed gm.revenue.total (target 300, threshold 350) lives here.
const REVENUE_BY_MONTH = [
  { month: '2024-01', revenue: 380 },
  { month: '2024-02', revenue: 410 },
  { month: '2024-03', revenue: 395 },
  { month: '2024-04', revenue: 420 },
];
// export value+month → the unit-bearing gm.export.value.total (unit '1000 USD').
const EXPORT_BY_MONTH = [
  { month: '2024-01', value: 1200 },
  { month: '2024-02', value: 1350 },
  { month: '2024-03', value: 1280 },
];
// sales+region → a raw-field comparison with NO governed measure.
const SALES_BY_REGION = [
  { region: 'North', sales: 120 },
  { region: 'South', sales: 135 },
  { region: 'East', sales: 128 },
  { region: 'West', sales: 142 },
];

// Strip the per-call specRef trio (ref id + timestamps are not content-deterministic)
// before a byte-identical comparison — mirrors test/scale/dashboard-determinism.spec.ts.
function payload(out: Awaited<ReturnType<typeof render>>): string {
  const { specRef: _r, specRefCreatedAt: _c, specRefExpiresAt: _e, ...rest } = out;
  return JSON.stringify(rest);
}

// =============================================================================
// Determinism — BOTH directions (Amendment F)
// =============================================================================
describe('viz.render intent determinism (both directions — #564 additive floor)', () => {
  const INTENT_CALL = {
    intent: {
      goal: 'trend',
      measures: [{ name: 'revenue' }],
      dimensions: [{ name: 'month' }],
      chartFamily: 'line',
      measureRef: 'gm.revenue.total',
    },
    rows: REVENUE_BY_MONTH,
    output: { includeA11y: true },
  };

  it('intent-PRESENT: identical {intent, rows} → byte-identical output', async () => {
    const a = payload(await render(INTENT_CALL));
    const b = payload(await render(INTENT_CALL));
    expect(a).toBe(b);
  });

  it('intent-ABSENT: a plain suggest-mode call is byte-identical across runs (the default path is untouched)', async () => {
    const NO_INTENT = { rows: REVENUE_BY_MONTH, output: { includeA11y: true } };
    const a = payload(await render(NO_INTENT));
    const b = payload(await render(NO_INTENT));
    expect(a).toBe(b);
    // The intent feature is additive: an intent-absent call still reports the existing
    // recommender 'suggest' mode and carries no intent/measure-narrative artifact.
    const out = await render(NO_INTENT);
    expect(out.mode).toBe('suggest');
    expect(JSON.stringify(out)).not.toContain('vs target');
  });

  it('the intent path reports the existing "suggest" wire mode (zero output-schema change)', async () => {
    const out = await render(INTENT_CALL);
    expect(out.status).toBe('ok');
    expect(out.mode).toBe('suggest');
    expect(validateOutput(out)).toBe(true);
  });
});

// =============================================================================
// Governed-measure acceptance — the narrative overlay, includeA11y-gated
// =============================================================================
describe('viz.render intent governed-measure narrative (sprint-129/130 overlay on the intent path)', () => {
  const GOVERNED = {
    intent: {
      goal: 'trend',
      measures: [{ name: 'revenue' }],
      dimensions: [{ name: 'month' }],
      chartFamily: 'line',
      measureRef: 'gm.revenue.total',
    },
    rows: REVENUE_BY_MONTH,
  };

  it('lights the "vs target 300" clause under includeA11y (gm.revenue.total: target 300)', async () => {
    const out = await render({ ...GOVERNED, output: { includeA11y: true } });
    expect(out.status).toBe('ok');
    expect(out.chartType).toBe('line');
    const findings = out.a11y?.narrative?.keyFindings ?? [];
    expect(findings[0]).toContain('vs target 300');
    expect(findings[0]).toContain('threshold 350');
    expect(validateOutput(out)).toBe(true);
  });

  it('PAIR: the SAME call WITHOUT includeA11y omits the governed clause (gated)', async () => {
    const out = await render(GOVERNED);
    expect(out.status).toBe('ok');
    expect(out.a11y).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('vs target 300');
  });

  it('a unit-bearing measure surfaces "unit 1000 USD" under includeA11y (gm.export.value.total)', async () => {
    const out = await render({
      intent: {
        goal: 'trend',
        measures: [{ name: 'value' }],
        dimensions: [{ name: 'month' }],
        chartFamily: 'line',
        measureRef: 'gm.export.value.total',
      },
      rows: EXPORT_BY_MONTH,
      output: { includeA11y: true },
    });
    expect(out.status).toBe('ok');
    const findings = out.a11y?.narrative?.keyFindings ?? [];
    expect(findings[0]).toContain('unit 1000 USD');
    // gm.export.value.total carries NO defaultComparison/defaultThreshold — no target clause.
    expect(findings[0]).not.toContain('vs target');
  });
});

// =============================================================================
// Raw-field acceptance — graceful degradation (no governed measure)
// =============================================================================
describe('viz.render intent raw-field path (no measureRef)', () => {
  it('returns a real data-bound spec with the recommender pick + rationale, and NO governed clause', async () => {
    const out = await render({
      intent: { goal: 'comparison', measures: [{ name: 'sales' }], dimensions: [{ name: 'region' }], chartFamily: 'bar' },
      rows: SALES_BY_REGION,
      output: { includeA11y: true },
    });
    expect(out.status).toBe('ok');
    expect(out.chartType).toBe('bar');
    expect(out.spec).toBeTruthy();
    // the recommender pick is surfaced through the existing suggestion channel
    expect(out.suggestion?.patternId).toBeTruthy();
    expect(Array.isArray(out.suggestion?.rationale)).toBe(true);
    // a11y is present (includeA11y) but carries NO governed-measure clause
    expect(out.a11y?.narrative).toBeTruthy();
    expect(JSON.stringify(out.a11y)).not.toContain('vs target');
    expect(JSON.stringify(out.a11y)).not.toContain('unit ');
    expect(validateOutput(out)).toBe(true);
  });

  it('POST-FILTERS by chartFamily at the wire level (honours the requested family)', async () => {
    const base = { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }] };
    const bar = await render({ intent: { ...base, chartFamily: 'bar' }, rows: REVENUE_BY_MONTH });
    const area = await render({ intent: { ...base, chartFamily: 'area' }, rows: REVENUE_BY_MONTH });
    expect(bar.chartType).toBe('bar');
    expect(area.chartType).toBe('area');
  });
});

// =============================================================================
// Negative fixtures — the deterministic tool VALIDATES the intent (fail-loud)
// =============================================================================
describe('viz.render intent negative fixtures', () => {
  it('AJV-rejects an explicit-only chartFamily at the boundary (Amendment E — 5-mark enum)', () => {
    const ok = validateInput({
      intent: { goal: 'part-to-whole', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }], chartFamily: 'treemap' },
      rows: REVENUE_BY_MONTH,
    });
    expect(ok).toBe(false);
  });

  it('AJV-rejects intent + chartType together is handled by the handler guard (V123)', async () => {
    const out = await render({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }] },
      chartType: 'bar',
      rows: REVENUE_BY_MONTH,
    });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
  });

  it('fails loud (V126) when a named intent field is absent from the rows', async () => {
    const out = await render({
      intent: { goal: 'comparison', measures: [{ name: 'profit' }], dimensions: [{ name: 'region' }] },
      rows: SALES_BY_REGION,
    });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V126');
    expect(out.errors?.[0]?.message).toContain('profit');
  });

  it('hard-errors (V130) on an unknown governed measureRef', async () => {
    const out = await render({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }], measureRef: 'gm.nonexistent' },
      rows: REVENUE_BY_MONTH,
      output: { includeA11y: true },
    });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V130');
  });

  it('hard-errors (V130) on an unknown measureRef EVEN without includeA11y (fail-loud is not a11y-gated)', async () => {
    const out = await render({
      intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }], measureRef: 'gm.nonexistent' },
      rows: REVENUE_BY_MONTH,
    });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V130');
  });
});

// =============================================================================
// s132 nvBench-style NL→viz eval SKELETON
// =============================================================================
// Each case is (utterance → expected structured intent → expected chartType [+ governed
// clause]). TODAY the `intent` is supplied directly (the deterministic core). In s132 a
// free-text parser/LLM will map `utterance` → `intent` ABOVE this tool boundary; this table
// becomes the accuracy gate (parsed-intent.chartType === expectedChartType). The contract
// asserted here is the stable target s132 plugs into — do NOT change it without a hand-off note.
interface AcceptanceCase {
  readonly utterance: string;
  readonly intent: Record<string, unknown>;
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly expectedChartType: string;
  readonly governedClause?: string;
}

const ACCEPTANCE_CASES: ReadonlyArray<AcceptanceCase> = [
  {
    utterance: 'show revenue over time vs our target',
    intent: { goal: 'trend', measures: [{ name: 'revenue' }], dimensions: [{ name: 'month' }], chartFamily: 'line', measureRef: 'gm.revenue.total' },
    rows: REVENUE_BY_MONTH,
    expectedChartType: 'line',
    governedClause: 'vs target 300',
  },
  {
    utterance: 'compare sales across regions',
    intent: { goal: 'comparison', measures: [{ name: 'sales' }], dimensions: [{ name: 'region' }], chartFamily: 'bar' },
    rows: SALES_BY_REGION,
    expectedChartType: 'bar',
  },
  {
    utterance: 'total export value by month',
    intent: { goal: 'trend', measures: [{ name: 'value' }], dimensions: [{ name: 'month' }], chartFamily: 'line', measureRef: 'gm.export.value.total' },
    rows: EXPORT_BY_MONTH,
    expectedChartType: 'line',
    governedClause: 'unit 1000 USD',
  },
];

describe('viz.render intent — s132 NL→viz eval skeleton (utterance → intent → chartType)', () => {
  it.each(ACCEPTANCE_CASES)('case: $utterance', async (testCase) => {
    const out = await render({ intent: testCase.intent, rows: [...testCase.rows], output: { includeA11y: true } });
    expect(out.status).toBe('ok');
    expect(out.chartType).toBe(testCase.expectedChartType);
    if (testCase.governedClause) {
      expect(JSON.stringify(out.a11y)).toContain(testCase.governedClause);
    }
  });
});
