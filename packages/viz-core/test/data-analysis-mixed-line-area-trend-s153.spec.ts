import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, assertNormalizedVizSpec, generateNarrativeSummary } from '@oods/viz-core';
import type { NormalizedVizSpec } from '@oods/viz-core';

// s153 F3 corrective (closes the s152 F3 MED regression, PS-2026-07-12-006). The s152 trend gate
// keyed on the COLLAPSED mark (resolveMark), which returns 'mixed' for ≥2 distinct marks — so a
// legitimate LAYERED line+area combo (the committed layered-line-area fixture, marks
// [MarkArea,MarkLine,MarkLine], which s151 correctly narrated) lost its honest first→last Trend.
// The fix (isSequenceComposition = EVERY mark line/area) restores those combos while keeping any
// heterogeneous mark (bar/point/rect) suppressed. `point` is EXCLUDED, so point+line stays
// suppressed — this file pins the line/area-ONLY decision against a future point re-inclusion.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..', '..', '..');

// The canonical committed fixture the memo's reproduce-RED names — a real layered line+area combo
// with a temporal X (week) and a rising quantitative Y (actual 0.96→0.982).
const layeredLineArea = () =>
  assertNormalizedVizSpec(
    JSON.parse(readFileSync(path.join(repoRoot, 'examples/viz/patterns-v2/layered-line-area.spec.json'), 'utf8')),
  );

// Vary ONLY the mark composition on a valid base spec (rows, encoding, temporal X all held
// constant) so each test isolates the isSequenceComposition axis. Cloning the fixture's first
// mark and swapping its trait keeps every binding valid.
function withMarks(...traits: string[]): NormalizedVizSpec {
  const base = layeredLineArea();
  const marks = traits.map((trait) => ({ ...base.marks[0], trait }));
  return { ...base, marks: marks as NormalizedVizSpec['marks'] };
}

function trendFinding(spec: NormalizedVizSpec): string | undefined {
  return generateNarrativeSummary(spec).keyFindings.find((f) => /^Trend/i.test(f));
}

describe('s153 F3 — trend on sequence (line/area) compositions', () => {
  it('RESTORED: the committed layered line+area fixture regains its Trend (RED at HEAD: undefined)', () => {
    const spec = layeredLineArea();
    // Assert the analysis object AND the human-readable LABEL string (the s149 F6d lesson).
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(trendFinding(spec)).toMatch(/^Trend increasing:/);
  });

  it('RESTORED: a synthetic area+line combo computes a trend (mixed marks no longer suppress it)', () => {
    const spec = withMarks('MarkArea', 'MarkLine');
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(trendFinding(spec)).toBeDefined();
  });

  it('preserved: a single line mark still trends', () => {
    const spec = withMarks('MarkLine');
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(trendFinding(spec)).toBeDefined();
  });

  it('preserved: a single area mark still trends', () => {
    const spec = withMarks('MarkArea');
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(trendFinding(spec)).toBeDefined();
  });

  it('preserved: multiple line marks (all same) still trend', () => {
    const spec = withMarks('MarkLine', 'MarkLine');
    expect(analyzeVizSpec(spec).trend).toBe('increasing');
    expect(trendFinding(spec)).toBeDefined();
  });

  it('suppressed: a bar mark has no phantom row-order trend', () => {
    const spec = withMarks('MarkBar');
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFinding(spec)).toBeUndefined();
  });

  it('suppressed: a point mark has no phantom row-order trend', () => {
    const spec = withMarks('MarkPoint');
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFinding(spec)).toBeUndefined();
  });

  it('suppressed: a rect mark has no phantom row-order trend', () => {
    const spec = withMarks('MarkRect');
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFinding(spec)).toBeUndefined();
  });

  it('suppressed: a bar+line combo stays suppressed (any non-sequence mark fails .every)', () => {
    const spec = withMarks('MarkBar', 'MarkLine');
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFinding(spec)).toBeUndefined();
  });

  it('suppressed: a point+line combo stays suppressed (pins the line/area-ONLY decision)', () => {
    const spec = withMarks('MarkPoint', 'MarkLine');
    expect(analyzeVizSpec(spec).trend).toBeUndefined();
    expect(trendFinding(spec)).toBeUndefined();
  });
});
