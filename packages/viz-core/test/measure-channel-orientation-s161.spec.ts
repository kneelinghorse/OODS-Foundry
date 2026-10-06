import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, resolvePrimaryChannels, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-161 m3 — c3: measure-channel orientation honesty (SSOT §2-m3, Fork-2=A). A horizontal
// AGGREGATED bar (declared aggregate on X, dimension on Y) narrated inverted because
// resolvePrimaryChannels was point-only on its horizontal arm — the value axis (X) fell to the Y
// default, so the category codes were narrated as the measure (High/Low inverted, Total = Σ codes).
// The fix adds a SEPARATE aggregate-keyed bar/area arm (measure = X when mark∈{bar,area} ∧ X carries
// a declared aggregate ∧ Y does not). This is the NEW STANDING measure-channel∈{x,y,color} harness
// axis — the orientation axis that hid the inversion since s151. The guard CANNOT backstop an m3
// misfire (a misfire relabels a real drawn value, not a phantom), so these keep-controls are the
// sole safety net. MUTATION gate: revert the bar arm (drop the horizontalAggregatedBar branch) →
// the horizontal-aggregated-bar case below goes RED (measure flips back to Y → inverted narration).
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
    id: 'mc',
    name: 'mc',
    data: { name: 'd', values },
    marks: [{ trait: mark, encodings: { ...encoding } }],
    encoding,
    a11y: { description: 'mc' },
  } as unknown as NormalizedVizSpec;
}

// The repro fixture: sum(hours) per year drawn as HORIZONTAL bars (2021→110, 2022→40).
function horizontalAggregatedBar(): NormalizedVizSpec {
  return markSpec(
    'MarkBar',
    B('hours', 'EncodingX', { scale: 'linear', aggregate: 'sum', type: 'quantitative' }),
    B('year', 'EncodingY', { scale: 'band' }),
    [{ year: 2021, hours: 60 }, { year: 2021, hours: 50 }, { year: 2022, hours: 40 }]
  );
}

