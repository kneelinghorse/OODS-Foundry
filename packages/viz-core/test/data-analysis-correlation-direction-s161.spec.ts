import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVizSpec, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-161 m2 — c1+c2: the correlation per-group DIRECTION classifier + contradiction-first
// narratability predicate (SSOT §2-m2). Kills the s160 review's B1 mixed-computability phantom, the
// §1a critic-caught opposing-pooled-0 phantom, and the all-flat phantom, WHILE keeping all 6 corpus
// fixtures narrating their exact grounded values. Every case is asserted END-TO-END through the
// public analyzeVizSpec (which also runs the shared guard arm expectedNarratableCorrelation), so
// these double as the MUTATION GATE: neuter the step-2 contradiction check → B1 + opposing-pooled-0
// go RED; neuter the step-3 all-flat check → all-flat goes RED; neuter the pooled-vs-common-sign
// check → F-SIMPSON goes RED; drop the classifier's zero-x-variance UNKNOWN short-circuit → the
// vertical-n=2 case goes RED (a vertical pair mis-scores as FLAT and manufactures a contradiction);
// drop the finite-filter → the NaN-measure case goes RED. Every expected r below is a hand oracle.
// ============================================================================

type Row = Record<string, unknown>;

function scatterSpec(rows: Row[], opts: { colorField?: string; facetRowField?: string } = {}): NormalizedVizSpec {
  const encoding: Record<string, unknown> = {
    x: { field: 'x', trait: 'EncodingX', type: 'quantitative' },
    y: { field: 'y', trait: 'EncodingY', type: 'quantitative' },
  };
  if (opts.colorField) {
    encoding.color = { field: opts.colorField, trait: 'EncodingColor' };
  }
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'corr',
    name: 'corr',
    data: { name: 'c', values: rows },
    marks: [{ trait: 'MarkPoint', encodings: { ...encoding } }],
    encoding,
    ...(opts.facetRowField ? { layout: { trait: 'LayoutFacet', rows: { field: opts.facetRowField } } } : {}),
    a11y: { description: 'y over x' },
  } as unknown as NormalizedVizSpec;
}

const corr = (spec: NormalizedVizSpec) => analyzeVizSpec(spec).correlation;

describe('s161 m2 — B1 mixed-computability Simpson phantom is SUPPRESSED', () => {
  // Group A (1,1)(2,3)(3,4): n=3, hand r ≈ +0.982 (RISING). Groups B/C/D each n=2 FALLING
  // (110→109, 220→219, 330→329). Pooled hand r ≈ +0.998. s160 dropped the n=2 groups (pearson null)
  // → only A voted → NARRATED "strong positive"; 6 of 9 drawn points fall. The classifier scores the
  // n=2 groups by slope sign (−1) → evidence {+1,−1} → contradiction → SUPPRESS.
  const rows: Row[] = [
    { x: 1, y: 1, segment: 'A' }, { x: 2, y: 3, segment: 'A' }, { x: 3, y: 4, segment: 'A' },
    { x: 10, y: 110, segment: 'B' }, { x: 11, y: 109, segment: 'B' },
    { x: 20, y: 220, segment: 'C' }, { x: 21, y: 219, segment: 'C' },
    { x: 30, y: 330, segment: 'D' }, { x: 31, y: 329, segment: 'D' },
  ];

  it('color-series partition → undefined', () => {
    expect(corr(scatterSpec(rows, { colorField: 'segment' }))).toBeUndefined();
  });

  it('faceted twin → undefined (same partition)', () => {
    expect(corr(scatterSpec(rows, { facetRowField: 'segment' }))).toBeUndefined();
  });
});

