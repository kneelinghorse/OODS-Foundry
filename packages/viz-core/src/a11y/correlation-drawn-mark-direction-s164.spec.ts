import { describe, it, expect } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import * as VizCorePublic from '@oods/viz-core';
// §3 charter-diff pin: the independent drift oracle imports ONLY the value-key source
// (`narratedValueCellKey`) and the SUT evidence surface (`correlationOppositionEvidence`). It does NOT
// import `classifyCorrelationGroups`, `correlationGroupingFields`, or `correlationClassifierActualKey`
// (the classifier path) — so operand (a) [the oracle] and operand (b) [the SUT] share only the
// `drawnCellKeyFields` SOURCE, never the classifier grouping. Reverting the runtime G1 moves (b), not (a).
import { correlationOppositionEvidence, narratedValueCellKey } from './data-analysis.js';

/**
 * s164 m1 — the direction-pooling survivor (SSOT §0/§1/§10; s163 review PS-2026-07-23-008). The s163
 * gate classified each partition group's DIRECTION by POOLING its grouping axis into ONE `pearson`
 * (`classifyGroupDirection` over the whole re-projected cell set), so a Simpson on a QUANTITATIVE
 * grouping axis — bubble size, a color ramp, a quantitative detail — narrated a positive coefficient
 * over drawn sub-series that all FALL (each size band falls; the between-band offset lifts the pooled
 * direction). The fix (§10) is DIMENSIONLESS and DECOMPOSED: for every subset S of the grouping fields,
 * collect the vote of every (partition ∪ S)-keyed drawn sub-series with n>=2 distinct x (COLLECT-EVERY,
 * no coarser-ancestor skip), and SUPPRESS if any genuinely opposes the pooled direction — where
 * "genuinely opposes" is scale-invariant (n>=3: |pearson| >= ρ=0.5; n=2: votes its slope). narrate iff
 * BOTH the unchanged G0 (per-partition gate — between-partition Simpsons, stacking, defect-4) AND the
 * new G1 (within-partition grouping-axis Simpson) narrate.
 *
 * Correctness rests on these RED-first FIXTURES + the genuine-close REVIEW (§3 honest scope); the drift
 * assert below validates SUT-matches-§10 (call-site drift), NOT §10-correctness (that would re-encode
 * §10 = the rule-13a tautology).
 */

type Row = Record<string, unknown>;
const B = (field: string, trait: string, extra: Record<string, unknown> = {}) => ({ field, trait, ...extra });

// A cartesian mark with x=dimension, y=measure, and optional categorical color / quantitative size /
// quantitative detail retinal channels, an optional facet, and an optional declared y aggregate.
function chart(
  rows: Row[],
  opts: {
    colorField?: string;
    sizeField?: string;
    detailField?: string;
    facetColumnField?: string;
    yAggregate?: 'average' | 'sum' | undefined;
    mark?: string;
  } = {}
): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: B('x', 'EncodingX', { type: 'quantitative' }),
    y: B('y', 'EncodingY', { type: 'quantitative', ...(opts.yAggregate ? { aggregate: opts.yAggregate } : {}) }),
  };
  if (opts.colorField) encoding.color = B(opts.colorField, 'EncodingColor');
  if (opts.sizeField) encoding.size = B(opts.sizeField, 'EncodingSize', { type: 'quantitative' });
  if (opts.detailField) encoding.detail = B(opts.detailField, 'EncodingDetail', { type: 'quantitative' });
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'corr-s164',
    name: 'corr s164',
    data: { name: 'c', values: rows },
    marks: [{ trait: opts.mark ?? 'MarkPoint', encodings: { ...encoding } }],
    encoding,
    ...(opts.facetColumnField
      ? { layout: { trait: 'LayoutFacet', columns: { field: opts.facetColumnField } } }
      : {}),
    a11y: { description: 'y over x' },
  } as unknown as NormalizedVizSpec;
}

