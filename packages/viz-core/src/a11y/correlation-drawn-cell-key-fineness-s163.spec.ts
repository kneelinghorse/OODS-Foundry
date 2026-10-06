import { describe, it, expect } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import * as VizCorePublic from '@oods/viz-core';
import {
  correlationGroupDirections,
  correlationClassifierActualKey,
  narratedValueCellKey,
} from './data-analysis.js';

/**
 * s163 m1 — the S1-size survivor (SSOT §1 / §2-m1). The s162 correlation direction classifier
 * re-projected each partition group with `groupingFields=[]`, COLLAPSING a quantitative retinal
 * `size` that `drawnCellKeyFields` (hence the narrated VALUE) keys but `correlationPartitionFields`
 * excludes → the classifier was COARSER than the value on the size axis → it voted a direction the
 * DRAWN cells do not have → a Simpson sign-phantom slipped the s162 gate. RED-first probe:
 * `scratchpad/REVIEW_size_asym_independent.mjs` (SUT narrated 0.981 over two falling drawn series).
 *
 * THE FIX (design A, reviewer-literal; §8 Fork-1): partition the raw rows by the FULL `partitionFields`
 * (unchanged) and re-project each group over `groupingFields = drawnCellKeyFields(spec,measure,stacking)
 * \ {dim} \ partitionFields`, so the classifier keys AT LEAST AS FINE as the value
 * (`narratedValueCellKey ⊆ classifier key`). Fixes the size axis AND preserves the s162 stacking
 * suppression (design A partitions by the full categorical series even when stacking drops it from the
 * value key). The rejected design B (intersection + effectivePartition early-return) narrated the
 * stacking case s162 suppresses (critic wf_3eb9fe92-cd8 finding B).
 *
 * MUTATION GATE (seed site = `correlationGroupingFields` in data-analysis.ts): revert it to return `[]`
 * → the size fixture's classifier collapses `sz` → classes `[+1,+1]` → narrates 0.981 → the two S1-size
 * behavioral cases RED, AND the INDEPENDENT drift assert RED (classifier key loses `sz`, so
 * `narratedValueCellKey {seg,sz} ⊄ classifier key {seg}`). The s162 categorical fixtures stay GREEN
 * (grouping already `∅` there) — proving the bite is EXACTLY the size axis.
 */

type Row = Record<string, unknown>;
const B = (field: string, trait: string, extra: Record<string, unknown> = {}) => ({ field, trait, ...extra });

// A MarkPoint scatter with an averaged y, a categorical color partition, and (optionally) a quantitative
// size retinal — the exact shape of the s162 survivor.
function pointSpec(
  rows: Row[],
  opts: {
    colorField?: string;
    facetColumnField?: string;
    sizeField?: string;
    yAggregate?: 'average' | undefined;
  }
): NormalizedVizSpec {
  const y = B('y', 'EncodingY', {
    type: 'quantitative',
    ...(opts.yAggregate ? { aggregate: opts.yAggregate } : {}),
  });
  const encoding: Record<string, unknown> = {
    x: B('x', 'EncodingX', { type: 'quantitative' }),
    y,
  };
  if (opts.colorField) encoding.color = B(opts.colorField, 'EncodingColor');
  if (opts.sizeField) encoding.size = B(opts.sizeField, 'EncodingSize', { type: 'quantitative' });
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'corr-s163',
    name: 'corr s163',
    data: { name: 'c', values: rows },
    marks: [{ trait: 'MarkPoint', encodings: { ...encoding } }],
    encoding,
    ...(opts.facetColumnField
      ? { layout: { trait: 'LayoutFacet', columns: { field: opts.facetColumnField } } }
      : {}),
    a11y: { description: 'y over x' },
  } as unknown as NormalizedVizSpec;
}

