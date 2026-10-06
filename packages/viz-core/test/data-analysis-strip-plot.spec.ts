import { describe, expect, it } from 'vitest';
import {
  analyzeVizSpec,
  buildVizSpecFromRows,
  generateNarrativeSummary,
  validateVizEquivalenceRules,
} from '@oods/viz-core';

// s151 m05b — MarkPoint strip-plot narrative correctness (Forge-Demos Demo-03 Hero A). A strip
// plot is an EXPLICIT chartType:'scatter' with ONE measure + ONE nominal dimension (SUGGEST mode
// picks a bar over these rows). Three gaps, all the F6b/F6d text-vs-render family never applied
// to `point`, are fixed here and pinned by these colocated tests (per s149/s150: assert the
// rendered narrative STRING, not just the analysis shape).
//
// Hero A: type-scale fingerprints — one font-size measure across a set of named sites.
const TYPE_SCALE = [
  { site: 'Stripe', fontSizePx: 16 },
  { site: 'Linear', fontSizePx: 14 },
  { site: 'Vercel', fontSizePx: 15 },
  { site: 'Notion', fontSizePx: 17 },
];

// A genuine numeric-numeric scatter (both axes quantitative) — the control that must NOT be
// over-suppressed: its trend/correlation stay.
const CORRELATED = [
  { responseMs: 120, conversion: 40 },
  { responseMs: 100, conversion: 48 },
  { responseMs: 150, conversion: 30 },
  { responseMs: 70, conversion: 62 },
];

const stripSpec = (x: string, y: string) =>
  buildVizSpecFromRows({
    rows: TYPE_SCALE,
    chartType: 'scatter',
    encodings: { x: { field: x }, y: { field: y } },
  } as never).spec;

const horizontalStrip = () => stripSpec('fontSizePx', 'site'); // measure on X, category on Y
const verticalStrip = () => stripSpec('site', 'fontSizePx'); // category on X, measure on Y

const scatterSpec = () =>
  buildVizSpecFromRows({
    rows: CORRELATED,
    chartType: 'scatter',
    encodings: { x: { field: 'responseMs' }, y: { field: 'conversion' } },
  } as never).spec;

describe('s151 m05b — GAP 1: horizontal strip binds the QUANTITATIVE axis as the measure', () => {
  it('measure resolves to X (fontSizePx), dimension to Y (site) — not blindly Y (fails at HEAD: measure=site, empty)', () => {
    const analysis = analyzeVizSpec(horizontalStrip());
    expect(analysis.measureField).toBe('fontSizePx');
    expect(analysis.dimensionField).toBe('site');
    // The measure values populate (min/max present) instead of every point dropping.
    expect(analysis.max?.value).toBe(17);
    expect(analysis.min?.value).toBe(14);
  });

  it('LABEL matches the VALUES — measureLabel is "Font Size Px", never "Site" (the s149 F6d divergence class)', () => {
    const n = generateNarrativeSummary(horizontalStrip());
    // The label site + binding site share ONE channel derivation, so the summary names the
    // channel it actually measured. At HEAD the measure emptied and the summary degraded.
    expect(n.summary).toContain('Font Size Px');
    expect(n.summary).not.toMatch(/from .* Site/);
  });

  it('PASSES A11Y-R-11 by producing real findings, not by relaxing the rule (fails at HEAD: self-warn)', () => {
    const spec = horizontalStrip();
    const n = generateNarrativeSummary(spec);
    expect(n.keyFindings.length).toBeGreaterThanOrEqual(2); // High + Low
    const r11 = validateVizEquivalenceRules(spec).find((r) => r.id === 'A11Y-R-11');
    expect(r11?.passed).toBe(true);
  });
});

describe('s151 m05b — GAP 2: no phantom trend / total on a strip plot', () => {
  it('vertical strip emits NO "Trend …" finding (fails at HEAD: "Trend increasing: N%")', () => {
    const spec = verticalStrip();
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    const n = generateNarrativeSummary(spec);
    expect(n.keyFindings.some((f) => f.startsWith('Trend '))).toBe(false);
  });

  it('a strip plot emits NO "Total …" finding — summing positional strip values is meaningless (fails at HEAD)', () => {
    const n = generateNarrativeSummary(verticalStrip());
    expect(n.keyFindings.some((f) => f.startsWith('Total '))).toBe(false);
    const nh = generateNarrativeSummary(horizontalStrip());
    expect(nh.keyFindings.some((f) => f.startsWith('Total '))).toBe(false);
  });
});

describe('s151 m05b — GAP 3: a nominal-dimension strip plot gets a data-derived distribution summary', () => {
  it('emits a spread summary (range + mean), not the static a11y fallback (fails at HEAD: no point summary)', () => {
    const n = generateNarrativeSummary(horizontalStrip());
    expect(n.summary).toMatch(/plots Font Size Px from .* to .*, averaging/);
    // The dimension extremes are named (the sites), so the reader gets the who-is-where.
    expect(n.summary).toContain('(Notion)'); // the 17px max
    expect(n.summary).toContain('(Linear)'); // the 14px min
  });
});

describe('s151 m05b — a TRUE numeric-numeric scatter is NOT over-suppressed', () => {
  it('preserves correlation + a relationship summary (both axes quantitative)', () => {
    const spec = scatterSpec();
    const analysis = analyzeVizSpec(spec);
    expect(analysis.correlation).toBeDefined();
    const n = generateNarrativeSummary(spec);
    expect(n.summary).toMatch(/relationship between/);
    expect(n.keyFindings.some((f) => f.startsWith('Correlation coefficient:'))).toBe(true);
  });

  // s152 F3: the true scatter's phantom TREND is dropped too (the s151-review gap — this test
  // previously asserted correlation-present but NEVER trend-absence). RED at HEAD: the scatter
  // emitted "Trend increasing: 55%" beside the order-invariant "Correlation coefficient: -0.996".
  it('s152 F3: emits NO phantom "Trend …" finding while KEEPING correlation (fails at HEAD)', () => {
    const spec = scatterSpec();
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    const n = generateNarrativeSummary(spec);
    expect(n.keyFindings.some((f) => f.startsWith('Trend '))).toBe(false);
    expect(n.keyFindings.some((f) => f.startsWith('Correlation coefficient:'))).toBe(true);
  });
});