// ── fixture row builders (validated against the reference simulator, 22/22) ──
const rowsDefect1 = (): Row[] => {
  const r: Row[] = []; const a = (x: number, y: number, seg: string, sz: number) => r.push({ x, y, seg, sz });
  a(1, 50, 'A', 100); a(2, 40, 'A', 100); a(3, 30, 'A', 100); a(4, 250, 'A', 200); a(5, 240, 'A', 200); a(6, 230, 'A', 200);
  a(1, 1050, 'B', 100); a(2, 1040, 'B', 100); a(3, 1030, 'B', 100); a(4, 1250, 'B', 200); a(5, 1240, 'B', 200); a(6, 1230, 'B', 200);
  return r;
};
const rowsDefect2 = (): Row[] => {
  const r: Row[] = []; for (const seg of ['A', 'B']) r.push({ x: 1, y: 10, seg, d: 1 }, { x: 2, y: 9, seg, d: 1 }, { x: 3, y: 100, seg, d: 2 }, { x: 4, y: 99, seg, d: 2 });
  return r;
};
const rowsDefect5 = (): Row[] => {
  const r: Row[] = []; const a = (x: number, y: number, sz: number) => r.push({ x, y, sz });
  a(1, 50, 10); a(2, 40, 10); a(3, 30, 10); a(4, 250, 20); a(5, 240, 20); a(6, 230, 20); a(7, 450, 30); a(8, 440, 30); a(9, 430, 30);
  return r;
};
const rowsDefect6 = (): Row[] => {
  const r: Row[] = []; const a = (x: number, y: number, sz: number) => r.push({ x, y, sz });
  a(1, 100, 10); a(2, 60, 10); a(3, 20, 10); a(4, 2000, 50); a(5, 1960, 50); a(6, 1920, 50); a(7, 4000, 90); a(8, 3960, 90); a(9, 3920, 90);
  return r;
};
const rowsDefect6cShallow = (): Row[] => {
  const r: Row[] = []; const a = (x: number, y: number, sz: number) => r.push({ x, y, sz });
  a(1, 100, 10); a(2, 99, 10); a(3, 98, 10); a(4, 97, 10); a(5, 96, 10);
  a(6, 900, 50); a(7, 899, 50); a(8, 898, 50); a(9, 897, 50); a(10, 896, 50);
  a(11, 1800, 90); a(12, 1799, 90); a(13, 1798, 90); a(14, 1797, 90); a(15, 1796, 90);
  return r;
};
const rowsDefect7 = (): Row[] => {
  const r: Row[] = []; let id = 0; const a = (x: number, y: number, seg: string, size: number) => { id++; r.push({ x, y, seg, size, det: id }); };
  a(1, 160, 'A', 10); a(2, 80, 'A', 10); a(3, 260, 'A', 20); a(4, 180, 'A', 20);
  a(1, 360, 'B', 10); a(2, 280, 'B', 10); a(3, 460, 'B', 20); a(4, 380, 'B', 20);
  return r;
};
const rowsDefect8CASE6 = (): Row[] => [
  { x: 1, y: 1, seg: 'A', sz: 10 }, { x: 2, y: 2, seg: 'A', sz: 10 }, { x: 3, y: 3, seg: 'A', sz: 10 },
  { x: 1, y: 3, seg: 'A', sz: 20 }, { x: 2, y: 2, seg: 'A', sz: 20 }, { x: 3, y: 1, seg: 'A', sz: 20 },
];
const rowsDefect9Nested = (): Row[] => [
  { x: 1, y: 100, sz: 10, det: 1 }, { x: 2, y: 105, sz: 10, det: 1 }, { x: 3, y: 60, sz: 10, det: 2 }, { x: 4, y: 65, sz: 10, det: 2 }, { x: 5, y: 20, sz: 10, det: 3 }, { x: 6, y: 25, sz: 10, det: 3 },
  { x: 1, y: 200, sz: 20, det: 4 }, { x: 2, y: 260, sz: 20, det: 4 }, { x: 3, y: 320, sz: 20, det: 5 }, { x: 4, y: 380, sz: 20, det: 5 }, { x: 5, y: 440, sz: 20, det: 6 }, { x: 6, y: 500, sz: 20, det: 6 },
];
const rowsDisjointFlat = (): Row[] => [
  { x: 1, y: 10, seg: 'A', sz: 10 }, { x: 2, y: 10, seg: 'A', sz: 10 }, { x: 3, y: 100, seg: 'A', sz: 20 }, { x: 4, y: 100, seg: 'A', sz: 20 },
];
const rowsTwoAxisAllFall = (): Row[] => {
  const r: Row[] = []; let w = 0;
  for (const seg of ['A', 'B']) for (const sz of [10, 20]) for (const dt of [1, 2]) {
    const x0 = w * 3; w++; const lift = w * 1000;
    r.push({ x: x0 + 1, y: lift + 100, seg, sz, dt }, { x: x0 + 2, y: lift + 90, seg, sz, dt }, { x: x0 + 3, y: lift + 80, seg, sz, dt });
  }
  return r;
};
const rowsAllRise = (): Row[] => {
  const r: Row[] = []; for (const seg of ['A', 'B']) for (const sz of [10, 20]) r.push({ x: 1, y: 1 + sz, seg, sz }, { x: 2, y: 2 + sz, seg, sz }, { x: 3, y: 3 + sz, seg, sz });
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
  const r: Row[] = []; const mk = (seg: string, x: number, y: number, sz: number) => r.push({ x, y, seg, sz });
  for (const seg of ['A', 'B']) { const o = seg === 'A' ? 0 : 1;
    mk(seg, 1, 100 + o, 9.001 + o * 0.0001); mk(seg, 1, 90 + o, 8.001 + o * 0.0001); mk(seg, 2, 40 + o, 2.001 + o * 0.0001); mk(seg, 2, 30 + o, 1.001 + o * 0.0001);
  }
  return r;
};
const rowsHonestMultiAxis = (): Row[] => {
  const r: Row[] = []; for (const seg of ['A', 'B']) for (const sz of [10, 20]) for (const dt of [1, 2]) {
    const base = sz + dt * 5 + (seg === 'A' ? 0 : 3);
    r.push({ x: 1, y: base + 1, seg, sz, dt }, { x: 2, y: base + 5, seg, sz, dt }, { x: 3, y: base + 10, seg, sz, dt });
  }
  return r;
};
const rowsRhoCliff = (): Row[] => {
  const r: Row[] = []; [100, 100, 100, 100, 100, 0].forEach((y, i) => r.push({ x: i + 1, y, sz: 10 }));
  [10, 30, 60, 90, 120, 150].forEach((y, i) => r.push({ x: i + 1, y: y + 1000, sz: 20 }));
  return r;
};
const rowsRhoScatter = (): Row[] => {
  const r: Row[] = []; [10, 20, 30, 40, 50].forEach((y, i) => r.push({ x: i + 1, y, sz: 10 }));
  [55, 49, 54, 50, 52].forEach((y, i) => r.push({ x: i + 1, y: y + 100, sz: 20 }));
  return r;
};
const rowsDefect4 = (): Row[] => {
  const r: Row[] = []; const base: [string, number, number][] = [['A', 1, 20], ['A', 2, 10], ['B', 3, 100], ['B', 4, 90]]; let c = 0;
  for (const [seg, x, y] of base) { c++; r.push({ x, y, seg, sz: 1.0 + c * 0.5 }); }
  return r;
};
const rowsF5Stacking = (): Row[] => {
  const r: Row[] = []; const data: [number, number, string, number][] = [[1, 30, 'A', 10], [2, 20, 'A', 10], [3, 10, 'A', 10], [1, 5, 'B', 20], [2, 25, 'B', 20], [3, 60, 'B', 20]];
  for (const [x, y, seg, sz] of data) r.push({ x, y, seg, sz });
  return r;
};
// an n=2 opposing band (Δ=-1, tiny) AMID a band that rises WITH the pooled — the sole suppressor is the
// n=2 slope vote (contradiction). A magnitude/Δ gate on the n=2 branch (the infeasible v2 τ) would flatten
// it → the chart would narrate over a visibly falling drawn pair. Proves the n=2 branch must NOT be gated.
const rowsN2Opposite = (): Row[] => [
  { x: 1, y: 10, sz: 10 }, { x: 2, y: 20, sz: 10 }, { x: 3, y: 30, sz: 10 }, // rises, shares pooled
  { x: 4, y: 105, sz: 20 }, { x: 5, y: 104, sz: 20 },                        // n=2 falls Δ=-1 (opposes)
];
const rowsWeakConsistentNoGrouping = (): Row[] => {
  const r: Row[] = []; const g = (seg: string, base: number) => r.push({ x: 1, y: base + 0, seg }, { x: 2, y: base + 3, seg }, { x: 3, y: base - 1, seg }, { x: 4, y: base + 4, seg });
  g('R', 0); g('S', 100); g('T', 200);
  return r;
};

