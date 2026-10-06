import { describe, expect, it } from 'vitest';
import {
  analyzeVizSpec,
  buildVizSpecFromRows,
  generateNarrativeSummary,
  validateVizEquivalenceRules,
} from '@oods/viz-core';

// s149 F6d (fork-C) → s150 corrective — a MarkRect heatmap reads its COLOR channel as the
// measure ONLY when color is a real quantitative measure, via the shared predicate
// heatmapColorIsMeasure. s149's marks-only gate (a) MISLABELED the measure ("Quarter" instead of
// "Revenue" — the two decisions, binding and label, were made independently and diverged), (b)
// re-broke A11Y-R-11 for a numeric-Y heatmap with categorical/absent color (color read as a
// non-numeric measure → empty analysis), and (c) emitted a phantom row-order trend/correlation.
// s150 routes BOTH the binding and label through ONE predicate on ONE spec so they can't diverge,
// falls back to Y (pre-F6d) when color is not a real measure (restoring R-11), and suppresses the
// phantom trend on any MarkRect grid. These assertions are the TEETH the s149 tests lacked.
//
// A 3×4 heatmap: two dimensions (region, quarter) crossed by a quantitative measure (revenue).
// revenue Σ=1,038, max East/Q4=133, min North/Q1=40.
const HEATMAP_ROWS = ['North', 'South', 'East'].flatMap((region, r) =>
  ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, q) => ({ region, quarter, revenue: 40 + r * 30 + q * 11 })),
);

function heatmapSpec() {
  const { spec } = buildVizSpecFromRows({
    rows: HEATMAP_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'quarter', scale: 'band' },
      color: { field: 'revenue', scale: 'linear' },
    },
  } as never);
  return spec;
}

// Numeric-Y heatmap: x categorical (region), y a real quantitative measure (amount), color a
// categorical series. s150 must fall back to Y=amount (color is not quantitative). At HEAD the
// marks-only gate read the categorical color as the measure → empty analysis → R-11 tripped.
const NUMERIC_Y_ROWS = [
  { region: 'North', series: 'alpha', amount: 12 },
  { region: 'South', series: 'beta', amount: 34 },
  { region: 'East', series: 'alpha', amount: 27 },
  { region: 'West', series: 'beta', amount: 41 },
];

function categoricalColorHeatmapSpec() {
  const { spec } = buildVizSpecFromRows({
    rows: NUMERIC_Y_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'amount', scale: 'linear' },
      color: { field: 'series' },
    },
  } as never);
  return spec;
}

function absentColorHeatmapSpec() {
  const { spec } = buildVizSpecFromRows({
    rows: NUMERIC_Y_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'amount', scale: 'linear' },
    },
  } as never);
  return spec;
}

// Numeric-x heatmap: a quantitative color measure AND a numeric x. At HEAD this emitted BOTH a
// phantom row-order trend and an x-vs-measure Pearson correlation finding. s150 suppresses both
// because a rect grid has no inherent order.
const NUMERIC_X_ROWS = [
  { idx: 1, cat: 'A', val: 10 },
  { idx: 2, cat: 'B', val: 25 },
  { idx: 3, cat: 'C', val: 18 },
  { idx: 4, cat: 'D', val: 33 },
];

function numericXHeatmapSpec() {
  const { spec } = buildVizSpecFromRows({
    rows: NUMERIC_X_ROWS,
    chartType: 'heatmap',
    encodings: {
      x: { field: 'idx', scale: 'linear' },
      y: { field: 'cat', scale: 'band' },
      color: { field: 'val', scale: 'linear' },
    },
  } as never);
  return spec;
}

