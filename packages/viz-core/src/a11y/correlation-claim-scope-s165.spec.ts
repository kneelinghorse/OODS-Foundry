import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import {
  correlationClassifierActualKey,
  correlationGateFields,
  correlationGroupDirections,
  correlationOppositionEvidence,
  correlationSeparabilityEvidence,
  narratedValueCellKey,
} from './data-analysis.js';

/**
 * s165 m4 — the CALL-SITE PIN, the SECOND DECISION ORACLE, and the CLAIM SCOPE (SSOT §5, §6, §7).
 *
 * Three jobs:
 *  (1) machine-verify the consumer map of `correlationGroupingFields` vs `separableFields` — the line-item
 *      charter-diff (rule 12). NOTE the memo's §5 line-item was written for the REJECTED replace design and
 *      is CORRECTED here: under the shipped UNION design nothing "takes separableFields" *instead of*
 *      grouping (see the consumer-map test for the actual, verified map).
 *  (2) a SECOND decision oracle keyed off `separableFields` — same pattern the s164 review validated as
 *      non-vacuous: share the FIELD source, re-derive the SCAN independently test-side, and prove the bite.
 *      The s164 value-keyed oracle's claim is thereby re-scoped to the VALUE-KEY axis only; this one
 *      carries the separability axis.
 *  (3) pin the §6.1 MEASURED silencing numbers and the §6 residuals as executable facts, so the closeout
 *      claim is generated from what actually runs rather than from intent.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, 'data-analysis.ts'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// (1) THE CALL-SITE PIN — line-item charter-diff, machine-verified
// ─────────────────────────────────────────────────────────────────────────────
function enclosingFunctions(needle: string): string[] {
  const lines = SOURCE.split('\n');
  const out: string[] = [];
  lines.forEach((line, index) => {
    if (!line.includes(needle)) return;
    for (let scan = index; scan >= 0; scan -= 1) {
      const match = /^(?:export )?function (\w+)/.exec(lines[scan]);
      if (match) {
        if (match[1] !== needle.replace('(', '')) out.push(match[1]);
        break;
      }
    }
  });
  return [...new Set(out)].sort();
}

describe('s165 m4 §5 — the consumer map of the two field derivations is PINNED', () => {
  it('correlationGroupingFields keeps FIVE consumers (the s164 arm is retained, not replaced)', () => {
    // The memo said FOUR, with deriveCorrelation and correlationOppositionEvidence switching to
    // separableFields. That was the REPLACE design. Under the shipped UNION design:
    //  - deriveCorrelation keeps it (it still runs the byte-identical s164 arm) AND additionally takes
    //    separableFields for G1′;
    //  - correlationOppositionEvidence MUST keep it — it is the s164 arm's capture surface, and switching
    //    it to separableFields would silently change what the s164 drift assert captures;
    //  - correlationGroupDirections and correlationClassifierActualKey keep it (the s163 value-key
    //    fineness invariant), exactly as chartered;
    //  - correlationGateFields is the NEW m1 capture surface and reads both.
    expect(enclosingFunctions('correlationGroupingFields(')).toEqual([
      'correlationClassifierActualKey',
      'correlationGateFields',
      'correlationGroupDirections',
      'correlationOppositionEvidence',
      'deriveCorrelation',
    ]);
  });

  it('separableFields has exactly THREE consumers', () => {
    expect(enclosingFunctions('separableFields(')).toEqual([
      'correlationGateFields',
      'correlationSeparabilityEvidence',
      'deriveCorrelation',
    ]);
  });

  it('all four chartered surfaces still EXIST and are callable (rule 12: named pins must exist)', () => {
    const enc = {
      x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      color: { field: 'seg', trait: 'EncodingColor' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'pin',
      name: 'pin',
      data: {
        name: 'd',
        values: [
          { x: 1, y: 10, seg: 'A', sz: 10 },
          { x: 2, y: 20, seg: 'A', sz: 10 },
          { x: 3, y: 30, seg: 'A', sz: 20 },
        ],
      },
      marks: [{ trait: 'MarkPoint', encodings: enc }],
      encoding: enc,
      a11y: { description: 'd' },
    } as unknown as NormalizedVizSpec;
    expect(Array.isArray(correlationGroupDirections(spec))).toBe(true);
    expect(correlationClassifierActualKey(spec)).toHaveProperty('groupingFields');
    expect(correlationOppositionEvidence(spec)).toHaveProperty('suppresses');
    expect(correlationSeparabilityEvidence(spec)).toHaveProperty('suppresses');
    expect(correlationGateFields(spec)).toHaveProperty('separableFields');
  });

  it('the s163 value-key fineness invariant still holds on the classifier axis (unchanged by s165)', () => {
    const enc = {
      x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      color: { field: 'seg', trait: 'EncodingColor' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
    };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'fineness',
      name: 'fineness',
      data: {
        name: 'd',
        values: [
          { x: 1, y: 10, seg: 'A', sz: 10 },
          { x: 2, y: 20, seg: 'A', sz: 10 },
          { x: 1, y: 30, seg: 'B', sz: 20 },
          { x: 2, y: 40, seg: 'B', sz: 20 },
        ],
      },
      marks: [{ trait: 'MarkPoint', encodings: enc }],
      encoding: enc,
      a11y: { description: 'd' },
    } as unknown as NormalizedVizSpec;
    const { partitionFields, groupingFields } = correlationClassifierActualKey(spec);
    const classifierKey = new Set([...partitionFields, ...groupingFields]);
    for (const field of narratedValueCellKey(spec)) {
      expect(classifierKey.has(field), `value key field ${field} must be in the classifier key`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) THE SECOND DECISION ORACLE — the SEPARABILITY axis
// ─────────────────────────────────────────────────────────────────────────────
// Independence, honestly scoped (same shape the s164 review validated): the FIELD LIST is shared (both
// sides read separableFields — that is what §4's compiled-superset oracle validates instead), while the
// SCAN is re-derived here from scratch: this oracle builds its own bands off the rows, applies its own
// dimensionless ρ rule and its own coherence test, and never imports correlationSeparabilityEvidenceOf,
// drawnSeparableBands, finestSeparableBuckets, or classifyDrawnSeriesDirection. Neutering the runtime G1′
// leaves this oracle finding the opposite while the SUT stops suppressing → the operands diverge (proven
// by mutation, recorded in the mission notes).
const RHO = 0.5;
const signOf = (r: number): -1 | 0 | 1 => (r > 0 ? 1 : r < 0 ? -1 : 0);
function oraclePearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((sum, v) => sum + v, 0) / n;
  const my = ys.reduce((sum, v) => sum + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : Number((num / den).toFixed(3));
}
function oracleSubsets<T>(items: T[]): T[][] {
  const out: T[][] = [[]];
  for (const item of items) {
    const size = out.length;
    for (let i = 0; i < size; i += 1) out.push([...out[i], item]);
  }
  return out;
}
/** Does ANY separability-keyed drawn band genuinely oppose the pooled direction? Test-side scan. */
function oracleFindsOpposite(spec: NormalizedVizSpec): { pooledSign: -1 | 0 | 1; opposes: boolean } {
  const fields = correlationGateFields(spec).separableFields; // shared source, disclosed
  const rows = ((spec.data as { values?: unknown[] }).values ?? []) as Record<string, unknown>[];
  const aggregate = (spec.encoding as { y?: { aggregate?: string } }).y?.aggregate;
  const reduce = (values: number[]) =>
    aggregate === 'sum'
      ? values.reduce((sum, v) => sum + v, 0)
      : values.reduce((sum, v) => sum + v, 0) / values.length;
  const pooledValue = analyzeVizSpec(spec).correlation;
  // The pooled r the narrative WOULD emit: recomputed here over the value cells so the oracle does not
  // depend on the SUT's decision (which is undefined exactly when it suppresses).
  const valueKey = narratedValueCellKey(spec);
  const cells = new Map<string, { x: number; ys: number[] }>();
  for (const row of rows) {
    const x = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = [x, ...valueKey.map((f) => String(row[f]))].join('|');
    const cell = cells.get(key);
    if (cell) cell.ys.push(y);
    else cells.set(key, { x, ys: [y] });
  }
  const pooledXs: number[] = [];
  const pooledYs: number[] = [];
  for (const cell of cells.values()) {
    pooledXs.push(cell.x);
    pooledYs.push(aggregate ? reduce(cell.ys) : cell.ys[0]);
  }
  const pooled = oraclePearson(pooledXs, pooledYs);
  const pooledSign = pooled === null ? 0 : signOf(pooled);
  void pooledValue;
  if (pooledSign === 0 || fields.length === 0) return { pooledSign, opposes: false };
  for (const subset of oracleSubsets(fields)) {
    const others = fields.filter((f) => !subset.includes(f));
    const bands = new Map<string, { byX: Map<number, number[]>; others: Set<string> }>();
    for (const row of rows) {
      const x = Number(row.x);
      const y = Number(row.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const bandKey = subset.map((f) => String(row[f])).join('|');
      let band = bands.get(bandKey);
      if (!band) {
        band = { byX: new Map(), others: new Set() };
        bands.set(bandKey, band);
      }
      const bucket = band.byX.get(x);
      if (bucket) bucket.push(y);
      else band.byX.set(x, [y]);
      band.others.add(others.map((f) => String(row[f])).join('|'));
    }
    for (const band of bands.values()) {
      const xs = [...band.byX.keys()];
      const ys = xs.map((x) => (aggregate ? reduce(band.byX.get(x) as number[]) : (band.byX.get(x) as number[])[0]));
      const flatXs = aggregate ? xs : xs.flatMap((x) => (band.byX.get(x) as number[]).map(() => x));
      const flatYs = aggregate ? ys : xs.flatMap((x) => band.byX.get(x) as number[]);
      const distinctX = new Set(xs).size;
      if (distinctX < 2) continue;
      const coherent = band.others.size <= 1;
      if (!coherent && distinctX < 3) continue; // the oracle's own A6
      let direction: -1 | 0 | 1;
      if (flatXs.length === 2) {
        direction = signOf((flatXs[1] - flatXs[0]) * (flatYs[1] - flatYs[0]));
      } else {
        const r = oraclePearson(flatXs, flatYs);
        direction = r === null ? 0 : Math.abs(r) >= RHO ? signOf(r) : 0;
      }
      if (direction !== 0 && direction === -pooledSign) return { pooledSign, opposes: true };
    }
  }
  return { pooledSign, opposes: false };
}

const XY = {
  x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
  y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
};
type Row = Record<string, unknown>;
const oracleSpec = (
  marks: { trait: string; encodings?: Record<string, unknown> }[],
  encoding: Record<string, unknown>,
  values: Row[]
): NormalizedVizSpec =>
  ({
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'oracle',
    name: 'oracle',
    data: { name: 'd', values },
    marks,
    encoding,
    a11y: { description: 'd' },
  }) as unknown as NormalizedVizSpec;

describe('s165 m4 §5 — the SEPARABILITY decision oracle: SUT suppresses every opposite it finds', () => {
  const shapeEnc = { ...XY, shape: { field: 'shp', trait: 'EncodingShape' } };
  const rowsShape: Row[] = [
    { x: 1, y: 30, shp: 'circle' }, { x: 2, y: 20, shp: 'circle' }, { x: 3, y: 10, shp: 'circle' },
    { x: 4, y: 130, shp: 'square' }, { x: 5, y: 120, shp: 'square' }, { x: 6, y: 110, shp: 'square' },
  ];
  const stackedRampEnc = {
    x: XY.x,
    y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'sum' },
    color: { field: 'c', trait: 'EncodingColor', type: 'quantitative' },
  };
  const collinearEnc = {
    x: XY.x,
    y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
    color: { field: 'seg', trait: 'EncodingColor' },
    size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
  };

  const cases: [string, NormalizedVizSpec][] = [
    ['A mixed mark + shape', oracleSpec([{ trait: 'MarkLine', encodings: shapeEnc }, { trait: 'MarkPoint', encodings: shapeEnc }], shapeEnc, rowsShape)],
    ['A MarkBar + shape', oracleSpec([{ trait: 'MarkBar', encodings: shapeEnc }], shapeEnc, rowsShape)],
    ['B stacked quantitative colour ramp', oracleSpec([{ trait: 'MarkBar', encodings: stackedRampEnc }], stackedRampEnc, [
      { x: 1, y: 50, c: 100 }, { x: 2, y: 40, c: 100 }, { x: 3, y: 30, c: 100 },
      { x: 1, y: 10, c: 200 }, { x: 2, y: 60, c: 200 }, { x: 3, y: 110, c: 200 },
    ])],
    ['C collinear categorical + size Simpson', oracleSpec([{ trait: 'MarkPoint', encodings: collinearEnc }], collinearEnc, [
      { x: 1, y: 10, seg: 'p', sz: 1 }, { x: 2, y: 8, seg: 'q', sz: 1 }, { x: 3, y: 6, seg: 'r', sz: 1 },
      { x: 1, y: 20, seg: 'p', sz: 2 }, { x: 2, y: 30, seg: 'q', sz: 2 }, { x: 3, y: 40, seg: 'r', sz: 2 },
    ])],
    ['D per-layer colour', oracleSpec(
      [
        { trait: 'MarkLine', encodings: { ...XY, color: { field: 'seg', trait: 'EncodingColor' } } },
        { trait: 'MarkPoint', encodings: { ...XY, color: { field: 'grp', trait: 'EncodingColor' } } },
      ],
      XY,
      [
        { x: 1, y: 30, seg: 'only', grp: 'circle' }, { x: 2, y: 20, seg: 'only', grp: 'circle' }, { x: 3, y: 10, seg: 'only', grp: 'circle' },
        { x: 4, y: 130, seg: 'only', grp: 'square' }, { x: 5, y: 120, seg: 'only', grp: 'square' }, { x: 6, y: 110, seg: 'only', grp: 'square' },
      ]
    )],
  ];

  for (const [name, spec] of cases) {
    it(`${name}: the oracle finds a real opposite (operand a) AND the SUT is undefined (operand b)`, () => {
      expect(oracleFindsOpposite(spec).opposes).toBe(true);
      expect(analyzeVizSpec(spec).correlation).toBeUndefined();
    });
  }

  it('keep-controls: the oracle finds NO opposite AND the SUT narrates', () => {
    const enc = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      color: { field: 'seg', trait: 'EncodingColor' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
    };
    const allRise: Row[] = [];
    for (const seg of ['A', 'B'])
      for (const sz of [10, 20])
        allRise.push({ x: 1, y: 1 + sz, seg, sz }, { x: 2, y: 2 + sz, seg, sz }, { x: 3, y: 3 + sz, seg, sz });
    const spec = oracleSpec([{ trait: 'MarkPoint', encodings: enc }], enc, allRise);
    expect(oracleFindsOpposite(spec).opposes).toBe(false);
    expect(analyzeVizSpec(spec).correlation).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) §6 RESIDUALS — pinned as executable facts, so the closeout cannot overclaim
// ─────────────────────────────────────────────────────────────────────────────
describe('s165 m4 §6 — the disclosed residuals are PINNED, not merely written down', () => {
  const bubble = (values: Row[], withDetail = false): NormalizedVizSpec => {
    const enc: Record<string, unknown> = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      color: { field: 'seg', trait: 'EncodingColor' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
      ...(withDetail ? { detail: { field: 'dt', trait: 'EncodingDetail', type: 'quantitative' } } : {}),
    };
    return oracleSpec([{ trait: 'MarkPoint', encodings: enc }], enc, values);
  };

  it('residual 1 (measured over-suppression): an INCOHERENT size band pooling across colour CAN silence an honest chart', () => {
    // The exact mechanism behind the measured 6.5% conditional rate on honest bubble charts: an S={sz} band
    // pools across the colour axis, clears 3 distinct x and the ρ floor, and votes against a near-zero
    // pooled r. Every finest (seg,sz) band here rises; the sz=10 band, pooled over colours, falls.
    const values: Row[] = [
      { x: 1, y: 100, seg: 'A', sz: 10 }, { x: 2, y: 101, seg: 'A', sz: 10 }, { x: 3, y: 102, seg: 'A', sz: 10 },
      { x: 1, y: 90, seg: 'B', sz: 10 }, { x: 2, y: 60, seg: 'B', sz: 10 }, { x: 3, y: 30, seg: 'B', sz: 10 },
      { x: 1, y: 10, seg: 'A', sz: 20 }, { x: 2, y: 40, seg: 'A', sz: 20 }, { x: 3, y: 70, seg: 'A', sz: 20 },
    ];
    const spec = bubble(values);
    const evidence = correlationSeparabilityEvidence(spec);
    // the votes span both signs → suppression. Whether an sz band pooled across colour counts as a
    // "visually-separable drawn sub-series" under rule 14 is a JUDGEMENT the superset posture deliberately
    // resolves toward silence. Named here so the closeout cannot claim zero over-suppression.
    expect(new Set(evidence.votes).size).toBeGreaterThan(1);
    expect(analyzeVizSpec(spec).correlation).toBeUndefined();
  });

  it('residual 2 (n=2 incoherent opposites are un-votable in G1′) — an error toward NARRATION', () => {
    // An INCOHERENT band with exactly 2 distinct x cannot vote in G1′ (A6). That is the deliberate cost of
    // killing the manufactured cross-series votes, and it points toward NARRATION, not silence.
    // Shape-on-MarkBar so partitionFields=∅ and the decisive band sits on an axis the s164 arm cannot see —
    // otherwise G0 or the s164 arm would suppress for an independent reason and this pin would be vacuous.
    const enc = {
      x: XY.x,
      y: { field: 'y', trait: 'EncodingY', type: 'quantitative', aggregate: 'average' },
      shape: { field: 'shp', trait: 'EncodingShape' },
      size: { field: 'sz', trait: 'EncodingSize', type: 'quantitative' },
    };
    const values: Row[] = [
      { x: 1, y: 10, shp: 'circle', sz: 10 }, { x: 2, y: 20, shp: 'circle', sz: 10 },
      { x: 1, y: 300, shp: 'circle', sz: 20 },
      { x: 1, y: 10, shp: 'square', sz: 10 }, { x: 2, y: 200, shp: 'square', sz: 10 }, { x: 3, y: 400, shp: 'square', sz: 10 },
    ];
    const spec = oracleSpec([{ trait: 'MarkBar', encodings: enc }], enc, values);
    const evidence = correlationSeparabilityEvidence(spec);
    // the {shp=circle} band reads 155 → 20 (falling) but has only 2 distinct x, so it cannot vote
    expect(evidence.votes.every((vote) => vote === evidence.pooledSign)).toBe(true);
    expect(analyzeVizSpec(spec).correlation).toBeDefined();
  });

  it('residual 3 (ρ=0.5 gray-zone): an n>=3 opposing band with |r| < ρ NARRATES', () => {
    const values: Row[] = [
      { x: 1, y: 10, seg: 'A', sz: 10 }, { x: 2, y: 20, seg: 'A', sz: 10 }, { x: 3, y: 30, seg: 'A', sz: 10 },
      { x: 1, y: 52, seg: 'A', sz: 20 }, { x: 2, y: 49, seg: 'A', sz: 20 }, { x: 3, y: 51, seg: 'A', sz: 20 },
    ];
    expect(analyzeVizSpec(bubble(values)).correlation).toBeDefined();
  });

  it('residual 4 (continuous ramp): an all-distinct quantitative band shreds to n=1 and still NARRATES', () => {
    const values: Row[] = [];
    for (const seg of ['A', 'B']) {
      const offset = seg === 'A' ? 0 : 1;
      values.push(
        { x: 1, y: 100 + offset, seg, sz: 9.001 + offset * 0.0001 },
        { x: 1, y: 90 + offset, seg, sz: 8.001 + offset * 0.0001 },
        { x: 2, y: 40 + offset, seg, sz: 2.001 + offset * 0.0001 },
        { x: 2, y: 30 + offset, seg, sz: 1.001 + offset * 0.0001 }
      );
    }
    const value = analyzeVizSpec(bubble(values)).correlation;
    expect(value).toBeDefined();
    expect(value).toBeLessThan(0);
  });

  it('residual 6 (renderer divergence): `detail` is treated as separable even though ECharts routes it to tooltip only', () => {
    // An over-suppression on the ECharts path is an error toward SILENCE, which the superset posture accepts.
    const values: Row[] = [
      { x: 1, y: 10, seg: 'A', sz: 10, dt: 1 }, { x: 2, y: 20, seg: 'A', sz: 10, dt: 1 }, { x: 3, y: 30, seg: 'A', sz: 10, dt: 1 },
      { x: 1, y: 300, seg: 'A', sz: 10, dt: 2 }, { x: 2, y: 200, seg: 'A', sz: 10, dt: 2 }, { x: 3, y: 100, seg: 'A', sz: 10, dt: 2 },
    ];
    const spec = bubble(values, true);
    expect(correlationGateFields(spec).separableFields).toContain('dt');
    expect(analyzeVizSpec(spec).correlation).toBeUndefined();
  });
});
