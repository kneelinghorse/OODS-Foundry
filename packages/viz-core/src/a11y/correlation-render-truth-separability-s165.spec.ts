import { describe, it, expect } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import * as VizCorePublic from '@oods/viz-core';
import {
  correlationGateFields,
  layeredCorrelationUnsupported,
  separableFields,
} from './data-analysis.js';

/**
 * s165 m1 — the FAIL-SAFE SUPERSET field derivation (SSOT §3.1, §3.2b, §3.5; s164 genuine-close review
 * PS-2026-07-24-002, 10th consecutive NOT_GENUINE_CLOSE).
 *
 * s164 asserted the RIGHT direct property (rule 14: a narrated correlation must not contradict the
 * direction of every visually-separable drawn sub-series) over a STRUCTURALLY-RECONSTRUCTED sub-series
 * set — the proxy did not get eliminated, it MOVED from the invariant (s163) to the ENUMERATION (s164).
 * Four confirmed survivors, each an enumeration hole:
 *   A  `shape` on a layered/'mixed' mark  — narrated 0.79 over two bands at pearson −1.0
 *   B  a QUANTITATIVE color ramp on a sum-stacked bar — narrated 1 over a band at −1.0
 *   C  a collinear categorical partition shattering a size Simpson — narrated 0.26
 *   D  PER-LAYER bindings (`resolveBinding` reads layer 0 only; `toVegaLiteSpec` compiles one layer per
 *      mark) — narrated 0.79 over two `grp` bands at −1.0, compiled layer colors literally ["seg","grp"]
 *
 * This file pins the m1 FIELD DERIVATION (rule 15's entire scope: an over-inclusion silences, an
 * under-inclusion ships a phantom) plus the §3.2b re-gated early return and the §3.5 layered silence.
 * The DECISION that consumes it (G1′) and the behavioural RED-first flips are pinned in
 * correlation-union-suppressor-s165.spec.ts.
 */

type Row = Record<string, unknown>;
const XY = {
  x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
};
const rows3: Row[] = [
  { x: 1, y: 30, shp: 'circle', seg: 'only', grp: 'circle', sz: 1 },
  { x: 2, y: 20, shp: 'circle', seg: 'only', grp: 'circle', sz: 1 },
  { x: 3, y: 10, shp: 'circle', seg: 'only', grp: 'circle', sz: 1 },
  { x: 4, y: 130, shp: 'square', seg: 'only', grp: 'square', sz: 2 },
  { x: 5, y: 120, shp: 'square', seg: 'only', grp: 'square', sz: 2 },
  { x: 6, y: 110, shp: 'square', seg: 'only', grp: 'square', sz: 2 },
];

function make(
  marks: { trait: string; encodings?: Record<string, unknown>; from?: string }[],
  encoding: Record<string, unknown>,
  values: Row[] = rows3,
  extra: Record<string, unknown> = {}
): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 's165-m1',
    name: 's165 m1',
    data: { name: 'd', values },
    marks,
    encoding,
    a11y: { description: 'y over x' },
    ...extra,
  } as unknown as NormalizedVizSpec;
}
// separableFields on a plain x=dimension / y=measure cartesian spec.
const sf = (spec: NormalizedVizSpec) => separableFields(spec, 'x', 'y');