describe('data-analysis F6d/s150 — heatmap COLOR-as-measure, LABEL-asserting teeth', () => {
  // D1 — the HIGH mislabel. Exact golden: label (D1), no phantom trend (D3), no color-category
  // (D4), all pinned together. At HEAD the summary read "…totaling 1,038 Quarter" and a
  // "Trend increasing: 232.5%" finding was present → this array is RED at HEAD.
  it('D1: names the COLOR measure ("Revenue"), not the Y dimension ("Quarter")', () => {
    const n = generateNarrativeSummary(heatmapSpec());
    expect(n.summary).toBe('Heatmap covers 12 data points totaling 1,038 Revenue.');
    expect(n.keyFindings).toEqual([
      'High Revenue: Revenue 133 (East)',
      'Low Revenue: Revenue 40 (North)',
      'Total Revenue: 1,038',
    ]);
    // binding-repoint regression guard — the measure came off the color channel.
    expect(n.analysis.measureField).toBe('revenue');
  });

  // D1 isolated — the label alone is RED at HEAD ("Quarter"), independent of findings shape.
  it('D1 (isolated): the summary contains the measure name and never the Y dimension name', () => {
    const n = generateNarrativeSummary(heatmapSpec());
    expect(n.summary).toContain('Revenue');
    expect(n.summary).not.toContain('Quarter');
  });

  // D2a — numeric-Y + categorical color: fall back to Y=amount (NOT the categorical color),
  // which keeps the analysis populated and R-11 passing. RED at HEAD (measureField was 'series',
  // R-11 tripped).
  it('D2a: numeric-Y heatmap with categorical color falls back to the Y measure and passes R-11', () => {
    const spec = categoricalColorHeatmapSpec();
    const n = generateNarrativeSummary(spec);
    expect(n.analysis.measureField).toBe('amount');
    expect(n.summary).toContain('Amount');
    const r11 = validateVizEquivalenceRules(spec).find((r) => r.id === 'A11Y-R-11');
    expect(r11?.passed).toBe(true);
  });

  // D2b — numeric-Y + absent color: same fallback to Y=amount, R-11 passes. RED at HEAD
  // (measureField was undefined → empty analysis → R-11 tripped).
  it('D2b: numeric-Y heatmap with absent color falls back to the Y measure and passes R-11', () => {
    const spec = absentColorHeatmapSpec();
    const analysis = analyzeVizSpec(spec);
    expect(analysis.measureField).toBe('amount');
    const r11 = validateVizEquivalenceRules(spec).find((r) => r.id === 'A11Y-R-11');
    expect(r11?.passed).toBe(true);
  });

  // D3b — numeric-x heatmap: no phantom trend and no x-vs-measure correlation. RED at HEAD
  // (both a "Trend …" finding and a "Correlation coefficient:" finding were emitted).
  it('D3b: a numeric-x heatmap emits no phantom trend or correlation', () => {
    const spec = numericXHeatmapSpec();
    const analysis = analyzeVizSpec(spec);
    expect(analysis.trend).toBeUndefined();
    expect(analysis.correlation).toBeUndefined();
    const n = generateNarrativeSummary(spec);
    expect(n.keyFindings.some((f) => f.startsWith('Trend '))).toBe(false);
    expect(n.keyFindings.some((f) => f.startsWith('Correlation coefficient:'))).toBe(false);
  });

  // D4 teeth — COLOR is the measure on a real heatmap, so colorField is dropped and its values
  // are NOT listed as a "Revenue: 40, 51, …" color-category finding. Reverting the colorField
  // drop alone re-binds colorField=revenue and re-introduces that finding → these flip RED.
  it('D4: the color measure is not also listed as a color-category finding', () => {
    const analysis = analyzeVizSpec(heatmapSpec());
    expect(analysis.colorField).toBeUndefined();
    const n = generateNarrativeSummary(heatmapSpec());
    expect(n.keyFindings.some((f) => /^Revenue: \d/.test(f))).toBe(false);
  });

  it('the heatmap PASSES A11Y-R-11 (the rule it used to fail against itself)', () => {
    const r11 = validateVizEquivalenceRules(heatmapSpec()).find((r) => r.id === 'A11Y-R-11');
    expect(r11).toBeDefined();
    expect(r11?.passed).toBe(true);
  });
});
