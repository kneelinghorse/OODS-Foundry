import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, buildVizSpecFromRows, generateNarrativeSummary, validateVizEquivalenceRules } from '@oods/viz-core';

// s152 F3 — finish the phantom-row-order-Trend class for BAR + true SCATTER (already closed for
// KPIs/F6b, heatmaps/F6d-s150, strips/s151-m05b). Both emitted a first-row-vs-last-row
// "Trend increasing/decreasing: N%" keyFinding that FLIPS sign on a mere row reversal and, for
// scatter, contradicts the order-invariant correlation in the SAME narrative. The one-line fix
// (data-analysis.ts computeTrend → sequence-mark allowlist bindings.mark==='line'||'area')
// suppresses the trend for every non-sequence mark while PRESERVING the line/area trend.
//
// Per s149/s150/s151 discipline: assert the rendered narrative STRING (not just analysis shape),
// and pin row-reversal INVARIANCE (the defining property of a phantom order-derived finding).

const trendFindings = (n: { keyFindings: string[] }) => n.keyFindings.filter((f) => f.startsWith('Trend '));

// A nominal bar: category axis (browser) + a measure (share). Category order is NOT a sequence,
// so a first→last trend is a phantom that flips on reversal. Total/High/Low stay legitimate.
const SHARE = [
  { browser: 'Chrome', share: 63 },
  { browser: 'Safari', share: 20 },
  { browser: 'Edge', share: 5 },
  { browser: 'Firefox', share: 3 },
];
const barSpec = (rows: typeof SHARE) =>
  buildVizSpecFromRows({
    rows,
    chartType: 'bar',
    encodings: { x: { field: 'browser', scale: 'band' }, y: { field: 'share', scale: 'linear' } },
  } as never).spec;

// A TRUE numeric-numeric scatter (both axes quantitative). Its honest signal is the
// order-invariant correlation; a first→last trend contradicts it (here: r=-0.996 but "increasing").
const CORRELATED = [
  { responseMs: 120, conversion: 40 },
  { responseMs: 100, conversion: 48 },
  { responseMs: 150, conversion: 30 },
  { responseMs: 70, conversion: 62 },
];
const scatterSpec = (rows: typeof CORRELATED) =>
  buildVizSpecFromRows({
    rows,
    chartType: 'scatter',
    encodings: { x: { field: 'responseMs' }, y: { field: 'conversion' } },
  } as never).spec;

// CONTROL: a temporal-x line — a genuine sequence whose trend MUST survive the fix.
const SERIES = [
  { month: '2024-01', users: 100 },
  { month: '2024-02', users: 140 },
  { month: '2024-03', users: 170 },
  { month: '2024-04', users: 180 },
];
const lineSpec = () =>
  buildVizSpecFromRows({
    rows: SERIES,
    chartType: 'line',
    encodings: { x: { field: 'month' }, y: { field: 'users', scale: 'linear' } },
  } as never).spec;

describe('s152 F3 — nominal bar: no phantom trend, High/Low preserved', () => {
  it('emits NO "Trend …" finding (fails at HEAD: "Trend decreasing: -95.2%")', () => {
    const spec = barSpec(SHARE);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFindings(generateNarrativeSummary(spec))).toEqual([]);
  });

  it('KEEPS High/Low; s155 m04 withholds "Total Share" (share is a rate, not provably additive)', () => {
    const n = generateNarrativeSummary(barSpec(SHARE));
    // s155 m04 (CLAIM-ON-POSITIVE-EVIDENCE): "share" is a percentage/rate — summing browser shares
    // is NOT a provably meaningful aggregate, so the "Total Share: 91" claim is withheld (the
    // documented less-rich cost, never a false sum). The additive-measure Total survival (revenue/
    // sales on a bar) is proven in a11y-narrative-honesty-properties-s155. High/Low — order-invariant
    // extrema — are unaffected.
    expect(n.keyFindings.some((f) => f.startsWith('Total '))).toBe(false);
    expect(n.keyFindings.some((f) => f.startsWith('High Share:'))).toBe(true);
    expect(n.keyFindings.some((f) => f.startsWith('Low Share:'))).toBe(true);
  });

  it('is ROW-REVERSAL invariant (the phantom-trend signature is gone)', () => {
    const forward = generateNarrativeSummary(barSpec(SHARE)).keyFindings;
    const reversed = generateNarrativeSummary(barSpec([...SHARE].reverse())).keyFindings;
    // High/Low are order-free; with the phantom trend gone the finding sets match.
    expect([...forward].sort()).toEqual([...reversed].sort());
  });
});

describe('s152 F3 — true scatter: no phantom trend, keeps order-invariant correlation', () => {
  it('emits NO "Trend …" finding but KEEPS "Correlation coefficient:" (fails at HEAD)', () => {
    const spec = scatterSpec(CORRELATED);
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    const n = generateNarrativeSummary(spec);
    expect(trendFindings(n)).toEqual([]);
    expect(n.keyFindings.some((f) => f.startsWith('Correlation coefficient:'))).toBe(true);
  });

  it('correlation is ROW-REVERSAL invariant (was contradicted by a sign-flipping trend at HEAD)', () => {
    const forward = analyzeVizSpec(scatterSpec(CORRELATED)).correlation;
    const reversed = analyzeVizSpec(scatterSpec([...CORRELATED].reverse())).correlation;
    expect(forward).toBeDefined();
    expect(reversed).toBe(forward);
  });
});

describe('s152 F3 — CONTROL: line/area trend is PRESERVED (not over-suppressed)', () => {
  it('a temporal-x line STILL emits "Trend increasing: N%" + the "Overall change" summary', () => {
    const spec = lineSpec();
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    const n = generateNarrativeSummary(spec);
    expect(n.keyFindings.some((f) => /^Trend increasing: /.test(f))).toBe(true);
    expect(n.summary).toMatch(/Overall change of .* across the period/);
  });

  it('the line still PASSES A11Y-R-11 (bar/scatter suppression did not lower the bar)', () => {
    for (const spec of [lineSpec(), barSpec(SHARE), scatterSpec(CORRELATED)]) {
      const r11 = validateVizEquivalenceRules(spec).find((r) => r.id === 'A11Y-R-11');
      expect(r11?.passed).toBe(true);
    }
  });
});