// ─────────────────────────────────────────────────────────────────────────────
// (1) PER-LAYER UNION — survivor D's mechanism (§3.1 A5, mutation vii)
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 §3.1 — binding resolution is a per-layer UNION, never resolveBinding (kills D)', () => {
  const perLayerColor = make(
    [
      { trait: 'MarkLine', encodings: { ...XY, color: { field: 'seg', trait: 'EncodingColor' } } },
      { trait: 'MarkPoint', encodings: { ...XY, color: { field: 'grp', trait: 'EncodingColor' } } },
    ],
    XY
  );

  it('a channel bound to a DIFFERENT field per mark contributes BOTH fields', () => {
    // resolveBinding(spec,'color') returns ONLY 'seg' (first mark carrying the channel) — the exact
    // short-circuit that hid survivor D. The union must carry the layer-1 splitter too.
    expect(sf(perLayerColor)).toEqual(['seg', 'grp']);
  });

  it('the top-level encoding AND every mark encoding are unioned (top-level first)', () => {
    const spec = make(
      [
        { trait: 'MarkLine', encodings: { ...XY, detail: { field: 'm0', trait: 'EncodingDetail' } } },
        { trait: 'MarkPoint', encodings: { ...XY, detail: { field: 'm1', trait: 'EncodingDetail' } } },
      ],
      { ...XY, detail: { field: 'top', trait: 'EncodingDetail' } }
    );
    expect(sf(spec)).toEqual(['top', 'm0', 'm1']);
  });

  it('a field repeated across layers is deduped (deterministic, first-appearance order)', () => {
    const same = { field: 'seg', trait: 'EncodingColor' };
    const spec = make(
      [
        { trait: 'MarkLine', encodings: { ...XY, color: same } },
        { trait: 'MarkPoint', encodings: { ...XY, color: same } },
      ],
      XY
    );
    expect(sf(spec)).toEqual(['seg']);
  });

  it('per-layer union also covers shape and size, not just color', () => {
    const spec = make(
      [
        { trait: 'MarkPoint', encodings: { ...XY, shape: { field: 'shp', trait: 'EncodingShape' } } },
        { trait: 'MarkPoint', encodings: { ...XY, size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' } } },
      ],
      XY
    );
    expect(sf(spec)).toEqual(expect.arrayContaining(['shp', 'sz']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) SHAPE IS UNCONDITIONAL — survivor A's mechanism (§3.1 A7, mutation i)
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 §3.1 — shape is UNCONDITIONALLY separable: no mark gate at all (kills A)', () => {
  const shapeEnc = { ...XY, shape: { field: 'shp', trait: 'EncodingShape' } };

  it("a 'mixed' mark (2 distinct traits → resolveMark collapses to 'mixed') still separates by shape", () => {
    // markSplitsByRetina('mixed') is FALSE, which dropped shape from BOTH s164 gates (survivor A).
    const spec = make(
      [
        { trait: 'MarkLine', encodings: shapeEnc },
        { trait: 'MarkPoint', encodings: shapeEnc },
      ],
      shapeEnc
    );
    expect(sf(spec)).toEqual(['shp']);
  });

  it('MarkBar + shape separates by shape (the mark predicate is gone, not merely widened)', () => {
    // markSplitsByRetina('bar') is FALSE. Gating shape on ANY mark predicate — including the rejected
    // `knownNormalizedMarks.some(markSplitsByRetina)`, which is false for exactly the 'unknown' marks it
    // was meant to admit — turns this RED.
    expect(sf(make([{ trait: 'MarkBar', encodings: shapeEnc }], shapeEnc))).toEqual(['shp']);
  });

  it('an all-UNKNOWN mark spec (MarkRule) still separates by shape', () => {
    expect(sf(make([{ trait: 'MarkRule', encodings: shapeEnc }], shapeEnc))).toEqual(['shp']);
  });

  it('a spec with NO marks still separates by a top-level shape', () => {
    expect(sf(make([], shapeEnc))).toEqual(['shp']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) COLOR INCLUDING QUANTITATIVE + STACKING DROPS NOTHING — survivor B (mutations ii, v)
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 §3.1 — a quantitative color ramp separates, and stacking drops nothing (kills B)', () => {
  const stackedRampEnc = {
    x: XY.x,
    y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'sum' },
    color: { field: 'c', trait: 'EncodingColor', type: 'quantitative' },
  };

  it('a QUANTITATIVE color binding is separable (correlationPartitionFields skips it; separability does not)', () => {
    expect(sf(make([{ trait: 'MarkBar', encodings: stackedRampEnc }], stackedRampEnc))).toEqual(['c']);
  });

  it('a sum-stacked bar keeps its series fields (drawnCellKeyFields drops them; separability does not)', () => {
    const stackedCatEnc = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'sum' },
      color: { field: 'seg', trait: 'EncodingColor' },
      detail: { field: 'grp', trait: 'EncodingDetail' },
    };
    const spec = make([{ trait: 'MarkBar', encodings: stackedCatEnc }], stackedCatEnc);
    // The shipped stacking drop is still visible on the VALUE key — the two derivations diverge here
    // deliberately: the value pools the segments into the stack height, but the segments are still DRAWN.
    expect(correlationGateFields(spec).groupingFields).toEqual([]);
    expect(sf(spec)).toEqual(['seg', 'grp']);
  });

  it('a count-stacked bar also keeps its series fields', () => {
    const enc = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'count' },
      color: { field: 'seg', trait: 'EncodingColor' },
    };
    expect(sf(make([{ trait: 'MarkBar', encodings: enc }], enc))).toEqual(['seg']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) THE REST OF THE SUPERSET + the exclusions
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 §3.1 — size / detail / facet / second-positional all separate; the correlation axes do not', () => {
  it('size and detail always separate, categorical or quantitative', () => {
    const enc = {
      ...XY,
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
      detail: { field: 'dt', trait: 'EncodingDetail' },
    };
    expect(sf(make([{ trait: 'MarkPoint', encodings: enc }], enc))).toEqual(['sz', 'dt']);
  });

  it('facet rows AND columns separate (panels the encoding role table structurally cannot see)', () => {
    const spec = make([{ trait: 'MarkPoint', encodings: XY }], XY, rows3, {
      layout: { trait: 'LayoutFacet', rows: { field: 'r' }, columns: { field: 'c' } },
    });
    expect(sf(spec)).toEqual(['r', 'c']);
  });

  it('a SECOND positional axis separates; the measure CHANNEL does not', () => {
    // y is the measure channel → excluded by CHANNEL. A y bound to a non-measure field on a horizontal
    // bar (measure=x) is a second dimension and DOES separate.
    const horizontal = {
      x: { field: 'len', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'cat', trait: 'EncodingY' },
    };
    const spec = make([{ trait: 'MarkBar', encodings: horizontal }], horizontal, [
      { len: 5, cat: 'a' },
      { len: 6, cat: 'b' },
    ]);
    // measure=x (raw horizontal bar), dimension=y → neither positional field is a separator here.
    expect(separableFields(spec, 'cat', 'len')).toEqual([]);
  });

  it('x2 / y2 (band endpoints) never separate', () => {
    const enc = { ...XY, x2: { field: 'xEnd', trait: 'EncodingX2' }, y2: { field: 'yEnd', trait: 'EncodingY2' } };
    expect(sf(make([{ trait: 'MarkBar', encodings: enc }], enc))).toEqual([]);
  });

  it('the primary dimension and the measure field are excluded even when re-bound to a retinal channel', () => {
    const enc = {
      ...XY,
      color: { field: 'y', trait: 'EncodingColor', type: 'quantitative' },
      size: { field: 'x', trait: 'EncodingSize', type: 'quantitative' },
      detail: { field: 'real', trait: 'EncodingDetail' },
    };
    expect(sf(make([{ trait: 'MarkPoint', encodings: enc }], enc))).toEqual(['real']);
  });

  it('a plain single-series chart has an EMPTY superset (no new suppression surface)', () => {
    expect(sf(make([{ trait: 'MarkLine', encodings: XY }], XY))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) §3.2b — the RE-GATED early return. RULE 13b: the three classes newly falling through.
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 §3.2b — the early return no longer short-circuits the gates (critic P1)', () => {
  // A spec falls THROUGH when partitionFields=∅ AND groupingFields=∅ (so the SHIPPED 2-clause early
  // return `partitionFields.length===0 && groupingFields.length===0` returned the pooled r BEFORE either
  // gate ran — why the pre-amendment draft did not kill A or B) AND separableFields≠∅.
  //
  // RULE 13b is discharged by EXHAUSTION, not by three hand-picked fixtures: the whole
  // mark × aggregate × channel × stamped-type × facet space is enumerated and the fall-through set is
  // CHARACTERIZED by an independently-written structural predicate. Two mechanisms cover it exactly —
  // note this CORRECTS the memo's §3.2b prose, which named three: its (b) "a stacking aggregate with no
  // facet and no categorical retinal" and its (c) "a quantitative-only retinal under stacking" are the
  // SAME set in the shipped code (a stacking aggregate whose retinal is CATEGORICAL still partitions, so
  // it never falls through — except categorical shape, which is mechanism 1). A future edit that widens
  // the fall-through set beyond these two mechanisms turns this RED.
  const MARK_SETS: string[][] = [
    ['MarkBar'], ['MarkLine'], ['MarkPoint'], ['MarkArea'], ['MarkRule'],
    ['MarkLine', 'MarkPoint'], ['MarkPoint', 'MarkBar'],
  ];
  const AGGS = [undefined, 'sum', 'count', 'average'] as const;
  const RETINAL = [
    ['color', 'EncodingColor'],
    ['size', 'EncodingSize'],
    ['shape', 'EncodingShape'],
    ['detail', 'EncodingDetail'],
  ] as const;

  // Test-side mark resolution (mirrors normalizeMark/resolveMark's contract; written here so the
  // predicate is an INDEPENDENT statement of structure, not a call into the derivation under test).
  const normalize = (trait: string) =>
    /markbar/i.test(trait) ? 'bar'
    : /markline/i.test(trait) ? 'line'
    : /markpoint/i.test(trait) ? 'point'
    : /markarea/i.test(trait) ? 'area'
    : 'unknown';
  function resolved(traits: string[]): string {
    const known = [...new Set(traits.map(normalize).filter((m) => m !== 'unknown'))];
    return known.length === 1 ? known[0] : known.length > 1 ? 'mixed' : 'unknown';
  }
  function shouldFallThrough(
    traits: string[], agg: string | undefined, channel: string, quantitative: boolean, facet: boolean
  ): boolean {
    if (facet) return false; // a facet field always partitions, so the gates were already reached
    const mark = resolved(traits);
    const splitsByRetina = mark === 'point' || mark === 'line' || mark === 'area';
    const stacks = (mark === 'bar' || mark === 'area') && (agg === 'sum' || agg === 'count');
    // (1) shape on a mark the s164 retinal gates call non-splitting — incl. every 'mixed' spec, because
    //     resolveMark collapses 2 distinct traits to 'mixed' (survivor A).
    if (channel === 'shape' && !splitsByRetina) return true;
    // (2) a QUANTITATIVE retinal under stacking: the partition skips it for quantitativeness and the
    //     grouping key drops it for stacking (survivor B).
    if (quantitative && stacks) return true;
    return false;
  }

  it('the fall-through set is EXACTLY the two named mechanisms across the whole structural space', () => {
    let considered = 0;
    let fellThrough = 0;
    for (const traits of MARK_SETS)
      for (const agg of AGGS)
        for (const [channel, trait] of RETINAL)
          for (const quantitative of [false, true])
            for (const facet of [false, true]) {
              considered += 1;
              const enc: Record<string, unknown> = {
                x: XY.x,
                y: { field: 'y', trait: 'EncodingY', type: 'quantitative', ...(agg ? { aggregate: agg } : {}) },
                [channel]: {
                  field: quantitative ? 'sz' : 'shp',
                  trait,
                  ...(quantitative ? { type: 'quantitative' } : {}),
                },
              };
              const spec = make(
                traits.map((t) => ({ trait: t, encodings: enc })),
                enc,
                rows3,
                facet ? { layout: { trait: 'LayoutFacet', columns: { field: 'seg' } } } : {}
              );
              const gate = correlationGateFields(spec);
              const falls =
                gate.partitionFields.length === 0 &&
                gate.groupingFields.length === 0 &&
                gate.separableFields.length > 0;
              if (falls) fellThrough += 1;
              expect(
                falls,
                `marks=${traits} agg=${agg} ${channel}:${quantitative ? 'quant' : 'cat'} facet=${facet} — gate=${JSON.stringify(gate)}`
              ).toBe(shouldFallThrough(traits, agg, channel, quantitative, facet));
            }
    // Pinned counts: a silent change in coverage moves these even if the characterization still holds.
    expect(considered).toBe(448);
    expect(fellThrough).toBe(46);
  });

  it('a spec with NOTHING separable still takes the early return (G0 behaviour preserved)', () => {
    const plain = make([{ trait: 'MarkLine', encodings: XY }], XY);
    expect(correlationGateFields(plain)).toEqual({
      partitionFields: [],
      groupingFields: [],
      separableFields: [],
    });
    // and it still narrates its honest single-series coefficient
    expect(analyzeVizSpec(plain).correlation).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (6) §3.5 — fail-safe SILENCE on layered specs the row walk cannot model (fork F2)
// ─────────────────────────────────────────────────────────────────────────────
describe("s165 m1 §3.5 — multi-measure / own-dataset layered specs SUPPRESS (Derek-ratified F2)", () => {
  const twoMeasures = make(
    [
      { trait: 'MarkLine', encodings: { x: XY.x, y: { field: 'actual', trait: 'EncodingY', type: 'quantitative' } } },
      { trait: 'MarkLine', encodings: { x: XY.x, y: { field: 'target', trait: 'EncodingY', type: 'quantitative' } } },
    ],
    { x: XY.x },
    [
      { x: 1, actual: 10, target: 50 },
      { x: 2, actual: 20, target: 50 },
      { x: 3, actual: 30, target: 50 },
    ]
  );
  const ownDataset = make(
    [
      { trait: 'MarkLine', encodings: XY },
      { trait: 'MarkLine', from: 'gov_median', encodings: XY },
    ],
    XY,
    [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ]
  );

  it('marks binding MORE THAN ONE distinct measure field → suppressed', () => {
    expect(layeredCorrelationUnsupported(twoMeasures)).toBe(true);
    expect(analyzeVizSpec(twoMeasures).correlation).toBeUndefined();
  });

  it("a mark carrying its own `from` dataset → suppressed (collectRows never reads a second dataset)", () => {
    expect(layeredCorrelationUnsupported(ownDataset)).toBe(true);
    expect(analyzeVizSpec(ownDataset).correlation).toBeUndefined();
  });

  it('CONTROL: a layered spec with ONE measure field and no `from` is NOT suppressed by §3.5', () => {
    const oneMeasure = make(
      [
        { trait: 'MarkLine', encodings: XY },
        { trait: 'MarkPoint', encodings: XY },
      ],
      XY,
      [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 30 },
      ]
    );
    expect(layeredCorrelationUnsupported(oneMeasure)).toBe(false);
    expect(analyzeVizSpec(oneMeasure).correlation).toBeDefined();
  });

  it('CONTROL: a single-mark chart is never §3.5-suppressed', () => {
    expect(layeredCorrelationUnsupported(make([{ trait: 'MarkPoint', encodings: XY }], XY))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (7) off-barrel: the new surfaces are relative-import proofs only
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m1 — the new derivation surfaces are OFF the public barrel', () => {
  for (const name of ['separableFields', 'layeredCorrelationUnsupported', 'correlationGateFields']) {
    it(`${name} is not re-exported by @oods/viz-core`, () => {
      expect((VizCorePublic as Record<string, unknown>)[name]).toBeUndefined();
    });
  }
});
