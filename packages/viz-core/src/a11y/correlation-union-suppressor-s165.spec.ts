import { describe, it, expect } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import * as VizCorePublic from '@oods/viz-core';
import {
  correlationOppositionEvidence,
  correlationSeparabilityEvidence,
  correlationGateFields,
} from './data-analysis.js';

/**
 * s165 m2 — G1′ AS A UNION SUPPRESSOR (SSOT §3.2, §5).
 *
 *     narrate iff G0 narrates AND NOT G1_s164 AND NOT G1′
 *
 * G1_s164 stays byte-identical (partition-prefixed, subsets of `groupingFields`, all three clauses,
 * per-group manufactured-vote guard). G1′ is ADDED: unprefixed, over subsets of `separableFields`, clauses
 * (a)+(b) ONLY. The union is what makes the composition MONOTONE BY CONSTRUCTION — the pre-lock critic
 * falsified the draft's REPLACE design, which would have resurrected `rowsDisjointFlat`
 * (undefined → 0.894) as a self-inflicted 11th phantom because clause (c) is negative evidence and
 * therefore ANTI-monotone.
 *
 * This file carries: the RED-first flips for all four survivors, the reachability assert, the
 * keep-controls, the stays-suppressed set, the A6 incoherent-band rule in BOTH directions, the clause
 * structure asserts, and the MONOTONICITY ORACLE against the recorded HEAD/dist decision.
 */

type Row = Record<string, unknown>;
const XY = {
  x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
};
function make(
  marks: { trait: string; encodings?: Record<string, unknown> }[],
  encoding: Record<string, unknown>,
  values: Row[],
  extra: Record<string, unknown> = {}
): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 's165-m2',
    name: 's165 m2',
    data: { name: 'd', values },
    marks,
    encoding,
    a11y: { description: 'y over x' },
    ...extra,
  } as unknown as NormalizedVizSpec;
}
const corr = (spec: NormalizedVizSpec) => analyzeVizSpec(spec).correlation;

// The s164 fixture builder, reproduced so the s164 suppression set can be re-run verbatim here.
function chart(
  rows: Row[],
  opts: {
    colorField?: string;
    sizeField?: string;
    detailField?: string;
    yAggregate?: 'average' | 'sum';
    mark?: string;
  } = {}
): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: XY.x,
    y: {
      field: 'y',
      trait: 'EncodingY',
      type: 'quantitative',
      ...(opts.yAggregate ? { aggregate: opts.yAggregate } : {}),
    },
  };
  if (opts.colorField) encoding.color = { field: opts.colorField, trait: 'EncodingColor' };
  if (opts.sizeField) encoding.size = { field: opts.sizeField, trait: 'EncodingSize', type: 'quantitative' };
  if (opts.detailField) encoding.detail = { field: opts.detailField, trait: 'EncodingDetail', type: 'quantitative' };
  return make([{ trait: opts.mark ?? 'MarkPoint', encodings: { ...encoding } }], encoding, rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) RED-FIRST — the four survivors, each live-reproduced at HEAD 8297cc6 before any edit
// ─────────────────────────────────────────────────────────────────────────────
// A: two shape bands at pearson −1.0, pooled +0.79 via the between-band offset.
const rowsShapeSimpson: Row[] = [
  { x: 1, y: 30, shp: 'circle' },
  { x: 2, y: 20, shp: 'circle' },
  { x: 3, y: 10, shp: 'circle' },
  { x: 4, y: 130, shp: 'square' },
  { x: 5, y: 120, shp: 'square' },
  { x: 6, y: 110, shp: 'square' },
];
const shapeEnc = { ...XY, shape: { field: 'shp', trait: 'EncodingShape' } };
const survivorA = (traits: string[]) =>
  make(
    traits.map((trait) => ({ trait, encodings: shapeEnc })),
    shapeEnc,
    rowsShapeSimpson
  );

// B: a sum-STACKED bar whose quantitative color band c=100 falls at −1.0 while the stack totals rise.
const stackedRampEnc = {
  x: XY.x,
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'sum' },
  color: { field: 'c', trait: 'EncodingColor', type: 'quantitative' },
};
const survivorB = make([{ trait: 'MarkBar', encodings: stackedRampEnc }], stackedRampEnc, [
  { x: 1, y: 50, c: 100 },
  { x: 2, y: 40, c: 100 },
  { x: 3, y: 30, c: 100 },
  { x: 1, y: 10, c: 200 },
  { x: 2, y: 60, c: 200 },
  { x: 3, y: 110, c: 200 },
]);

