import { describe, it, expect } from 'vitest';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';
import * as VizCorePublic from '@oods/viz-core';
import { correlationGroupDirections } from './data-analysis.js';

/**
 * s162 m1 — the S1 declared-aggregate Simpson sign-phantom (SSOT §1.1 / §2-m1). RED-first fixture:
 * scratchpad/s161_corr_asymmetry.mjs. At HEAD 8f480ec `deriveCorrelation` classified each partition
 * group's DIRECTION over the count-weighted RAW rows while it pooled the narrated coefficient over the
 * DRAWN aggregated cells; under a declared aggregate with uneven per-x counts the two invert in sign, so
 * the Shape-B guard blessed a pooled sign that CONTRADICTS every drawn series (the exact class the gate
 * exists to suppress). The fix (`classifyCorrelationGroups`) re-projects each raw partition group to its
 * DRAWN cells before taking the sign, so the classifier and the pooled value read the SAME cells.
 *
 * MUTATION GATE (seed site = `classifyCorrelationGroups`' per-group re-projection in data-analysis.ts):
 * bypass it (`const cells = groupRows` — classify the raw group rows) → the two S1 suppress cases + the
 * two [-1,-1] machine-asserts below go RED (4 RED). The 6 corpus keep-controls in
 * test/data-analysis-correlation-direction-s161.spec.ts stay GREEN (no declared aggregate → the per-group
 * projection is the identity → byte-identical to pre-s162).
 */

type Row = { x: number; y: number; seg: string };
const B = (field: string, trait: string, extra: Record<string, unknown> = {}) => ({ field, trait, ...extra });

function pointSpec(
  rows: Row[],
  opts: { colorField?: string; facetColumnField?: string; yAggregate?: 'average' | undefined }
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
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'corr-s162',
    name: 'corr s162',
    data: { name: 'c', values: rows },
    marks: [{ trait: 'MarkPoint', encodings: { ...encoding } }],
    encoding,
    ...(opts.facetColumnField ? { layout: { trait: 'LayoutFacet', columns: { field: opts.facetColumnField } } } : {}),
    a11y: { description: 'y over x' },
  } as unknown as NormalizedVizSpec;
}

// group A drawn cells (avg y): (1,10),(2,-1),(3,0) FALL; group B: (4,30),(5,19),(6,20) FALL.
// RAW within-group (count-weighted) RISES (+0.376) — the asymmetry the fix closes.
function s1Rows(): Row[] {
  const rows: Row[] = [];
  const push = (x: number, y: number, g: string, k: number) => {
    for (let i = 0; i < k; i += 1) rows.push({ x, y, seg: g });
  };
  push(1, 10, 'A', 1);
  push(2, -1, 'A', 100);
  push(3, 0, 'A', 100);
  push(4, 30, 'B', 1);
  push(5, 19, 'B', 100);
  push(6, 20, 'B', 100);
  return rows;
}

const corr = (spec: NormalizedVizSpec) => analyzeVizSpec(spec).correlation;

describe('s162 m1 — declared-aggregate Simpson sign-phantom (S1) SUPPRESSED over the DRAWN cells', () => {
  it('color-grouping arm → undefined (drawn cells fall in both groups; pooled +0.61 is a between-group artifact)', () => {
    expect(corr(pointSpec(s1Rows(), { colorField: 'seg', yAggregate: 'average' }))).toBeUndefined();
  });

  it('facet=column twin → undefined (same partition, same phantom)', () => {
    expect(corr(pointSpec(s1Rows(), { facetColumnField: 'seg', yAggregate: 'average' }))).toBeUndefined();
  });

  it('MACHINE-ASSERT (vacation signature, §2-m1): 2 real groups, both FALLING over their drawn cells', () => {
    const classes = correlationGroupDirections(pointSpec(s1Rows(), { colorField: 'seg', yAggregate: 'average' }));
    // The rejected "partition valueRows" primary collapses every projected cell (which lacks `seg`)
    // into ONE `\0null` group → classes.length === 1 → its single sign self-agrees with the pooled →
    // the 0.612 phantom STILL narrates. The correct RAW-row partition yields one class per real group.
    expect(classes.length).toBeGreaterThan(1);
    expect(classes).toEqual([-1, -1]);
  });

  it('MACHINE-ASSERT facet twin: same [-1,-1] over the drawn cells', () => {
    expect(correlationGroupDirections(pointSpec(s1Rows(), { facetColumnField: 'seg', yAggregate: 'average' }))).toEqual([
      -1, -1,
    ]);
  });
});

describe('s162 m1 — a legit declared-aggregate correlation still NARRATES (classes agree with the pooled)', () => {
  // Drawn cells RISE within each group AND the pooled rises → narrate. Uneven per-x counts exercise the
  // projection; the raw within-group direction is now irrelevant — only the DRAWN cells vote.
  function risingRows(): Row[] {
    const rows: Row[] = [];
    const push = (x: number, y: number, g: string, k: number) => {
      for (let i = 0; i < k; i += 1) rows.push({ x, y, seg: g });
    };
    // A cells (avg): (1,10),(2,20),(3,30) RISE ; B cells: (4,40),(5,50),(6,60) RISE ; pooled y=10x → r=1.
    push(1, 10, 'A', 1);
    push(2, 20, 'A', 50);
    push(3, 30, 'A', 3);
    push(4, 40, 'B', 2);
    push(5, 50, 'B', 1);
    push(6, 60, 'B', 4);
    return rows;
  }

  it('color-grouping → narrates the pooled r (classes = [+1,+1])', () => {
    const spec = pointSpec(risingRows(), { colorField: 'seg', yAggregate: 'average' });
    expect(correlationGroupDirections(spec)).toEqual([1, 1]);
    const r = corr(spec);
    expect(r).toBeDefined();
    expect(r).toBeGreaterThan(0);
  });
});

describe('s162 m1 — no declared aggregate: per-group projection is the IDENTITY (byte-identical to pre-s162)', () => {
  it('classifies the raw rows directly (two rising groups → [+1,+1], narrates)', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A' },
      { x: 2, y: 2, seg: 'A' },
      { x: 3, y: 3, seg: 'A' },
      { x: 1, y: 10, seg: 'B' },
      { x: 2, y: 20, seg: 'B' },
      { x: 3, y: 30, seg: 'B' },
    ];
    const spec = pointSpec(rows, { colorField: 'seg', yAggregate: undefined });
    expect(correlationGroupDirections(spec)).toEqual([1, 1]);
    expect(corr(spec)).toBeGreaterThan(0);
  });
});

describe('s162 m1 — correlationGroupDirections is OFF the public barrel (§2-m1)', () => {
  it('not exported from @oods/viz-core (relative-import proof only, like the drawn-value guard fns)', () => {
    expect((VizCorePublic as Record<string, unknown>).correlationGroupDirections).toBeUndefined();
  });
});