// The s162 survivor fixture (REVIEW_size_asym_independent.mjs): each (x, seg, sz) is a distinct drawn
// cell (sz unique per row). Per-seg over the size-keyed DRAWN cells FALLS (-0.34); the size-collapsed
// per-x means RISE (+0.09) — the asymmetry the fix closes. Pooled over all size-keyed cells = +0.981.
function sizeSimpsonRows(): Row[] {
  const rows: Row[] = [];
  const push = (x: number, y: number, g: string, k: number) => {
    for (let i = 0; i < k; i += 1) rows.push({ x, y, seg: g, sz: (g === 'A' ? 0 : 1000) + x * 1000 + i });
  };
  push(1, 0, 'A', 1);
  push(2, 100, 'A', 1);
  push(3, 10, 'A', 100);
  push(4, 200, 'B', 1);
  push(5, 300, 'B', 1);
  push(6, 210, 'B', 100);
  return rows;
}

const corr = (spec: NormalizedVizSpec) => analyzeVizSpec(spec).correlation;

describe('s163 m1 — the size-axis Simpson sign-phantom (S1-size) is SUPPRESSED over the size-keyed drawn cells', () => {
  it('color + quantitative size arm → undefined (drawn size-keyed cells fall in both groups; pooled +0.981 is a between-group artifact)', () => {
    expect(corr(pointSpec(sizeSimpsonRows(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });

  it('facet=column + quantitative size twin → undefined (same partition, same size phantom)', () => {
    expect(corr(pointSpec(sizeSimpsonRows(), { facetColumnField: 'seg', sizeField: 'sz', yAggregate: 'average' }))).toBeUndefined();
  });

  it('MACHINE-ASSERT (behavioral, §2-m1): 2 real groups, both FALLING over their size-keyed drawn cells', () => {
    const classes = correlationGroupDirections(
      pointSpec(sizeSimpsonRows(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' })
    );
    // s162's groupingFields=[] collapses sz → per-x means rise → [+1,+1] → the phantom narrates.
    // design A keeps sz (groupingFields=[sz]) → per-seg over size-keyed cells fall → [-1,-1] → suppress.
    expect(classes).toEqual([-1, -1]);
  });
});

describe('s163 m1 — INDEPENDENT drift assert: the classifier keys AT LEAST AS FINE as the narrated value (§2-m1, §5 rule 13a)', () => {
  // narratedValueCellKey is sourced from `drawnCellKeyFields` (the VALUE path); correlationClassifierActualKey
  // is sourced from the classifier's ACTUAL runtime grouping (`correlationGroupingFields`). The two go through
  // DIFFERENT code, so reverting `correlationGroupingFields` to [] drops `sz` from the classifier key ONLY →
  // `narratedValueCellKey {seg,sz} ⊄ classifier key {seg}` → this assert goes RED (it is NOT a by-construction
  // tautology — that was the s162-draft defect the wf_3eb9fe92-cd8 critic caught).
  it('narratedValueCellKey ⊆ (classifier partition ∪ grouping) for the size fixture', () => {
    const spec = pointSpec(sizeSimpsonRows(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' });
    const valueKey = narratedValueCellKey(spec);
    const actual = correlationClassifierActualKey(spec);
    const classifierKey = new Set([...actual.partitionFields, ...actual.groupingFields]);
    expect(valueKey.length).toBeGreaterThan(0);
    expect(valueKey).toContain('sz'); // the value keys sz (the axis the s162 classifier dropped)
    for (const field of valueKey) {
      expect(classifierKey.has(field)).toBe(true);
    }
    // and the classifier actually re-absorbs the excluded quantitative retinal as a grouping field
    expect(actual.partitionFields).toEqual(['seg']);
    expect(actual.groupingFields).toContain('sz');
  });
});

describe('s163 m1 — STACKING suppression PRESERVED (critic finding B; design A does NOT narrate the stack-total phantom)', () => {
  // Stacked bar, y sum, quantitative x, categorical color=seg with CONFLICTING per-segment directions.
  // Under stacking the VALUE pools stack-totals per x (rise), but design A partitions by the full {seg} →
  // per-segment [-1,+1] disagree → contradiction-first SUPPRESS → undefined (byte-identical to s162).
  // A regression to design B (collapse the series under stacking) would NARRATE the stack-total → this
  // keep-control turns RED.
  function stackedRows(): Row[] {
    return [
      { x: 1, y: 10, seg: 'A' },
      { x: 2, y: 8, seg: 'A' },
      { x: 3, y: 6, seg: 'A' }, // seg A stack band FALLS
      { x: 1, y: 0, seg: 'B' },
      { x: 2, y: 20, seg: 'B' },
      { x: 3, y: 40, seg: 'B' }, // seg B stack band RISES ; stack totals 10/28/46 RISE
    ];
  }
  function stackedBarSpec(): NormalizedVizSpec {
    const encoding: Record<string, unknown> = {
      x: B('x', 'EncodingX', { type: 'quantitative' }),
      y: B('y', 'EncodingY', { type: 'quantitative', aggregate: 'sum' }),
      color: B('seg', 'EncodingColor'),
    };
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'corr-s163-stacked',
      name: 'corr s163 stacked',
      data: { name: 'c', values: stackedRows() },
      marks: [{ trait: 'MarkBar', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'y over x' },
    } as unknown as NormalizedVizSpec;
  }

  it('stacked bar sum + conflicting per-segment directions → correlation undefined (s162 suppression held)', () => {
    expect(corr(stackedBarSpec())).toBeUndefined();
  });
});

describe('s163 m1 — OVER-SUPPRESSION guard: a legit aggregate + quantitative-size correlation still NARRATES (critic lens-2)', () => {
  // >=2 distinct sizes per x with real within-x y-spread (project([sz]) is STRUCTURALLY different from the
  // coarse per-x means), yet each partition group's fine size-keyed cells genuinely RISE and agree with the
  // pooled → design A must NARRATE. Proves the fix does not over-suppress an honest correlation.
  function legitRows(): Row[] {
    const rows: Row[] = [];
    const push = (x: number, y: number, g: string, s: number) => rows.push({ x, y, seg: g, sz: s });
    // seg A: two sizes per x, within-x spread, rising
    push(1, 10, 'A', 1); push(1, 16, 'A', 2);
    push(2, 22, 'A', 1); push(2, 28, 'A', 2);
    push(3, 34, 'A', 1); push(3, 40, 'A', 2);
    // seg B: same shape, shifted up, rising
    push(1, 60, 'B', 1); push(1, 66, 'B', 2);
    push(2, 72, 'B', 1); push(2, 78, 'B', 2);
    push(3, 84, 'B', 1); push(3, 90, 'B', 2);
    return rows;
  }

  it('rising size-keyed cells in both groups + rising pooled → narrates (classes = [+1,+1], correlation defined)', () => {
    const spec = pointSpec(legitRows(), { colorField: 'seg', sizeField: 'sz', yAggregate: 'average' });
    expect(correlationGroupDirections(spec)).toEqual([1, 1]);
    const r = corr(spec);
    expect(r).toBeDefined();
    expect(r).toBeGreaterThan(0);
  });
});

describe('s163 m1 — no declared aggregate: byte-identical to s162 (groupingFields consumed only under an aggregate)', () => {
  it('classifies raw rows directly (two rising groups → [+1,+1], narrates) even with a size channel present', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A', sz: 5 },
      { x: 2, y: 2, seg: 'A', sz: 6 },
      { x: 3, y: 3, seg: 'A', sz: 7 },
      { x: 1, y: 10, seg: 'B', sz: 5 },
      { x: 2, y: 20, seg: 'B', sz: 6 },
      { x: 3, y: 30, seg: 'B', sz: 7 },
    ];
    const spec = pointSpec(rows, { colorField: 'seg', sizeField: 'sz', yAggregate: undefined });
    expect(correlationGroupDirections(spec)).toEqual([1, 1]);
    expect(corr(spec)).toBeGreaterThan(0);
  });
});

describe('s163 m1 — new derivation surfaces are OFF the public barrel', () => {
  it('narratedValueCellKey + correlationClassifierActualKey are relative-import proofs only', () => {
    expect((VizCorePublic as Record<string, unknown>).narratedValueCellKey).toBeUndefined();
    expect((VizCorePublic as Record<string, unknown>).correlationClassifierActualKey).toBeUndefined();
  });
});
