import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analyzeVizSpec,
  generateNarrativeSummary,
  validateVizEquivalenceRules,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// s154 F3 corrective (closes the s153 F3 HIGH+MED regressions, PS-2026-07-17-001).
//
// HIGH — a FACETED line/area spec (LayoutFacet small-multiples) rendered a cross-facet first→last
//   phantom Trend, SIGN-INVERTED vs every real per-panel series (facet-small-multiples-line:
//   "Trend decreasing: -33.1%" while all panels rise). isSequenceComposition never consulted
//   spec.layout. FIX: isFacetedLayout gate as the OUTER AND on computeTrend.
// MED — isSequenceComposition read the RAW marks (MarkRect→'unknown' failed .every) while
//   resolveMark FILTERED unknown, so line+rect collapsed to mark='line' yet had trend suppressed →
//   the false "remains relatively flat" on rising data. FIX: Variant A — a shared
//   knownNormalizedMarks(spec) filters unknown at BOTH sites (the s150 share-the-derivation
//   recipe), so line+rect is a line composition with an honest directional trend.
// FALLTHROUGH — when a faceted line's trend is (correctly) suppressed, the case-'line' narrative
//   must NOT emit the directional "remains relatively flat" ternary; it emits an order-invariant
//   range sentence instead (A11Y-R-10 stays green without an affirmative falsehood).
//
// Faceted inputs are built INLINE (no y2 band key — fork 1 — and no authored a11y.narrative, so
// the GENERATED path runs). Enumerated multi-dimensionally: marks × layout × mark-reversal.