describe('s161 m2 — all-flat zero-variance groups + directional pooled is SUPPRESSED (CORR-EDGE-2)', () => {
  // Three color series, each CONSTANT y (10/10/10, 20/20/20, 30/30/30) rising in LEVEL with x.
  // Pooled hand r = 180/√36000 ≈ +0.949 ("strong positive"). Every group is FLAT (zero y-variance →
  // pearson null → classifier FLAT(0)). s160 vacated all three (pearson null) → NARRATED. The
  // classifier votes FLAT for each → common sign 0 while pooled is directional → between-group
  // artifact → SUPPRESS.
  const rows: Row[] = [
    { x: 1, y: 10, segment: 'A' }, { x: 2, y: 10, segment: 'A' }, { x: 3, y: 10, segment: 'A' },
    { x: 4, y: 20, segment: 'B' }, { x: 5, y: 20, segment: 'B' }, { x: 6, y: 20, segment: 'B' },
    { x: 7, y: 30, segment: 'C' }, { x: 8, y: 30, segment: 'C' }, { x: 9, y: 30, segment: 'C' },
  ];

  it('color-series → undefined', () => {
    expect(corr(scatterSpec(rows, { colorField: 'segment' }))).toBeUndefined();
  });

  it('faceted → undefined', () => {
    expect(corr(scatterSpec(rows, { facetRowField: 'segment' }))).toBeUndefined();
  });
});

describe('s161 m2 — F-SIMPSON facet reversal stays SUPPRESSED (regression guard)', () => {
  // Three panels, each DESCENDING (r=−1): A(1,10)(2,9)(3,8), B(11,20)(12,19)(13,18), C(21,30)(22,29)
  // (23,28). Across panels both x and y rise → pooled hand r ≈ +0.98. Groups all −1, pooled +1 →
  // Simpson reversal → SUPPRESS.
  const rows: Row[] = [
    { x: 1, y: 10, panel: 'A' }, { x: 2, y: 9, panel: 'A' }, { x: 3, y: 8, panel: 'A' },
    { x: 11, y: 20, panel: 'B' }, { x: 12, y: 19, panel: 'B' }, { x: 13, y: 18, panel: 'B' },
    { x: 21, y: 30, panel: 'C' }, { x: 22, y: 29, panel: 'C' }, { x: 23, y: 28, panel: 'C' },
  ];

  it('faceted → undefined', () => {
    expect(corr(scatterSpec(rows, { facetRowField: 'panel' }))).toBeUndefined();
  });
});

describe('s161 m2 — P4 exact-zero group beside a positive group stays SUPPRESSED (do-NOT-touch, now pinned)', () => {
  // Group Z (1,1)(2,2)(3,1): hand r = 0 EXACTLY → FLAT(0). Group A (4,4)(5,5)(6,6): r=+1. Pooled
  // hand r ≈ +0.925. Evidence {0,+1} → contradiction → SUPPRESS. (s160 already suppressed this via
  // pearson-0; the classifier preserves it and this test coverage-backs the §1 "do NOT touch".)
  const rows: Row[] = [
    { x: 1, y: 1, segment: 'Z' }, { x: 2, y: 2, segment: 'Z' }, { x: 3, y: 1, segment: 'Z' },
    { x: 4, y: 4, segment: 'A' }, { x: 5, y: 5, segment: 'A' }, { x: 6, y: 6, segment: 'A' },
  ];

  it('color-series → undefined', () => {
    expect(corr(scatterSpec(rows, { colorField: 'segment' }))).toBeUndefined();
  });
});

describe('s161 m2 — the sign-neutral pin SPLIT (§1a: no pin may assert the phantom)', () => {
  // (i) pooled rounds to 0 + NO directional evidence → NARRATE. Four points, each its OWN color group
  // (all n=1 → UNKNOWN), arranged so the pooled hand r = 0 exactly: (1,1)(2,2)(3,2)(4,1) → Σdxdy=0.
  // Vacuous-pass: with nothing to contradict, the pooled (0) narrates.
  it('(i) pooled-0 + empty evidence → NARRATES 0', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A' }, { x: 2, y: 2, seg: 'B' }, { x: 3, y: 2, seg: 'C' }, { x: 4, y: 1, seg: 'D' },
    ];
    expect(corr(scatterSpec(rows, { colorField: 'seg' }))).toBe(0);
  });

  // (ii) pooled rounds to 0 + OPPOSING directional groups → SUPPRESS. Group A rising (+1), group B
  // falling (−1), symmetric so pooled hand r = 0. The old s160 `pooledSign===0 → narrate` branch (and
  // any naive rewrite that checks pooled-0 BEFORE the contradiction) would NARRATE this Simpson
  // sign-cancellation over a clearly-structured chart. Contradiction-FIRST suppresses it.
  it('(ii) pooled-0 + opposing groups → undefined (the §1a phantom the pin must not assert)', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A' }, { x: 2, y: 2, seg: 'A' }, { x: 3, y: 3, seg: 'A' },
      { x: 1, y: 3, seg: 'B' }, { x: 2, y: 2, seg: 'B' }, { x: 3, y: 1, seg: 'B' },
    ];
    expect(corr(scatterSpec(rows, { colorField: 'seg' }))).toBeUndefined();
  });
});