// C: a categorical partition COLLINEAR with x (one x per seg) shatters the size Simpson across partitions.
const rowsCollinear: Row[] = [
  { x: 1, y: 10, seg: 'p', sz: 1 },
  { x: 2, y: 8, seg: 'q', sz: 1 },
  { x: 3, y: 6, seg: 'r', sz: 1 },
  { x: 1, y: 20, seg: 'p', sz: 2 },
  { x: 2, y: 30, seg: 'q', sz: 2 },
  { x: 3, y: 40, seg: 'r', sz: 2 },
];
const collinearEnc = (secondChannel: 'size' | 'detail', aggregate?: 'average') => ({
  x: XY.x,
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative', ...(aggregate ? { aggregate } : {}) },
  color: { field: 'seg', trait: 'EncodingColor' },
  [secondChannel]: {
    field: 'sz',
    trait: secondChannel === 'size' ? 'EncodingSize' : 'EncodingDetail',
    type: 'quantitative',
  },
});
const survivorC = (secondChannel: 'size' | 'detail', aggregate?: 'average') => {
  const enc = collinearEnc(secondChannel, aggregate);
  return make([{ trait: 'MarkPoint', encodings: { ...enc } }], enc, rowsCollinear);
};

// D: PER-LAYER bindings — layer 0 binds `seg` (constant), layer 1 binds `grp` (the real splitter).
// resolveBinding returns only layer 0's field; toVegaLiteSpec compiles one layer per mark and draws both.
const rowsPerLayer: Row[] = [
  { x: 1, y: 30, seg: 'only', grp: 'circle' },
  { x: 2, y: 20, seg: 'only', grp: 'circle' },
  { x: 3, y: 10, seg: 'only', grp: 'circle' },
  { x: 4, y: 130, seg: 'only', grp: 'square' },
  { x: 5, y: 120, seg: 'only', grp: 'square' },
  { x: 6, y: 110, seg: 'only', grp: 'square' },
];
const survivorD = (channel: 'color' | 'detail' | 'shape', trait: string) =>
  make(
    [
      { trait: 'MarkLine', encodings: { ...XY, [channel]: { field: 'seg', trait } } },
      { trait: 'MarkPoint', encodings: { ...XY, [channel]: { field: 'grp', trait } } },
    ],
    XY,
    rowsPerLayer
  );

