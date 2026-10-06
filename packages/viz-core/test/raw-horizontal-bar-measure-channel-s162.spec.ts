import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVizSpec, resolvePrimaryChannels, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-162 m2 — c2: a RAW (pre-computed, un-aggregated) horizontal bar/area (SSOT §2-m2, Fork-2).
// RED-first fixture: scratchpad/s161_horiz_raw.mjs (G2). At HEAD 8f480ec resolvePrimaryChannels'
// horizontal arms were point-only (strip) or declared-aggregate-only (s161 m3), so a raw horizontal
// bar (mark=bar, stamped-quant x = the drawn bar length, band/nominal y = the dimension) fell to the
// default measure=y and narrated the numeric category codes as the measure — High = the SHORTEST bar,
// Total = Σ category codes (6063 = Σ year), the string-category twin went SILENT. The fix adds a
// rawHorizontalBar arm gated on NEITHER axis aggregated + !x.bin + stamped-quant x + non-quant y.
//
// The guard CANNOT backstop a measure-channel misfire (a misfire relabels a REAL drawn value, not a
// phantom), so these keep-controls are the SOLE safety net — pin ALL orientation cases.
//
// MUTATION gate (seed site = the rawHorizontalBar arm in data-analysis.ts):
//   (1) remove the arm       → G2 / string-variant flip back to measure=y → RED (inverted/silent).
//   (2) drop the `y?.aggregate === undefined` conjunct → the (a) vertical misfire case flips to
//       measure=x → its keep-control goes RED (proves the conjunct is load-bearing).
// ============================================================================

const B = (field: string, trait: string, extra: Record<string, unknown> = {}) => ({ field, trait, ...extra });

function markSpec(
  mark: string,
  x: Record<string, unknown>,
  y: Record<string, unknown>,
  values: Record<string, unknown>[]
): NormalizedVizSpec {
  const encoding = { x, y };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'mc-s162',
    name: 'mc s162',
    data: { name: 'd', values },
    marks: [{ trait: mark, encodings: { ...encoding } }],
    encoding,
    a11y: { description: 'mc' },
  } as unknown as NormalizedVizSpec;
}

// mark=bar, x={score, linear-quant, no aggregate}, y={year, band} — the drawn bar length is score.
function rawHorizontalBar(): NormalizedVizSpec {
  return markSpec(
    'MarkBar',
    B('score', 'EncodingX', { scale: 'linear', type: 'quantitative' }),
    B('year', 'EncodingY', { scale: 'band' }),
    [
      { year: 2020, score: 120 },
      { year: 2021, score: 340 },
      { year: 2022, score: 90 },
    ]
  );
}

