import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, generateNarrativeSummary, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-156 m06 — the dashboard aggregate-panel GROUP-BY PROJECTION property
// harness (NASA #3, SSOT memo §3 m06). CLAIM-ON-POSITIVE-EVIDENCE: when the
// measure carries a DECLARED aggregate and a dimension is present, the rendered
// chart draws ONE reduced value per distinct dimension value (Vega aggregates on
// the visual side). The a11y analysis must describe THOSE values — not the raw
// pre-aggregation rows the dashboard forwards.
//
// RED-FIRST: at HEAD (before the analyzeVizSpec projection) these properties FAIL —
// P1 because the raw per-row extrema differ from the grouped reduction (raw East=60
// vs grouped East=110), and P2 because a count/distinct over a NON-NUMERIC measure
// yields 0 dataPoints → <2 keyFindings → a false A11Y-R-11. The projection turns
// them GREEN across the WHOLE enumerated space.
//
// ANTI-TAUTOLOGY: the oracle `reduceGroup` is a STANDALONE test-side reducer that
// reads only the raw values + the aggregate name. It NEVER calls analyzeVizSpec or
// any code under test, so a property passing is independent evidence.
//
// NO NEW DEPENDENCY (frozen-lockfile): the space is a hand-rolled DETERMINISTIC
// cartesian enumeration — aggregate{7} × cardinality{1,2,3} × measure{numeric,
// non-numeric} — exhaustive over a finite bounded space.
// ============================================================================

const AGGREGATES = ['sum', 'count', 'average', 'min', 'max', 'median', 'distinct'] as const;
type Aggregate = (typeof AGGREGATES)[number];
type MeasureKind = 'numeric' | 'nonNumeric';

const DIM_FIELD = 'region';
const MEASURE_FIELD = 'orders';
// Distinct group SIZES (1/2/3 rows) so count/distinct strictly increase with the
// dimension index — no ties, so max = last dim and min = first dim unambiguously.
const NUMERIC_GROUPS: Record<string, number[]> = {
  West: [10],
  East: [50, 60],
  North: [90, 100, 110],
};
const NONNUMERIC_GROUPS: Record<string, string[]> = {
  West: ['a'],
  East: ['b', 'c'],
  North: ['d', 'e', 'f'],
};
const DIMS = ['West', 'East', 'North'] as const;

// ---- test-side oracle (independent of the SUT) -----------------------------
function reduceGroup(values: readonly unknown[], aggregate: Aggregate): number | undefined {
  if (aggregate === 'count') return values.length;
  if (aggregate === 'distinct') {
    const s = new Set<string>();
    for (const v of values) if (v !== null && v !== undefined) s.add(String(v));
    return s.size;
  }
  const numeric = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  // sum/avg/min/max/median need numeric data — a group with none is honestly undefined
  // (you cannot sum/average strings), so it drops out rather than reporting a phantom 0.
  if (numeric.length === 0) return undefined;
  if (aggregate === 'sum') return numeric.reduce((a, b) => a + b, 0);
  if (aggregate === 'average') return numeric.reduce((a, b) => a + b, 0) / numeric.length;
  if (aggregate === 'min') return Math.min(...numeric);
  if (aggregate === 'max') return Math.max(...numeric);
  const sorted = [...numeric].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function groupsFor(kind: MeasureKind): Record<string, unknown[]> {
  return kind === 'numeric' ? NUMERIC_GROUPS : NONNUMERIC_GROUPS;
}

function rowsFor(cardinality: number, kind: MeasureKind): Record<string, unknown>[] {
  const groups = groupsFor(kind);
  const rows: Record<string, unknown>[] = [];
  for (const dim of DIMS.slice(0, cardinality)) {
    for (const value of groups[dim]) {
      rows.push({ [DIM_FIELD]: dim, [MEASURE_FIELD]: value });
    }
  }
  return rows;
}

// One oracle point per distinct dimension, in first-appearance order, dropping a
// group whose reduction is undefined (avg/min/max/median over a non-numeric group).
function oraclePoints(cardinality: number, kind: MeasureKind, aggregate: Aggregate): { label: string; value: number }[] {
  const groups = groupsFor(kind);
  const points: { label: string; value: number }[] = [];
  for (const dim of DIMS.slice(0, cardinality)) {
    const reduced = reduceGroup(groups[dim], aggregate);
    if (reduced !== undefined) points.push({ label: dim, value: reduced });
  }
  return points;
}

function aggSpec(cardinality: number, kind: MeasureKind, aggregate: Aggregate): NormalizedVizSpec {
  const y = { field: MEASURE_FIELD, trait: 'EncodingY', aggregate };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'agg-panel',
    name: 'Aggregate Panel',
    data: { name: 'panel', values: rowsFor(cardinality, kind) },
    marks: [
      {
        trait: 'MarkBar',
        encodings: {
          x: { field: DIM_FIELD, trait: 'EncodingX', scale: 'band' },
          y: { ...y },
        },
      },
    ],
    encoding: {
      x: { field: DIM_FIELD, trait: 'EncodingX', scale: 'band' },
      y: { ...y },
    },
    a11y: { description: 'Aggregated measure by region.' },
  } as NormalizedVizSpec;
}