const corr = (spec: NormalizedVizSpec) => analyzeVizSpec(spec).correlation;

// ─────────────────────────────────────────────────────────────────────────────
// (1) BEHAVIORAL RED-first — the direct §10-correctness evidence
// ─────────────────────────────────────────────────────────────────────────────
describe('s164 m1 — within-partition grouping-axis Simpsons SUPPRESS (RED-first; s163 narrated each)', () => {
  it('defect 1 — color partition + quantitative SIZE, each (seg,sz) band falls → undefined', () => {
    expect(corr(chart(rowsDefect1(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 1 twin — quantitative DETAIL band instead of size → undefined', () => {
    const rows = rowsDefect1().map((r) => ({ x: r.x, y: r.y, seg: r.seg, d: r.sz }));
    expect(corr(chart(rows, { colorField: 'seg', detailField: 'd', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 2 — quantitative detail n=2 bands (avg) → undefined', () => {
    expect(corr(chart(rowsDefect2(), { colorField: 'seg', detailField: 'd', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 3 — bubble color + quantitative size generalization → undefined', () => {
    expect(corr(chart(rowsDefect1(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 5 — size-only Simpson with NO categorical partition (early-return no longer narrates) → undefined', () => {
    expect(corr(chart(rowsDefect5(), { sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 6 — strong-separation size-only Simpson (each band r=-1, far apart) → undefined', () => {
    expect(corr(chart(rowsDefect6(), { sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 6c — shallow r=-1 bands (perfect fall, small Δ; a magnitude/τ floor would miss) → undefined', () => {
    expect(corr(chart(rowsDefect6cShallow(), { sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 7 — two grouping axes, finest (seg,size,det) shreds, middle (seg,size) falls → undefined', () => {
    expect(corr(chart(rowsDefect7(), { colorField: 'seg', sizeField: 'size', detailField: 'det', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 8 — CASE6 pooled≈0 with opposing size bands (one rises, one falls) → undefined', () => {
    expect(corr(chart(rowsDefect8CASE6(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('defect 9 — nested Simpson: coarse size band falls, finer detail slices rise (COLLECT-EVERY) → undefined', () => {
    expect(corr(chart(rowsDefect9Nested(), { sizeField: 'sz', detailField: 'det', yAggregate: 'average' }))).toBeUndefined();
  });
  it('disjoint-x all-flat offset: two flat bands at disjoint x, pooled rises (clause-3) → undefined', () => {
    expect(corr(chart(rowsDisjointFlat(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('two-axis-all-fall Simpson (every (seg,sz,dt) band falls, pooled rises) → undefined', () => {
    expect(corr(chart(rowsTwoAxisAllFall(), { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' }))).toBeUndefined();
  });
  it('n=2 opposing band amid a sharing band (Δ=-1; an n=2 magnitude gate would miss it) → undefined', () => {
    expect(corr(chart(rowsN2Opposite(), { sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
});

describe('s164 m1 — keep-controls NARRATE (an honest coefficient is not over-suppressed)', () => {
  it('all-rise: every size band rises, pooled rises → defined & positive', () => {
    const r = corr(chart(rowsAllRise(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }));
    expect(r).toBeDefined();
    expect(r).toBeGreaterThan(0);
  });
  it('CASE3-FLAT: rising bands + one exactly-flat band (Δ=0) → defined', () => {
    expect(corr(chart(rowsCase3Flat(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeDefined();
  });
  it('weak-scatter: an n>=3 opposing band with |r|<ρ (below the floor) narrates (residual-1 gray-zone) → defined', () => {
    expect(corr(chart(rowsWeakScatter(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeDefined();
  });
  it('continuous ramp: all-distinct size, both color series fall, pooled falls (honest) → defined & negative', () => {
    const r = corr(chart(rowsContinuousRamp(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }));
    expect(r).toBeDefined();
    expect(r).toBeLessThan(0);
  });
  it('honest multi-axis: every fine (seg,sz,dt) band rises, pooled rises → defined & positive', () => {
    const r = corr(chart(rowsHonestMultiAxis(), { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' }));
    expect(r).toBeDefined();
    expect(r).toBeGreaterThan(0);
  });
});

describe('s164 m1 — ρ is a two-sided dimensionless separator (LOCKED 0.5)', () => {
  it('a cliff/stepped opposing band |r|≈0.655 (>= ρ) SUPPRESSES → undefined', () => {
    expect(corr(chart(rowsRhoCliff(), { sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('a scattered opposing band |r|≈0.3 (< ρ) NARRATES → defined', () => {
    expect(corr(chart(rowsRhoScatter(), { sizeField: 'sz', yAggregate: 'average' }))).toBeDefined();
  });
});

describe('s164 m1 — NON-REGRESSION: G0-suppressed classes stay suppressed (G1 does not flip them to narrate)', () => {
  it('defect 4 — between-partition Simpson + continuous size (the fallback trap): G0 suppresses → undefined', () => {
    expect(corr(chart(rowsDefect4(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });
  it('F5 — stacked-bar Simpson + quant size (bars do not split by size → groupingFields=∅, G1 no-ops) → undefined', () => {
    expect(corr(chart(rowsF5Stacking(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'sum', mark: 'MarkBar' }))).toBeUndefined();
  });
});

describe('s164 m1 — BYTE-IDENTITY: no grouping axis (groupingFields=∅) is unchanged from s163 (G1 no-ops)', () => {
  it('weak-consistent categorical-only partition (no quant retinal) still NARRATES (no ρ over-suppression) → defined', () => {
    expect(corr(chart(rowsWeakConsistentNoGrouping(), { colorField: 'seg' }))).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) MACHINE-ASSERT on the SUT G1 evidence — reverting the runtime G1 moves this
// ─────────────────────────────────────────────────────────────────────────────
describe('s164 m1 — the SUT G1 evidence carries the opposing drawn sub-series (machine-assert; §2-m1)', () => {
  const defects: [string, () => NormalizedVizSpec][] = [
    ['defect1 size', () => chart(rowsDefect1(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })],
    ['defect5 size-only', () => chart(rowsDefect5(), { sizeField: 'sz', yAggregate: 'average' })],
    ['defect6 strong-sep', () => chart(rowsDefect6(), { sizeField: 'sz', yAggregate: 'average' })],
    ['defect7 two-axis', () => chart(rowsDefect7(), { colorField: 'seg', sizeField: 'size', detailField: 'det', yAggregate: 'average' })],
    ['defect9 nested', () => chart(rowsDefect9Nested(), { sizeField: 'sz', detailField: 'det', yAggregate: 'average' })],
  ];
  // These defects pool to a NON-ZERO sign, so suppression is via a vote === −pooledSign (a real opposite).
  // CASE6 (pooled sign 0) suppresses via cross-sign contradiction — covered by its dedicated test below.
  for (const [name, make] of defects) {
    it(`${name}: G1 suppresses AND a collected vote equals −pooledSign (a real opposite)`, () => {
      const ev = correlationOppositionEvidence(make());
      expect(ev.suppresses).toBe(true);
      expect(ev.pooledSign).not.toBe(0);
      expect(ev.votes.includes((-ev.pooledSign) as -1 | 1)).toBe(true);
    });
  }

  it('CASE6 (pooled sign 0): the opposing bands make the votes span BOTH signs → contradiction suppress', () => {
    const ev = correlationOppositionEvidence(chart(rowsDefect8CASE6(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }));
    expect(new Set(ev.votes).size).toBeGreaterThan(1);
    expect(ev.suppresses).toBe(true);
  });

  it('keep-controls: G1 does NOT suppress', () => {
    expect(correlationOppositionEvidence(chart(rowsAllRise(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })).suppresses).toBe(false);
    expect(correlationOppositionEvidence(chart(rowsContinuousRamp(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })).suppresses).toBe(false);
    expect(correlationOppositionEvidence(chart(rowsHonestMultiAxis(), { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' })).suppresses).toBe(false);
  });

  it('no grouping axis → G1 is a no-op (empty evidence, suppresses=false)', () => {
    const ev = correlationOppositionEvidence(chart(rowsWeakConsistentNoGrouping(), { colorField: 'seg' }));
    expect(ev.votes).toEqual([]);
    expect(ev.suppresses).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) INDEPENDENT DRIFT ORACLE (§3, §5 rule 13a) — operand (a) keyed off narratedValueCellKey DIRECTLY,
//     NO classifier-path import. Detects the DIRECT rule-14 property (a real dimensionless opposite among
//     the value-keyed drawn sub-series) and ties the SUT decision to it. Reverting the runtime G1 leaves
//     THIS oracle finding the opposite while the SUT stops suppressing → the two operands diverge.
//
//     s165 m4 CLAIM RE-SCOPE: this oracle covers the VALUE-KEY AXIS ONLY. `narratedValueCellKey` is derived
//     from `drawnCellKeyFields`, which mark-gates `shape`, drops the series fields under stacking, and reads
//     bindings via `resolveBinding` (layer 0 only) — so it is structurally blind to all four s165 survivors.
//     It never was, and is not, evidence that the sub-series ENUMERATION is complete; that is precisely the
//     gap the s164 genuine-close review found. The separability axis is carried by a SECOND decision oracle
//     in correlation-claim-scope-s165.spec.ts, keyed off `separableFields`.
// ─────────────────────────────────────────────────────────────────────────────
const RHO = 0.5;
const signOf = (r: number): -1 | 0 | 1 => (r > 0 ? 1 : r < 0 ? -1 : 0);
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const den = Math.sqrt(dx * dy); return den === 0 ? null : Number((num / den).toFixed(3));
}
const keyOf = (row: Row, fields: string[]) => fields.map((f) => String(row[f])).join('\u0000');
function subsets<T>(a: T[]): T[][] { const out: T[][] = [[]]; for (const x of a) { const n = out.length; for (let i = 0; i < n; i++) out.push([...out[i], x]); } return out; }
// classify a value-keyed drawn sub-series with the SAME dimensionless rule (n>=3 gated on |r|>=ρ; n=2 votes)
function subDirection(cells: [number, number][]): -1 | 0 | 1 | 'unknown' {
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]); const n = xs.length;
  if (n < 2) return 'unknown';
  const mx = xs.reduce((s, v) => s + v, 0) / n; let dx = 0; for (const x of xs) dx += (x - mx) ** 2;
  if (dx === 0) return 'unknown';
  if (n === 2) { const my = (ys[0] + ys[1]) / 2; let cov = 0; for (let i = 0; i < 2; i++) cov += (xs[i] - mx) * (ys[i] - my); return signOf(cov); }
  const r = pearson(xs, ys); if (r === null) return 0; return Math.abs(r) >= RHO ? signOf(r) : 0;
}
// project a value-keyed sub-series' drawn cells: avg y per x when aggregated, else the raw points.
function drawnCells(rows: Row[], keyVal: string, keyFields: string[], agg: 'average' | 'sum' | undefined): [number, number][] {
  const own = rows.filter((r) => keyOf(r, keyFields) === keyVal);
  if (!agg) return own.map((r) => [Number(r.x), Number(r.y)]);
  const byX = new Map<number, number[]>();
  for (const r of own) { const x = Number(r.x); if (!byX.has(x)) byX.set(x, []); byX.get(x)!.push(Number(r.y)); }
  return [...byX.entries()].map(([x, ys]) => [x, ys.reduce((s, v) => s + v, 0) / ys.length]);
}
// operand (a): does any value-keyed drawn sub-series GENUINELY oppose the pooled direction? Enumerates
// subsets of narratedValueCellKey(spec) DIRECTLY (the value source) — never the classifier grouping.
function oracleFindsRealOpposite(spec: NormalizedVizSpec, rows: Row[], agg: 'average' | 'sum' | undefined): { pooledSign: -1 | 0 | 1; opposes: boolean } {
  const valueKey = narratedValueCellKey(spec);
  // pooled over the drawn value cells (keyed by dim ∪ valueKey)
  const cells = drawnValueCells(rows, valueKey, agg);
  const pooled = pearson(cells.map((c) => c[0]), cells.map((c) => c[1]));
  const pooledSign = pooled === null ? 0 : signOf(pooled);
  if (pooledSign === 0) return { pooledSign, opposes: false };
  for (const S of subsets(valueKey)) {
    const keyVals = [...new Set(rows.map((r) => keyOf(r, S)))];
    for (const kv of keyVals) {
      const sub = drawnCells(rows, kv, S, agg);
      if (new Set(sub.map((c) => c[0])).size < 2) continue;
      if (subDirection(sub) === -pooledSign) return { pooledSign, opposes: true };
    }
  }
  return { pooledSign, opposes: false };
}
function drawnValueCells(rows: Row[], valueKey: string[], agg: 'average' | 'sum' | undefined): [number, number][] {
  if (!agg) return rows.map((r) => [Number(r.x), Number(r.y)]);
  const byCell = new Map<string, number[]>();
  const xByCell = new Map<string, number>();
  for (const r of rows) { const k = keyOf(r, ['x', ...valueKey]); if (!byCell.has(k)) { byCell.set(k, []); xByCell.set(k, Number(r.x)); } byCell.get(k)!.push(Number(r.y)); }
  return [...byCell.keys()].map((k) => [xByCell.get(k)!, byCell.get(k)!.reduce((s, v) => s + v, 0) / byCell.get(k)!.length]);
}

describe('s164 m1 — DRIFT ASSERT: SUT suppresses every defect the independent value-keyed oracle flags (§3)', () => {
  const cases: [string, () => Row[], NonNullable<Parameters<typeof chart>[1]>][] = [
    ['defect1', rowsDefect1, { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }],
    ['defect5', rowsDefect5, { sizeField: 'sz', yAggregate: 'average' }],
    ['defect6', rowsDefect6, { sizeField: 'sz', yAggregate: 'average' }],
    ['defect6c', rowsDefect6cShallow, { sizeField: 'sz', yAggregate: 'average' }],
    ['defect7', rowsDefect7, { colorField: 'seg', sizeField: 'size', detailField: 'det', yAggregate: 'average' }],
    ['defect9', rowsDefect9Nested, { sizeField: 'sz', detailField: 'det', yAggregate: 'average' }],
    ['two-axis-all-fall', rowsTwoAxisAllFall, { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' }],
    ['rho-cliff', rowsRhoCliff, { sizeField: 'sz', yAggregate: 'average' }],
  ];
  for (const [name, mkRows, opts] of cases) {
    it(`${name}: oracle finds a real opposite (operand a) AND the SUT decision is undefined (operand b)`, () => {
      const rows = mkRows();
      const spec = chart(rows, opts);
      const oracle = oracleFindsRealOpposite(spec, rows, opts.yAggregate);
      expect(oracle.opposes).toBe(true); // operand (a): independent, value-keyed
      expect(corr(spec)).toBeUndefined(); // operand (b): the SUT
    });
  }

  it('keep-controls: the oracle finds NO real opposite AND the SUT narrates', () => {
    const controls: [() => Row[], NonNullable<Parameters<typeof chart>[1]>][] = [
      [rowsAllRise, { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }],
      [rowsContinuousRamp, { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }],
      [rowsHonestMultiAxis, { colorField: 'seg', sizeField: 'sz', detailField: 'dt', yAggregate: 'average' }],
      [rowsRhoScatter, { sizeField: 'sz', yAggregate: 'average' }],
    ];
    for (const [mkRows, opts] of controls) {
      const rows = mkRows();
      const spec = chart(rows, opts);
      expect(oracleFindsRealOpposite(spec, rows, opts.yAggregate).opposes).toBe(false);
      expect(corr(spec)).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) off-barrel: the new evidence surface is a relative-import proof only
// ─────────────────────────────────────────────────────────────────────────────
describe('s164 m1 — the G1 evidence surface is OFF the public barrel', () => {
  it('correlationOppositionEvidence is not re-exported by @oods/viz-core', () => {
    expect((VizCorePublic as Record<string, unknown>).correlationOppositionEvidence).toBeUndefined();
  });
});