describe('s162 m2 — RAW horizontal bar resolves measure = X (the drawn bar length)', () => {
  it('resolvePrimaryChannels → measure = X (the fix)', () => {
    expect(resolvePrimaryChannels(rawHorizontalBar()).measureChannel).toBe('x');
  });

  it('max/min/total reflect score (the bar length), NOT the year codes', () => {
    const a = analyzeVizSpec(rawHorizontalBar());
    expect(a.max).toEqual({ label: '2,021', value: 340 }); // was {90, 2022} — the SHORTEST bar
    expect(a.min).toEqual({ label: '2,022', value: 90 }); // was {120, 2020}
    expect(a.total).toBe(550); // Σ score — NOT 6063 (Σ year codes), the pre-m2 inversion
  });

  it('string-category twin now narrates score as the measure (was SILENT — max/min/total undefined)', () => {
    const spec = markSpec(
      'MarkBar',
      B('score', 'EncodingX', { scale: 'linear', type: 'quantitative' }),
      B('team', 'EncodingY', { type: 'nominal' }),
      [
        { team: 'Alpha', score: 120 },
        { team: 'Beta', score: 340 },
        { team: 'Gamma', score: 90 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
    const a = analyzeVizSpec(spec);
    expect(a.max).toEqual({ label: 'Beta', value: 340 });
    expect(a.min).toEqual({ label: 'Gamma', value: 90 });
    expect(a.total).toBe(550);
  });
});

describe('s162 m2 — keep-controls (the guard cannot backstop a misfire; pin ALL orientations)', () => {
  it('(a) MISFIRE case: quant-STAMPED-x dimension + UNSTAMPED aggregated y → stays measure = Y', () => {
    // A legit VERTICAL bar carries its aggregate on Y. The `y?.aggregate === undefined` conjunct
    // EXCLUDES it, so it falls to the default measure=y. Dropping that conjunct flips this to measure=x.
    const spec = markSpec(
      'MarkBar',
      B('year', 'EncodingX', { type: 'quantitative' }),
      B('val', 'EncodingY', { aggregate: 'sum' }),
      [
        { year: 2020, val: 1 },
        { year: 2020, val: 2 },
        { year: 2021, val: 5 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('(b) raw vertical bar (nominal x, quant y, no aggregate) → measure = Y', () => {
    const spec = markSpec(
      'MarkBar',
      B('cat', 'EncodingX', { type: 'nominal' }),
      B('val', 'EncodingY', { type: 'quantitative' }),
      [
        { cat: 'a', val: 10 },
        { cat: 'b', val: 20 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('(f) both-quantitative no-aggregate bar → measure = Y (unchanged default; DISCLOSED residual)', () => {
    const spec = markSpec(
      'MarkBar',
      B('xx', 'EncodingX', { type: 'quantitative' }),
      B('yy', 'EncodingY', { type: 'quantitative' }),
      [
        { xx: 1, yy: 10 },
        { xx: 2, yy: 20 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('(h) raw binned-x histogram (x.bin) → measure = Y (the !x.bin conjunct excludes it)', () => {
    const spec = markSpec(
      'MarkBar',
      B('amt', 'EncodingX', { type: 'quantitative', bin: true }),
      B('freq', 'EncodingY', {}),
      [
        { amt: 1, freq: 3 },
        { amt: 2, freq: 5 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('(d) horizontal AGGREGATED bar (x.aggregate) → measure = X via its own s161 arm (unchanged)', () => {
    const spec = markSpec(
      'MarkBar',
      B('hours', 'EncodingX', { scale: 'linear', aggregate: 'sum', type: 'quantitative' }),
      B('year', 'EncodingY', { scale: 'band' }),
      [
        { year: 2021, hours: 60 },
        { year: 2021, hours: 50 },
        { year: 2022, hours: 40 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
    expect(analyzeVizSpec(spec).total).toBe(150); // Σ hours — the s161 arm still owns this
  });

  it('(e) horizontal strip (MarkPoint, quant x, nominal y) → measure = X via its own arm (unchanged)', () => {
    const spec = markSpec(
      'MarkPoint',
      B('val', 'EncodingX', { type: 'quantitative' }),
      B('cat', 'EncodingY', { type: 'nominal' }),
      [
        { cat: 'a', val: 10 },
        { cat: 'b', val: 20 },
      ]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
  });
});

// ── keep-control (g): the diverging-bar corpus fixture is a LIVE, previously-undisclosed instance of
// the S2 phantom this arm corrects. x={delta, linear}=quant, y={driver}=unstamped→dimension. CURRENT
// measure=y → max/min/total ALL undefined (a string dimension as the measure); POST-FIX measure=x=delta
// (Vega draws delta on X as the bar length). The analysis INTENTIONALLY MOVES undefined → {18,−12,13}.
// #564 HOLDS: golden-profiles.spec.ts.snap pins diverging-bar only by chartType/score (ranking), NOT
// a11y max/min/total (its 28 max/min hits are FieldProfile stats from a DIFFERENT pipeline).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
function loadCorpus(rel: string): NormalizedVizSpec {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as NormalizedVizSpec;
}

describe('s162 m2 — (g) diverging-bar corpus keep-control (INTENDED RED→GREEN move)', () => {
  for (const rel of ['examples/viz/patterns/diverging-bar.spec.json', 'examples/viz/patterns-v2/diverging-bar.spec.json']) {
    it(`${rel} now narrates delta as the measure (measure=x; was undefined)`, () => {
      const spec = loadCorpus(rel);
      expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
      const a = analyzeVizSpec(spec);
      expect(a.max).toEqual({ label: 'Onboarding', value: 18 });
      expect(a.min).toEqual({ label: 'Reporting', value: -12 });
      expect(a.total).toBe(13); // Σ delta: 18+12−7−12+6−4
    });
  }
});