// Same rows + shape, WITHOUT a declared aggregate — the fail-safe (P3) control.
function rawSpec(cardinality: number, kind: MeasureKind): NormalizedVizSpec {
  const y = { field: MEASURE_FIELD, trait: 'EncodingY' };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'raw-panel',
    name: 'Raw Panel',
    data: { name: 'panel', values: rowsFor(cardinality, kind) },
    marks: [
      {
        trait: 'MarkBar',
        encodings: {
          x: { field: DIM_FIELD, trait: 'EncodingX', scale: 'band' },
          y: { ...y },
        },
      },
    ],
    encoding: {
      x: { field: DIM_FIELD, trait: 'EncodingX', scale: 'band' },
      y: { ...y },
    },
    a11y: { description: 'Raw measure by region.' },
  } as NormalizedVizSpec;
}

describe('s156 m06 property P1 — dataPoints parity with the group-by reduction', () => {
  for (const aggregate of AGGREGATES) {
    for (const cardinality of [1, 2, 3]) {
      for (const kind of ['numeric', 'nonNumeric'] as MeasureKind[]) {
        it(`${aggregate} × card=${cardinality} × ${kind}: extrema/total match the grouped reduction`, () => {
          const analysis = analyzeVizSpec(aggSpec(cardinality, kind, aggregate));
          const points = oraclePoints(cardinality, kind, aggregate);
          if (points.length === 0) {
            // A group with no numeric values (avg/min/max/median over non-numeric) → no dataPoints.
            expect(analysis.max).toBeUndefined();
            expect(analysis.min).toBeUndefined();
            expect(analysis.total).toBeUndefined();
            return;
          }
          const values = points.map((p) => p.value);
          const expectedMax = points.reduce((a, b) => (b.value > a.value ? b : a));
          const expectedMin = points.reduce((a, b) => (b.value < a.value ? b : a));
          expect(analysis.max?.value).toBe(expectedMax.value);
          expect(analysis.max?.label).toBe(expectedMax.label); // human-readable LABEL string
          expect(analysis.min?.value).toBe(expectedMin.value);
          expect(analysis.min?.label).toBe(expectedMin.label);
          expect(analysis.total).toBe(values.reduce((a, b) => a + b, 0));
        });
      }
    }
  }
});

describe('s156 m06 property P2 — closure: ≥2 groups ⇒ ≥2 keyFindings (R-11 passes, incl. count/distinct over non-numeric)', () => {
  for (const aggregate of AGGREGATES) {
    for (const cardinality of [2, 3]) {
      for (const kind of ['numeric', 'nonNumeric'] as MeasureKind[]) {
        const points = oraclePoints(cardinality, kind, aggregate);
        // Closure is claimed only where the reduction is defined (a sum/avg/min/max/median over a
        // non-numeric measure is a malformed spec — no honest extrema exist to report).
        if (points.length < 2) continue;
        it(`${aggregate} × card=${cardinality} × ${kind}: ≥2 keyFindings`, () => {
          const { keyFindings } = generateNarrativeSummary(aggSpec(cardinality, kind, aggregate));
          expect(keyFindings.length).toBeGreaterThanOrEqual(2);
        });
      }
    }
  }
});

describe('s156 m06 property P3 — fail-safe: NO declared aggregate ⇒ raw per-row analysis (unchanged)', () => {
  for (const cardinality of [2, 3]) {
    it(`card=${cardinality} numeric: extrema/total are the RAW per-row values (projection does not fire)`, () => {
      const rows = rowsFor(cardinality, 'numeric');
      const rawValues = rows.map((r) => Number(r[MEASURE_FIELD]));
      const analysis = analyzeVizSpec(rawSpec(cardinality, 'numeric'));
      expect(analysis.max?.value).toBe(Math.max(...rawValues));
      expect(analysis.min?.value).toBe(Math.min(...rawValues));
      expect(analysis.total).toBe(rawValues.reduce((a, b) => a + b, 0));
      expect(analysis.rowCount).toBe(rows.length);
    });
  }
});