describe('s161 m2 — the classifier never leaks a false vote (vertical / non-finite groups → UNKNOWN)', () => {
  // A vertical 2-point group (same x) has NO direction — it must be UNKNOWN, not FLAT. Group A rises
  // (+1); group B is vertical (x=5 twice). If B mis-scored as FLAT(0) (the covariance of a vertical
  // pair is 0), evidence would be {+1,0} → false contradiction → suppress. The zero-x-variance
  // short-circuit keeps B UNKNOWN so the honest +1 narrates. Pooled hand r over the 5 finite pairs
  // (1,1)(2,2)(3,3)(5,1)(5,9) = 12.8/√(12.8·44.8) ≈ +0.535.
  it('vertical n=2 group is UNKNOWN → the directional group still narrates (+0.535)', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A' }, { x: 2, y: 2, seg: 'A' }, { x: 3, y: 3, seg: 'A' },
      { x: 5, y: 1, seg: 'B' }, { x: 5, y: 9, seg: 'B' },
    ];
    expect(corr(scatterSpec(rows, { colorField: 'seg' }))).toBe(0.535);
  });

  // A group whose measure is non-finite (null / NaN / Infinity) contributes NO finite pairs → UNKNOWN
  // — and, critically, signOf never sees NaN (the finite-filter runs before any mean/covariance math).
  // Group A rises (+1) over its 3 finite pairs = the only pooled evidence → narrates +1, no NaN.
  it('non-finite-measure group is UNKNOWN, no NaN leak → narrates +1', () => {
    const rows: Row[] = [
      { x: 1, y: 1, seg: 'A' }, { x: 2, y: 2, seg: 'A' }, { x: 3, y: 3, seg: 'A' },
      { x: 10, y: null, seg: 'B' }, { x: 11, y: 'n/a', seg: 'B' }, { x: 12, y: Infinity, seg: 'B' },
    ];
    const r = corr(scatterSpec(rows, { colorField: 'seg' }));
    expect(r).toBe(1);
    expect(Number.isNaN(r)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// KEEP-CONTROLS — the 6 correlation-narrating corpus fixtures keep their EXACT grounded values
// (byte-identical pre-fix vs post-fix, verified live). scatter-chart carries an author a11y.narrative
// override so its EMITTED text is masked — the honesty invariant is analysis.correlation, pinned here.
// A corpus file move fails this loudly (a moved fixture cannot silently hollow the keep-control).
// ---------------------------------------------------------------------------
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
function loadCorpus(rel: string): NormalizedVizSpec {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as NormalizedVizSpec;
}

describe('s161 m2 — corpus keep-controls: all 6 correlation fixtures narrate their grounded values', () => {
  const cases: [string, number][] = [
    ['examples/viz/scatter-chart.spec.json', -0.985], // author-override-masked; pin the analysis value
    ['examples/viz/patterns-v2/correlation-scatter.spec.json', -0.979],
    ['examples/viz/patterns/correlation-scatter.spec.json', -0.979],
    ['examples/viz/patterns-v2/linked-brush-scatter.spec.json', 0.901],
    ['examples/viz/patterns-v2/bubble-distribution.spec.json', 0.736],
    ['examples/viz/patterns/bubble-distribution.spec.json', 0.736],
  ];
  for (const [rel, expected] of cases) {
    it(`${rel} narrates ${expected}`, () => {
      expect(corr(loadCorpus(rel))).toBe(expected);
    });
  }
});