const fixture = (rel: string): NormalizedVizSpec =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../examples/viz/patterns-v2/${rel}`, import.meta.url)), 'utf8'),
  ) as NormalizedVizSpec;

interface SynthOpts {
  marks: string[];
  rows: Record<string, unknown>[];
  layout?: Record<string, unknown>;
  color?: string;
  name?: string;
}

// A minimal generated-path NormalizedVizSpec — top-level encoding (resolveBinding reads it first),
// no authored a11y.narrative so generateNarrativeSummary derives the summary from the analysis.
function synth(opts: SynthOpts): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'point', title: 'Week' },
    y: { field: 'value', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Value' },
  };
  if (opts.color) {
    encoding.color = { field: opts.color, trait: 'EncodingColor', channel: 'color' };
  }
  return {
    id: 'synthetic',
    name: opts.name ?? 'Synthetic chart',
    data: { values: opts.rows },
    encoding,
    marks: opts.marks.map((trait) => ({ trait, encodings: encoding })),
    ...(opts.layout ? { layout: opts.layout } : {}),
    a11y: { ariaLabel: opts.name ?? 'Synthetic chart' },
  } as unknown as NormalizedVizSpec;
}

// 3 panels (A/B/C), each STRICTLY RISING across 4 weeks, ordered so the FLAT concatenation runs
// high→low (C:100..130, B:50..80, A:10..40): the cross-facet first→last is 100→40 = a decrease,
// the exact sign inversion of every real panel. min=10, max=130 (order-invariant).
const RISING_3PANEL = [
  { week: 'W1', value: 100, group: 'C' }, { week: 'W2', value: 110, group: 'C' },
  { week: 'W3', value: 120, group: 'C' }, { week: 'W4', value: 130, group: 'C' },
  { week: 'W1', value: 50, group: 'B' }, { week: 'W2', value: 60, group: 'B' },
  { week: 'W3', value: 70, group: 'B' }, { week: 'W4', value: 80, group: 'B' },
  { week: 'W1', value: 10, group: 'A' }, { week: 'W2', value: 20, group: 'A' },
  { week: 'W3', value: 30, group: 'A' }, { week: 'W4', value: 40, group: 'A' },
];
const FACET = { trait: 'LayoutFacet', rows: { field: 'group' }, maxPanels: 6 };

const noTrendFinding = (findings: readonly string[]) => findings.every((f) => !/^Trend /.test(f));

describe('s154 F3 — faceted trend gate (HIGH)', () => {
  // RED at HEAD: committed anchors emit a phantom cross-facet Trend.
  it('facet-small-multiples-line: no phantom Trend, order-invariant range sentence (RED at HEAD)', () => {
    const spec = fixture('facet-small-multiples-line.spec.json');
    const a = analyzeVizSpec(spec);
    const n = generateNarrativeSummary(spec);
    expect(a.trend).toBeUndefined();
    expect(n.summary).not.toMatch(/\bdeclines\b|\brises\b|remains relatively flat/i);
    expect(n.summary).toMatch(/ranging from/i);
    expect(noTrendFinding(n.keyFindings)).toBe(true);
  });

  it('sparkline-grid: no phantom Trend (RED at HEAD: "Trend increasing: 733.1%")', () => {
    const spec = fixture('sparkline-grid.spec.json');
    const a = analyzeVizSpec(spec);
    const n = generateNarrativeSummary(spec);
    expect(a.trend).toBeUndefined();
    expect(noTrendFinding(n.keyFindings)).toBe(true);
  });

  // Synthetic sign-inversion proof: HEAD emits a DECREASING trend on data where every panel RISES.
  it('faceted single line, each panel rising, global first>last: trend undefined not decreasing (RED at HEAD)', () => {
    const spec = synth({ marks: ['MarkLine'], rows: RISING_3PANEL, layout: FACET, color: 'group' });
    const a = analyzeVizSpec(spec);
    const n = generateNarrativeSummary(spec);
    expect(a.mark).toBe('line');
    expect(a.trend).toBeUndefined();
    expect(n.summary).not.toMatch(/declines/i);
    expect(n.summary).toMatch(/ranging from/i);
    expect(noTrendFinding(n.keyFindings)).toBe(true);
  });

  // Row-reversal invariance: the phantom sign FLIPS on a mere row reversal at HEAD; the fixed
  // range sentence is byte-identical for a spec and its row-reversed twin.
  it('range sentence is invariant under row reversal (the phantom is not)', () => {
    const forward = generateNarrativeSummary(
      synth({ marks: ['MarkLine'], rows: RISING_3PANEL, layout: FACET, color: 'group' }),
    ).summary;
    const reversed = generateNarrativeSummary(
      synth({ marks: ['MarkLine'], rows: [...RISING_3PANEL].reverse(), layout: FACET, color: 'group' }),
    ).summary;
    expect(forward).toBe(reversed);
    expect(forward).toMatch(/ranging from/i);
  });

  // Mixed area+line faceted (resolveMark='mixed', default narrative branch): the phantom Trend
  // keyFinding is still removed by the facet gate even though the range sentence does not apply.
  it('faceted area+line (mixed): no phantom Trend keyFinding (RED at HEAD)', () => {
    const spec = synth({ marks: ['MarkArea', 'MarkLine'], rows: RISING_3PANEL, layout: FACET, color: 'group' });
    const a = analyzeVizSpec(spec);
    expect(a.trend).toBeUndefined();
    expect(noTrendFinding(generateNarrativeSummary(spec).keyFindings)).toBe(true);
  });

  // All three LayoutFacet sub-shapes (rows-only / columns-only / rows+columns matrix) are gated by
  // the one predicate.
  it('rows-only, columns-only, and matrix facets are ALL suppressed', () => {
    for (const layout of [
      { trait: 'LayoutFacet', rows: { field: 'group' } },
      { trait: 'LayoutFacet', columns: { field: 'group' } },
      { trait: 'LayoutFacet', rows: { field: 'group' }, columns: { field: 'group' } },
    ]) {
      const a = analyzeVizSpec(synth({ marks: ['MarkLine'], rows: RISING_3PANEL, layout, color: 'group' }));
      expect(a.trend, JSON.stringify(layout)).toBeUndefined();
    }
  });

  // Certify the accessibility equivalence rules stay green on the fixed faceted anchor.
  it('facet-small-multiples-line still passes A11Y-R-10/R-11/R-13/R-15', () => {
    const results = validateVizEquivalenceRules(fixture('facet-small-multiples-line.spec.json'));
    for (const id of ['A11Y-R-10', 'A11Y-R-11', 'A11Y-R-13', 'A11Y-R-15']) {
      expect(results.find((r) => r.id === id)?.passed, id).toBe(true);
    }
  });
});

describe('s154 F3 — unknown-mark reconciliation (MED)', () => {
  // Monotone rising single group, non-faceted. line+rect / line+rule collapse to mark='line' via
  // resolveMark; the gate must AGREE and give the honest directional trend, not the false
  // "remains relatively flat" (RED at HEAD).
  const MONOTONE = [
    { week: 'W1', value: 10 }, { week: 'W2', value: 20 }, { week: 'W3', value: 30 }, { week: 'W4', value: 40 },
  ];

  for (const second of ['MarkRect', 'MarkRule']) {
    it(`line+${second} (non-faceted, monotone) regains the directional trend (RED at HEAD: flat)`, () => {
      const spec = synth({ marks: ['MarkLine', second], rows: MONOTONE });
      const a = analyzeVizSpec(spec);
      const n = generateNarrativeSummary(spec);
      expect(a.mark).toBe('line');
      expect(a.trend).toBe('increasing');
      expect(n.summary).toMatch(/rises from/i);
      expect(n.summary).not.toMatch(/remains relatively flat/i);
    });
  }

  it('a single MarkRect heatmap-alone stays trendless (correlation gate untouched)', () => {
    const spec = synth({ marks: ['MarkRect'], rows: MONOTONE });
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
  });
});

describe('s154 F3 — must-not-move controls', () => {
  const MONOTONE = [
    { week: 'W1', value: 10 }, { week: 'W2', value: 20 }, { week: 'W3', value: 30 }, { week: 'W4', value: 40 },
  ];

  it('non-faceted single line still trends directionally', () => {
    const a = analyzeVizSpec(synth({ marks: ['MarkLine'], rows: MONOTONE }));
    expect(a.trend).toBe('increasing');
    expect(generateNarrativeSummary(synth({ marks: ['MarkLine'], rows: MONOTONE })).summary).toMatch(/rises from/i);
  });

  it('layered-line-area (LayoutLayer) keeps "Trend increasing: 2.3%"', () => {
    const n = generateNarrativeSummary(fixture('layered-line-area.spec.json'));
    expect(n.keyFindings).toContain('Trend increasing: 2.3%');
  });

  it('bar+line and line+point (non-faceted) stay trendless (point/bar exclusion holds)', () => {
    expect(analyzeVizSpec(synth({ marks: ['MarkBar', 'MarkLine'], rows: MONOTONE })).trend).toBeUndefined();
    expect(analyzeVizSpec(synth({ marks: ['MarkLine', 'MarkPoint'], rows: MONOTONE })).trend).toBeUndefined();
  });

  // Fork 2 CLOSED by s155 m03: focus-context-line is LayoutConcat carrying color=region (3 distinct),
  // so the single-series gate (isMultiSeriesComposition, via the color arm) now suppresses the
  // cross-series phantom "Trend decreasing: -33.3%" and the line path emits an order-invariant range
  // sentence instead. The s154 concat residual is no longer a residual — this pins the fixed output.
  it('focus-context-line (LayoutConcat, color=region ×3): fork-2 phantom Trend CLOSED', () => {
    const spec = fixture('focus-context-line.spec.json');
    const a = analyzeVizSpec(spec);
    const n = generateNarrativeSummary(spec);
    expect(a.trend).toBeUndefined();
    expect(noTrendFinding(n.keyFindings)).toBe(true);
    expect(n.summary).toBe(
      'Revenue focus + context shows Revenue ranging from 0.7 (2025-W01) to 1.39 (2025-W04).',
    );
    // The legitimate order-invariant findings are preserved (only the directional claim is withheld).
    expect(n.keyFindings).toContain('High Revenue: Revenue 1.39 (2025-W04)');
    expect(n.keyFindings).toContain('Total Revenue: 12.07');
  });

  it('focus-context-line stays A11Y-R-10/R-11/R-13/R-15 green with the phantom removed', () => {
    const results = validateVizEquivalenceRules(fixture('focus-context-line.spec.json'));
    for (const id of ['A11Y-R-10', 'A11Y-R-11', 'A11Y-R-13', 'A11Y-R-15']) {
      expect(results.find((r) => r.id === id)?.passed, id).toBe(true);
    }
  });
});