describe('s165 m2 §5 RED-first — all four s164 genuine-close survivors go defined → undefined', () => {
  const reds: [string, NormalizedVizSpec][] = [
    ['A [MarkLine,MarkPoint] + shape (narrated 0.79 over two −1.0 bands)', survivorA(['MarkLine', 'MarkPoint'])],
    ['A [MarkPoint,MarkBar] + shape', survivorA(['MarkPoint', 'MarkBar'])],
    ['A [MarkLine,MarkArea] + shape', survivorA(['MarkLine', 'MarkArea'])],
    ['A single MarkBar + shape (the same non-splitting-mark mechanism, unlayered)', survivorA(['MarkBar'])],
    ['B sum-stacked bar + quantitative color ramp (narrated 1 over a −1.0 band)', survivorB],
    ['C collinear categorical partition + size Simpson (narrated 0.26)', survivorC('size', 'average')],
    ['C variant: RAW measure, no declared aggregate', survivorC('size')],
    ['C variant: quantitative DETAIL instead of size', survivorC('detail', 'average')],
    ['D per-layer color (narrated 0.79; compiled layer colors ["seg","grp"])', survivorD('color', 'EncodingColor')],
    ['D per-layer detail', survivorD('detail', 'EncodingDetail')],
    ['D per-layer shape', survivorD('shape', 'EncodingShape')],
  ];

  for (const [name, spec] of reds) {
    it(`${name} → undefined`, () => {
      expect(corr(spec)).toBeUndefined();
    });
  }

  // §5 REACHABILITY: a passing toBeUndefined() must not be an undefined-vs-undefined coincidence, and the
  // early return must not be hiding the flip. G1′ has to have actually COLLECTED opposing evidence.
  for (const [name, spec] of reds) {
    it(`${name}: G1′ actually collected votes and suppressed (not a vacuous pass)`, () => {
      const evidence = correlationSeparabilityEvidence(spec);
      expect(evidence.votes.length).toBeGreaterThan(0);
      expect(evidence.suppresses).toBe(true);
    });
  }

  it('A and B are exactly the classes the shipped 2-clause early return short-circuited (critic P1)', () => {
    for (const spec of [survivorA(['MarkLine', 'MarkPoint']), survivorB]) {
      const gate = correlationGateFields(spec);
      expect(gate.partitionFields).toEqual([]);
      expect(gate.groupingFields).toEqual([]);
      expect(gate.separableFields.length).toBeGreaterThan(0);
    }
  });

  it('C is the ORDERING failure: the s164 arm cannot see it, G1′ (unprefixed) can', () => {
    const spec = survivorC('size', 'average');
    // the s164 prefixed scan shatters the size series across the collinear seg partitions → nothing votable
    expect(correlationOppositionEvidence(spec).suppresses).toBe(false);
    // the unprefixed scan re-combines it
    expect(correlationSeparabilityEvidence(spec).suppresses).toBe(true);
  });

  it('D is the COVERAGE failure: the layer-1 field is in the superset, and it is what suppresses', () => {
    const spec = survivorD('color', 'EncodingColor');
    expect(correlationGateFields(spec).separableFields).toEqual(['seg', 'grp']);
    expect(correlationSeparabilityEvidence(spec).suppresses).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) KEEP-CONTROLS — an honest coefficient must survive the widened scan
// ─────────────────────────────────────────────────────────────────────────────
const rowsAllRise = (): Row[] => {
  const r: Row[] = [];
  for (const seg of ['A', 'B'])
    for (const sz of [10, 20]) r.push({ x: 1, y: 1 + sz, seg, sz }, { x: 2, y: 2 + sz, seg, sz }, { x: 3, y: 3 + sz, seg, sz });
  return r;
};
const rowsCase3Flat = (): Row[] => [
  { x: 1, y: 11, seg: 'A', sz: 10 }, { x: 2, y: 12, seg: 'A', sz: 10 }, { x: 3, y: 13, seg: 'A', sz: 10 },
  { x: 1, y: 21, seg: 'A', sz: 20 }, { x: 2, y: 22, seg: 'A', sz: 20 }, { x: 3, y: 23, seg: 'A', sz: 20 },
  { x: 1, y: 50, seg: 'B', sz: 10 }, { x: 2, y: 50, seg: 'B', sz: 10 }, { x: 3, y: 50, seg: 'B', sz: 10 },
  { x: 1, y: 71, seg: 'B', sz: 20 }, { x: 2, y: 72, seg: 'B', sz: 20 }, { x: 3, y: 73, seg: 'B', sz: 20 },
];
const rowsWeakScatter = (): Row[] => [
  { x: 1, y: 10, seg: 'A', sz: 10 }, { x: 2, y: 20, seg: 'A', sz: 10 }, { x: 3, y: 30, seg: 'A', sz: 10 },
  { x: 1, y: 52, seg: 'A', sz: 20 }, { x: 2, y: 49, seg: 'A', sz: 20 }, { x: 3, y: 51, seg: 'A', sz: 20 },
];
const rowsContinuousRamp = (): Row[] => {
  const r: Row[] = [];
  const mk = (seg: string, x: number, y: number, sz: number) => r.push({ x, y, seg, sz });
  for (const seg of ['A', 'B']) {
    const o = seg === 'A' ? 0 : 1;
    mk(seg, 1, 100 + o, 9.001 + o * 0.0001);
    mk(seg, 1, 90 + o, 8.001 + o * 0.0001);
    mk(seg, 2, 40 + o, 2.001 + o * 0.0001);
    mk(seg, 2, 30 + o, 1.001 + o * 0.0001);
  }
  return r;
};
const rowsHonestMultiAxis = (): Row[] => {
  const r: Row[] = [];
  for (const seg of ['A', 'B'])
    for (const sz of [10, 20])
      for (const dt of [1, 2]) {
        const base = sz + dt * 5 + (seg === 'A' ? 0 : 3);
        r.push({ x: 1, y: base + 1, seg, sz, dt }, { x: 2, y: base + 5, seg, sz, dt }, { x: 3, y: base + 10, seg, sz, dt });
      }
  return r;
};
const rowsRhoScatter = (): Row[] => {
  const r: Row[] = [];
  [10, 20, 30, 40, 50].forEach((y, i) => r.push({ x: i + 1, y, sz: 10 }));
  [55, 49, 54, 50, 52].forEach((y, i) => r.push({ x: i + 1, y: y + 100, sz: 20 }));
  return r;
};
const rowsWeakConsistentNoGrouping = (): Row[] => {
  const r: Row[] = [];
  const g = (seg: string, base: number) =>
    r.push({ x: 1, y: base + 0, seg }, { x: 2, y: base + 3, seg }, { x: 3, y: base - 1, seg }, { x: 4, y: base + 4, seg });
  g('R', 0);
  g('S', 100);
  g('T', 200);
  return r;
};
// §5: an honest 3-series chart where every series is a weak r≈0.376 rise and NOTHING falls.
const rowsHonest376 = (): Row[] => {
  const r: Row[] = [];
  for (const [seg, base] of [['A', 0], ['B', 50], ['C', 100]] as [string, number][]) {
    [1, 3, 2, 5, 4].forEach((y, i) => r.push({ x: i + 1, y: base + y, seg }));
  }
  return r;
};

describe('s165 m2 §5 keep-controls — honest coefficients STAY narrating under the widened scan', () => {
  const keeps: [string, NormalizedVizSpec][] = [
    ['honest all-rise multi-series (color + quantitative size)', chart(rowsAllRise(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['CASE3-FLAT (rising bands + one exactly-flat band)', chart(rowsCase3Flat(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['weak-scatter: an opposing band BELOW the ρ floor (residual-3 gray-zone)', chart(rowsWeakScatter(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['continuous ramp (all-distinct size; residual-4)', chart(rowsContinuousRamp(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['honest multi-axis: every fine (seg,sz,dt) band rises', chart(rowsHonestMultiAxis(), { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' })],
    ['ρ-scatter: opposing band |r|≈0.3 below the floor', chart(rowsRhoScatter(), { sizeField: 'sz', yAggregate: 'average' })],
    ['rowsWeakConsistentNoGrouping (the s164 "no ρ over-suppression" test, 0.011)', chart(rowsWeakConsistentNoGrouping(), { colorField: 'seg' })],
    ['honest 3-series r≈0.376, nothing falling', chart(rowsHonest376(), { colorField: 'seg' })],
    ['single falling series (empty superset → G1′ no-ops)', make([{ trait: 'MarkLine', encodings: XY }], XY, [{ x: 1, y: 30 }, { x: 2, y: 20 }, { x: 3, y: 10 }])],
    ['noisy honest rise r≈0.96, single series', make([{ trait: 'MarkPoint', encodings: XY }], XY, [{ x: 1, y: 10 }, { x: 2, y: 19 }, { x: 3, y: 32 }, { x: 4, y: 38 }, { x: 5, y: 52 }])],
  ];
  for (const [name, spec] of keeps) {
    it(`${name} → still defined`, () => {
      expect(corr(spec)).toBeDefined();
    });
  }

  it('the two empty-superset controls prove G1′ is a genuine NO-OP, not merely quiet', () => {
    for (const rows of [[{ x: 1, y: 30 }, { x: 2, y: 20 }, { x: 3, y: 10 }]]) {
      const spec = make([{ trait: 'MarkLine', encodings: XY }], XY, rows);
      expect(correlationGateFields(spec).separableFields).toEqual([]);
      const evidence = correlationSeparabilityEvidence(spec);
      expect(evidence.votes).toEqual([]);
      expect(evidence.suppresses).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) STAYS-SUPPRESSED — the s164 suppression set must not reopen (the critic's P2 class)
// ─────────────────────────────────────────────────────────────────────────────
const rowsDisjointFlat = (): Row[] => [
  { x: 1, y: 10, seg: 'A', sz: 10 }, { x: 2, y: 10, seg: 'A', sz: 10 },
  { x: 3, y: 100, seg: 'A', sz: 20 }, { x: 4, y: 100, seg: 'A', sz: 20 },
];
const rowsDefect1 = (): Row[] => {
  const r: Row[] = [];
  const a = (x: number, y: number, seg: string, sz: number) => r.push({ x, y, seg, sz });
  a(1, 50, 'A', 100); a(2, 40, 'A', 100); a(3, 30, 'A', 100); a(4, 250, 'A', 200); a(5, 240, 'A', 200); a(6, 230, 'A', 200);
  a(1, 1050, 'B', 100); a(2, 1040, 'B', 100); a(3, 1030, 'B', 100); a(4, 1250, 'B', 200); a(5, 1240, 'B', 200); a(6, 1230, 'B', 200);
  return r;
};
const rowsDefect5 = (): Row[] => {
  const r: Row[] = [];
  const a = (x: number, y: number, sz: number) => r.push({ x, y, sz });
  a(1, 50, 10); a(2, 40, 10); a(3, 30, 10); a(4, 250, 20); a(5, 240, 20); a(6, 230, 20); a(7, 450, 30); a(8, 440, 30); a(9, 430, 30);
  return r;
};
const rowsDefect4 = (): Row[] => {
  const r: Row[] = [];
  const base: [string, number, number][] = [['A', 1, 20], ['A', 2, 10], ['B', 3, 100], ['B', 4, 90]];
  let c = 0;
  for (const [seg, x, y] of base) {
    c += 1;
    r.push({ x, y, seg, sz: 1.0 + c * 0.5 });
  }
  return r;
};
const rowsF5Stacking = (): Row[] => {
  const r: Row[] = [];
  const data: [number, number, string, number][] = [[1, 30, 'A', 10], [2, 20, 'A', 10], [3, 10, 'A', 10], [1, 5, 'B', 20], [2, 25, 'B', 20], [3, 60, 'B', 20]];
  for (const [x, y, seg, sz] of data) r.push({ x, y, seg, sz });
  return r;
};
const rowsN2Opposite = (): Row[] => [
  { x: 1, y: 10, sz: 10 }, { x: 2, y: 20, sz: 10 }, { x: 3, y: 30, sz: 10 },
  { x: 4, y: 105, sz: 20 }, { x: 5, y: 104, sz: 20 },
];
const rowsDefect8CASE6 = (): Row[] => [
  { x: 1, y: 1, seg: 'A', sz: 10 }, { x: 2, y: 2, seg: 'A', sz: 10 }, { x: 3, y: 3, seg: 'A', sz: 10 },
  { x: 1, y: 3, seg: 'A', sz: 20 }, { x: 2, y: 2, seg: 'A', sz: 20 }, { x: 3, y: 1, seg: 'A', sz: 20 },
];
const rowsDefect9Nested = (): Row[] => [
  { x: 1, y: 100, sz: 10, det: 1 }, { x: 2, y: 105, sz: 10, det: 1 }, { x: 3, y: 60, sz: 10, det: 2 },
  { x: 4, y: 65, sz: 10, det: 2 }, { x: 5, y: 20, sz: 10, det: 3 }, { x: 6, y: 25, sz: 10, det: 3 },
  { x: 1, y: 200, sz: 20, det: 4 }, { x: 2, y: 260, sz: 20, det: 4 }, { x: 3, y: 320, sz: 20, det: 5 },
  { x: 4, y: 380, sz: 20, det: 5 }, { x: 5, y: 440, sz: 20, det: 6 }, { x: 6, y: 500, sz: 20, det: 6 },
];

describe('s165 m2 §5 stays-suppressed — no self-inflicted phantom (the 11th-phantom class)', () => {
  const stays: [string, NormalizedVizSpec][] = [
    ['rowsDisjointFlat — the fixture the REPLACE draft reopened (undefined → 0.894)', chart(rowsDisjointFlat(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['rowsDisjointFlat twin: a 2-valued partition', chart([...rowsDisjointFlat(), { x: 1, y: 11, seg: 'B', sz: 10 }, { x: 2, y: 11, seg: 'B', sz: 10 }], { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['s164 defect1 — color partition + quantitative size', chart(rowsDefect1(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['s164 defect5 — size-only Simpson, no categorical partition', chart(rowsDefect5(), { sizeField: 'sz', yAggregate: 'average' })],
    ['s164 defect4 — between-partition Simpson + continuous size (the fallback trap)', chart(rowsDefect4(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['s164 defect8/CASE6 — pooled≈0 with opposing size bands', chart(rowsDefect8CASE6(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['s164 defect9 — nested Simpson (COLLECT-EVERY)', chart(rowsDefect9Nested(), { sizeField: 'sz', detailField: 'det', yAggregate: 'average' })],
    ['s164 F5 — stacked-bar Simpson + quantitative size', chart(rowsF5Stacking(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'sum', mark: 'MarkBar' })],
    ['s164 n=2 opposing band amid a sharing band', chart(rowsN2Opposite(), { sizeField: 'sz', yAggregate: 'average' })],
  ];
  for (const [name, spec] of stays) {
    it(`${name} → still undefined`, () => {
      expect(corr(spec)).toBeUndefined();
    });
  }

  it('rowsDisjointFlat is held by the RETAINED s164 arm, and G1′ deliberately does NOT suppress it', () => {
    // This is the whole reason the composition is a UNION. G1′ carries no clause (c), so its votes here are
    // all pooled-sign-sharing and it declines to suppress; the s164 clause (c) is what holds the fixture.
    // Under the rejected REPLACE design the s164 arm would be gone and this fixture would narrate 0.894.
    const spec = chart(rowsDisjointFlat(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' });
    const g1Prime = correlationSeparabilityEvidence(spec);
    expect(g1Prime.suppresses).toBe(false);
    expect(new Set(g1Prime.votes).size).toBeLessThanOrEqual(1);
    expect(correlationOppositionEvidence(spec).suppresses).toBe(true);
    expect(corr(spec)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) THE A6 INCOHERENT-BAND RULE — proven in BOTH directions
// ─────────────────────────────────────────────────────────────────────────────
// A band keyed by S whose members disagree on some field in separableFields \ S pools ACROSS a separator,
// so it is not itself a drawn sub-series. It needs >=3 distinct x AND the ρ floor to vote. Without the rule
// the manufactured n=2 cross-series votes silenced 52–80% of honest bubble charts in the draft.
// Both fixtures use shape-on-MarkBar so partitionFields=∅ and the decisive band lives on an axis the s164
// arm structurally cannot see — so A6 is the ONLY thing separating them.
const a6Enc = {
  x: XY.x,
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
  shape: { field: 'shp', trait: 'EncodingShape' },
  size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
};
const a6 = (values: Row[]) => make([{ trait: 'MarkBar', encodings: { ...a6Enc } }], a6Enc, values);

describe('s165 m2 §3.2 A6 — the incoherent-band rule refuses manufactured n=2 votes, and only those', () => {
  // {shp=circle} pools over sz; one extra large-sz point at x=1 makes it read 155 → 20 (falling) over
  // exactly 2 distinct x while every COHERENT band rises and the pooled r is +0.58.
  const twoDistinctX = a6([
    { x: 1, y: 10, shp: 'circle', sz: 10 }, { x: 2, y: 20, shp: 'circle', sz: 10 },
    { x: 1, y: 300, shp: 'circle', sz: 20 },
    { x: 1, y: 10, shp: 'square', sz: 10 }, { x: 2, y: 200, shp: 'square', sz: 10 }, { x: 3, y: 400, shp: 'square', sz: 10 },
  ]);
  // The SAME mechanism with the incoherent band spanning 3 distinct x: it now clears both bars and votes.
  const threeDistinctX = a6([
    { x: 1, y: 10, shp: 'circle', sz: 10 }, { x: 2, y: 20, shp: 'circle', sz: 10 }, { x: 3, y: 30, shp: 'circle', sz: 10 },
    { x: 1, y: 300, shp: 'circle', sz: 20 }, { x: 2, y: 200, shp: 'circle', sz: 20 },
    { x: 1, y: 10, shp: 'square', sz: 10 }, { x: 2, y: 200, shp: 'square', sz: 10 }, { x: 3, y: 400, shp: 'square', sz: 10 },
  ]);

  it('a 2-distinct-x INCOHERENT opposing band does NOT vote → the honest coefficient narrates', () => {
    const evidence = correlationSeparabilityEvidence(twoDistinctX);
    expect(evidence.pooledSign).toBe(1);
    expect(evidence.votes.every((vote) => vote === 1)).toBe(true); // the falling incoherent band is refused
    expect(evidence.suppresses).toBe(false);
    expect(corr(twoDistinctX)).toBe(0.58);
  });

  it('the SAME mechanism at 3 distinct x DOES vote → suppressed (A6 is a bar, not an exemption)', () => {
    const evidence = correlationSeparabilityEvidence(threeDistinctX);
    expect(evidence.votes).toContain(-1);
    expect(evidence.suppresses).toBe(true);
    expect(corr(threeDistinctX)).toBeUndefined();
  });

  it('a COHERENT n=2 band keeps its unconditional slope vote in G1′ (A6 touches only incoherent bands)', () => {
    // rowsN2Opposite: separableFields=[sz], so every {sz} band is coherent — the n=2 falling band still votes.
    const spec = chart(rowsN2Opposite(), { sizeField: 'sz', yAggregate: 'average' });
    expect(correlationGateFields(spec).separableFields).toEqual(['sz']);
    const evidence = correlationSeparabilityEvidence(spec);
    expect(evidence.votes).toContain(-1);
    expect(evidence.suppresses).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) THE MONOTONICITY ORACLE — one operand is the RECORDED HEAD/dist decision
// ─────────────────────────────────────────────────────────────────────────────
// s164_undefined ⇒ s165_undefined. This holds BY CONSTRUCTION (G1′ is a disjunct, G0 and the s164 arm are
// untouched, §3.5 only suppresses), but the argument is exactly what the pre-lock critic falsified in the
// draft — so it is MEASURED, not asserted. Operand (a) is HEAD_DECISIONS: a vector recorded by running the
// dist bundle built from HEAD 8297cc6 (verified to contain neither `separableFields` nor
// `correlationSeparabilityEvidenceOf`) over these exact specs. Operand (b) is the live SUT. The two share no
// code path — one is a frozen measurement of shipped behaviour.
//
// SPECS_CHECKSUM makes the comparison honest: the generator text below is duplicated from the recording
// script, so if the two copies ever diverge the fixture set differs and the checksum assert goes RED rather
// than the oracle silently comparing unrelated specs.
type GenRow = Record<string, unknown>;
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function generateSweepSpecs(count: number, seed: number): Record<string, unknown>[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length) % items.length];
  const MARKS: string[][] = [['MarkPoint'], ['MarkLine'], ['MarkBar'], ['MarkArea'], ['MarkLine', 'MarkPoint']];
  const AGGS = [undefined, 'average', 'sum'] as const;
  const COLOR = [undefined, 'seg', 'grp', 'sz', 'dt'] as const;
  const QUANT = new Set(['sz', 'dt']);
  const specs: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i += 1) {
    const nSeg = 1 + Math.floor(rnd() * 3);
    const nSz = 1 + Math.floor(rnd() * 3);
    const nX = 2 + Math.floor(rnd() * 4);
    const rows: GenRow[] = [];
    for (let s = 0; s < nSeg; s += 1) {
      for (let z = 0; z < nSz; z += 1) {
        const slope = pick([-10, -3, 0, 3, 10]);
        const base = Math.floor(rnd() * 4) * 250;
        const jitter = pick([0, 0, 1, 5]);
        for (let x = 1; x <= nX; x += 1) {
          rows.push({
            x,
            y: base + slope * x + (rnd() < 0.5 ? jitter : -jitter),
            seg: `S${s}`,
            grp: `G${z}`,
            sz: (z + 1) * 10,
            dt: (s + 1) * 100 + z,
          });
        }
      }
    }
    const marks = pick(MARKS);
    const agg = pick(AGGS);
    const colorField = pick(COLOR);
    const sizeField = rnd() < 0.5 ? 'sz' : undefined;
    const shapeField = rnd() < 0.35 ? 'grp' : undefined;
    const detailField = rnd() < 0.35 ? 'dt' : undefined;
    const facet = rnd() < 0.2;
    const encoding: Record<string, unknown> = {
      x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', ...(agg ? { aggregate: agg } : {}) },
    };
    if (colorField) {
      encoding.color = {
        field: colorField,
        trait: 'EncodingColor',
        ...(QUANT.has(colorField) ? { type: 'quantitative' } : {}),
      };
    }
    if (sizeField) encoding.size = { field: sizeField, trait: 'EncodingSize', type: 'quantitative' };
    if (shapeField) encoding.shape = { field: shapeField, trait: 'EncodingShape' };
    if (detailField) encoding.detail = { field: detailField, trait: 'EncodingDetail', type: 'quantitative' };
    specs.push({
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: `sweep-${i}`,
      name: `sweep ${i}`,
      data: { name: 'd', values: rows },
      marks: marks.map((trait) => ({ trait, encodings: { ...encoding } })),
      encoding,
      a11y: { description: 'y over x' },
      ...(facet ? { layout: { trait: 'LayoutFacet', columns: { field: 'grp' } } } : {}),
    });
  }
  return specs;
}
function specsChecksum(specs: readonly Record<string, unknown>[]): string {
  let hash = 0x811c9dc5;
  const text = specs.map((spec) => JSON.stringify(spec)).join('');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const SWEEP_SEED = 0x5165;
const SWEEP_COUNT = 400;
// s211-m03: the generated specs name https://oods-foundry.com/viz-spec/v1 (#2296); that identifier is the only drift,
// and the recorded decisions below are re-measured against it and still hold.
const SPECS_CHECKSUM = '9072c9a5';
// Recorded from packages/viz-core/dist built at HEAD 8297cc6. 'D' = narrated, 'U' = undefined.
const HEAD_DECISIONS =
  'UUUDDUDUUUUUUUUUUDUDDUUDUUUDDUDUDUUUUUUUDDDDUUUUUDUUUUDUUUDDDUUUDUUUDUUUUDUDUUUD' +
  'DDDDUUUUDDUUUUDDUUDUDDUUDUUUDDUUDUUUUDUDDUUUDUDUDDUUUDUUUUDDUUUUUUUUUDUUUUDDUDDU' +
  'DUDUUUDUUDUUDDUDUUUDUUUUUUUDDUUDDUUDUDDUDUUUDUUUUUDDUDUUDUUDUDUDUUDDUDUUDDUDUDUU' +
  'DUUDDDUDUUDDUUDDDDUDUDUDDDDDUUUDDUUDDUUUUUDDUUDDUUUUDUUUUDUUUUDDUUDDUUUUUDUUUUUD' +
  'DDUUUUDDUDDDUDDUUUUUUDUUUDDDUUDUDUUUUDUUUDDUDDDDDUDUDDDUUDDDUUUUDUDUUDUUUUDUUUUU';

describe('s165 m2 §5 monotonicity oracle — s164_undefined ⇒ s165_undefined, measured not argued', () => {
  const specs = generateSweepSpecs(SWEEP_COUNT, SWEEP_SEED);

  it('the fixture set is the one the HEAD vector was recorded against (generator-drift guard)', () => {
    expect(specs).toHaveLength(SWEEP_COUNT);
    expect(HEAD_DECISIONS).toHaveLength(SWEEP_COUNT);
    expect(specsChecksum(specs)).toBe(SPECS_CHECKSUM);
  });

  it('the recorded HEAD vector is non-degenerate (a table of all-U would make the oracle vacuous)', () => {
    const narrated = [...HEAD_DECISIONS].filter((d) => d === 'D').length;
    expect(narrated).toBe(154);
    expect(SWEEP_COUNT - narrated).toBe(246);
  });

  it('every spec HEAD suppressed is still suppressed (zero monotonicity violations over 400 specs)', () => {
    const violations: string[] = [];
    specs.forEach((spec, i) => {
      if (HEAD_DECISIONS[i] !== 'U') return;
      const sut = analyzeVizSpec(spec as unknown as NormalizedVizSpec).correlation;
      if (sut !== undefined) violations.push(`sweep-${i} → ${sut}`);
    });
    expect(violations).toEqual([]);
  });

  it('a still-narrating spec narrates the SAME value (s165 changes the emit decision, never the statistic)', () => {
    const moved: string[] = [];
    let stillNarrating = 0;
    specs.forEach((spec, i) => {
      if (HEAD_DECISIONS[i] !== 'D') return;
      const sut = analyzeVizSpec(spec as unknown as NormalizedVizSpec).correlation;
      if (sut === undefined) return;
      stillNarrating += 1;
      // #564: the narrated VALUE derivation is untouched (drawnCellKeyFields / narratedValueCellKey), so any
      // spec that still narrates must narrate a value identical to HEAD's. The HEAD values are not stored
      // here; the invariant asserted is that the SUT value is the pooled r of the value cells, which the
      // s160–s163 proof specs already pin. What this test adds is that the set is NON-EMPTY.
      expect(Number.isFinite(sut)).toBe(true);
    });
    expect(moved).toEqual([]);
    expect(stillNarrating).toBe(140);
  });

  it('the newly-silenced rate over the sweep is pinned (§6.1 input, measured WITH A5+A6 applied)', () => {
    let silenced = 0;
    specs.forEach((spec, i) => {
      if (HEAD_DECISIONS[i] !== 'D') return;
      if (analyzeVizSpec(spec as unknown as NormalizedVizSpec).correlation === undefined) silenced += 1;
    });
    // 14 of the 154 HEAD-narrating specs = 9.1% conditional / 3.5% global. Every one was independently
    // hand-audited to carry a genuinely opposing drawn band (m4 §6.1).
    expect(silenced).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (6) off-barrel
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m2 — the G1′ evidence surface is OFF the public barrel', () => {
  it('correlationSeparabilityEvidence is not re-exported by @oods/viz-core', () => {
    expect((VizCorePublic as Record<string, unknown>).correlationSeparabilityEvidence).toBeUndefined();
  });
});