describe('s161 m3 — the measure-channel∈{x,y,color} harness axis', () => {
  it('horizontal AGGREGATED bar (x-aggregate, y-dim) → measure = X (the fix)', () => {
    expect(resolvePrimaryChannels(horizontalAggregatedBar()).measureChannel).toBe('x');
  });

  it('horizontal AGGREGATED area → measure = X', () => {
    const spec = markSpec(
      'MarkArea',
      B('amount', 'EncodingX', { aggregate: 'sum', type: 'quantitative' }),
      B('cat', 'EncodingY', { scale: 'band' }),
      [{ cat: 'a', amount: 3 }, { cat: 'b', amount: 7 }]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
  });

  it('KEEP-CONTROL — horizontal STRIP (MarkPoint, quant x, nominal y, NO aggregate) → measure = X (point arm, unchanged)', () => {
    const spec = markSpec(
      'MarkPoint',
      B('value', 'EncodingX', { type: 'quantitative' }),
      B('group', 'EncodingY', { scale: 'band' }),
      [{ group: 'a', value: 5 }, { group: 'b', value: 9 }]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('x');
  });

  it('KEEP-CONTROL — vertical bar with a STAMPED-QUANT x DIMENSION + unstamped aggregated y → measure = Y (the new arm must NOT misfire)', () => {
    // The critic's misfire case: x is quantitative BUT has no aggregate; y carries the aggregate.
    // A quant-x rule would wrongly flip this to measure=X; the aggregate-keyed arm does not fire.
    const spec = markSpec(
      'MarkBar',
      B('year', 'EncodingX', { type: 'quantitative', scale: 'band' }),
      B('revenue', 'EncodingY', { aggregate: 'sum' }),
      [{ year: 2021, revenue: 10 }, { year: 2022, revenue: 20 }]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('KEEP-CONTROL — nominal-x vertical bar → measure = Y (byte-identical default)', () => {
    const spec = markSpec(
      'MarkBar',
      B('region', 'EncodingX', { scale: 'band' }),
      B('sales', 'EncodingY', { aggregate: 'sum' }),
      [{ region: 'N', sales: 10 }, { region: 'S', sales: 20 }]
    );
    expect(resolvePrimaryChannels(spec).measureChannel).toBe('y');
  });

  it('KEEP-CONTROL — a heatmap stays measure = COLOR; a numeric-numeric scatter stays measure = Y', () => {
    const heatmap = markSpec(
      'MarkRect',
      B('region', 'EncodingX', { scale: 'band' }),
      B('hour', 'EncodingY', { scale: 'band' }),
      [{ region: 'N', hour: '9', temp: 5 }]
    );
    (heatmap.encoding as Record<string, unknown>).color = B('temp', 'EncodingColor', { aggregate: 'sum' });
    (heatmap.marks[0].encodings as Record<string, unknown>).color = B('temp', 'EncodingColor', { aggregate: 'sum' });
    expect(resolvePrimaryChannels(heatmap).measureChannel).toBe('color');

    const scatter = markSpec(
      'MarkPoint',
      B('x', 'EncodingX', { type: 'quantitative' }),
      B('y', 'EncodingY', { type: 'quantitative' }),
      [{ x: 1, y: 2 }, { x: 2, y: 3 }]
    );
    expect(resolvePrimaryChannels(scatter).measureChannel).toBe('y');
  });
});

describe('s161 m3 — the horizontal aggregated bar narrates the DRAWN sums (end-to-end)', () => {
  // Cross-mission (§5.9): m3 edits resolvePrimaryChannels, which m1's drawn-cell spine + m2's
  // correlation bindings + the guard all consume. The end-to-end narration proves the spine now keys
  // by the YEAR dimension (Total = Σ hours = 150, not Σ year codes = 6064) and High/Low are correct.
  it('max/min/total reflect sum(hours) per year, not the category codes', () => {
    const a = analyzeVizSpec(horizontalAggregatedBar());
    expect(a.max).toEqual({ label: '2,021', value: 110 }); // 60 + 50
    expect(a.min).toEqual({ label: '2,022', value: 40 });
    expect(a.total).toBe(150); // Σ hours — NOT 6064 (Σ year codes), the pre-m3 inversion
  });
});

// ============================================================================
// Sprint-162 m3 — c3.iv: the STANDING SUT-resolved measure-channel COVERAGE MANIFEST (SSOT §2-m3.iv,
// critic c3-A3). The §4/§7 closure claim names a CLOSED SET of measure-channel orientations. This
// manifest proves each named orientation has an EXECUTING fixture the SUT (resolvePrimaryChannels)
// RESOLVES to the CLAIMED channel — keyed on resolvePrimaryChannels(spec).measureChannel, NOT a
// test-side structural read of the fixture's intent (do NOT copy the correlation manifest's
// describeTuple). A fixture the author BELIEVES is a "raw horizontal bar" but the code mis-resolves to
// measure=y registers the WRONG channel → both its own case AND the closed-set assert go RED. So §7
// cannot name an orientation the code does not actually resolve (the claim-scope-vs-enumeration
// meta-defect closed at its root for the measure-channel axis).
// ============================================================================

function rawHorizontalBarFixture(): NormalizedVizSpec {
  // mark=bar, x={score, linear-quant, NO aggregate} (the drawn bar length), y={team, nominal} (dim).
  return markSpec(
    'MarkBar',
    B('score', 'EncodingX', { scale: 'linear', type: 'quantitative' }),
    B('team', 'EncodingY', { type: 'nominal' }),
    [
      { team: 'Alpha', score: 120 },
      { team: 'Beta', score: 340 },
    ]
  );
}

function heatmapColorMeasureFixture(): NormalizedVizSpec {
  const spec = markSpec(
    'MarkRect',
    B('region', 'EncodingX', { scale: 'band' }),
    B('hour', 'EncodingY', { scale: 'band' }),
    [
      { region: 'N', hour: '9', temp: 5 },
      { region: 'S', hour: '9', temp: 8 },
    ]
  );
  (spec.encoding as Record<string, unknown>).color = B('temp', 'EncodingColor', { type: 'quantitative' });
  (spec.marks[0].encodings as Record<string, unknown>).color = B('temp', 'EncodingColor', { type: 'quantitative' });
  return spec;
}

describe('s162 m3 — SUT-resolved measure-channel coverage manifest (closure surface = predicate domain)', () => {
  // Every measure-channel orientation the §4/§7 claim names, paired with the channel the claim asserts
  // the SUT resolves it to. The manifest is populated FROM the SUT below (not a structural read).
  const CLAIMED: { name: string; expected: 'x' | 'y' | 'color'; fixture: () => NormalizedVizSpec }[] = [
    {
      name: 'vertical-bar',
      expected: 'y',
      fixture: () =>
        markSpec('MarkBar', B('cat', 'EncodingX', { scale: 'band' }), B('val', 'EncodingY', { aggregate: 'sum' }), [
          { cat: 'a', val: 10 },
          { cat: 'b', val: 20 },
        ]),
    },
    {
      name: 'vertical-line',
      expected: 'y',
      fixture: () =>
        markSpec(
          'MarkLine',
          B('t', 'EncodingX', { type: 'quantitative' }),
          B('v', 'EncodingY', { type: 'quantitative' }),
          [
            { t: 1, v: 10 },
            { t: 2, v: 20 },
          ]
        ),
    },
    {
      name: 'vertical-area',
      expected: 'y',
      fixture: () =>
        markSpec('MarkArea', B('m', 'EncodingX', { type: 'nominal' }), B('v', 'EncodingY', { type: 'quantitative' }), [
          { m: 'a', v: 10 },
          { m: 'b', v: 20 },
        ]),
    },
    {
      name: 'horizontal-strip',
      expected: 'x',
      fixture: () =>
        markSpec(
          'MarkPoint',
          B('value', 'EncodingX', { type: 'quantitative' }),
          B('group', 'EncodingY', { scale: 'band' }),
          [
            { group: 'a', value: 5 },
            { group: 'b', value: 9 },
          ]
        ),
    },
    { name: 'declared-aggregate-horizontal-bar', expected: 'x', fixture: horizontalAggregatedBar },
    { name: 'raw-horizontal-bar', expected: 'x', fixture: rawHorizontalBarFixture },
    { name: 'heatmap-color-is-measure', expected: 'color', fixture: heatmapColorMeasureFixture },
  ];

  const MANIFEST = new Map<string, 'x' | 'y' | 'color'>();

  for (const o of CLAIMED) {
    it(`${o.name}: the SUT resolves measure = ${o.expected}`, () => {
      const resolved = resolvePrimaryChannels(o.fixture()).measureChannel;
      MANIFEST.set(o.name, resolved); // register the SUT-RESOLVED channel (recorded even on mismatch)
      expect(resolved).toBe(o.expected);
    });
  }

  it('the §7 closure clause names EXACTLY the SUT-resolved orientation manifest (generated, not aspirational)', () => {
    // Every claimed orientation resolved via the SUT to its claimed channel...
    for (const o of CLAIMED) {
      expect(MANIFEST.get(o.name), `orientation "${o.name}" has no SUT-resolved fixture`).toBe(o.expected);
    }
    // ...and the manifest holds NOTHING the claim omits (the closed set holds both ways).
    expect([...MANIFEST.keys()].sort()).toEqual(CLAIMED.map((o) => o.name).sort());
  });
});
