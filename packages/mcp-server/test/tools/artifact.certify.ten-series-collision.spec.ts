// s176 m01 — THE TEN-SERIES COLLISION RED-FIRST SPEC (memo §0 / §1a D10).
//
// The defect this sprint exists to close, measured live on :4466 at pristine 4f64bcf
// (PS-2026-08-23-002): a 10-series bar chart built through Forge's own builder compiles
// with a six-hex baked categorical range and NO domain, so Vega recycles — series 7–10
// repeat colours 1–4, four colliding series pairs at the pixel level — and
// artifact.certify returned coverage:'certified', conformant:true, all four pillars
// 'pass', findings:[]. Forge generated the chart, chose the palette, exhausted it, and
// certified its own output conformant with zero findings.
//
// RED at HEAD 4f64bcf: certify grades the sliced DISTINCT palette (certify-contrast.ts
// CATEGORICAL_SLOTS cap), so the recycled series-to-paint ASSIGNMENT — where the ΔE00=0
// pairs live — never reaches the grader, and the conformant:false assertions below fail.
// GREEN after m01: the graded object becomes the rendered series-to-paint assignment
// (duplicates retained), and the recycled pair fails through the EXISTING role-A branch
// (ΔE00 = 0 < ROLE_A_FAIL_DELTA_E) — no new verdict semantics, no new threshold (D3).
//
// Assertion shape read off the existing output pins (artifact.certify.spec.ts:161-182,
// the s140 [B] conformant-rollup lock; the role-A note format at certify-contrast.ts's
// role-A fail branch) — never assumed (the s175 m05 lesson).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalize, sha256 } from '@oods/artifacts';
import { buildVizSpecFromRows, toVegaLiteSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle } from '../../src/tools/artifact.certify.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

// Isolate Role A from the corrected light/A Role-C failure (#1852). s222-m02 (#2502 ruling 12): the isolating canvas is
// white, brand A's light canvas since m01; the recipe holds every slot to 3:1 on it with little margin (gold 3.03:1), so
// the old near-white #FCFCFD put slots 02 and 06 under 3:1 and Role C, not Role A, failed.
const roleASpec = (spec: unknown) => ({ ...(spec as NormalizedVizSpec), config: { tokens: { '--oods-sys-surface-canvas': '#FFFFFF' } } });
const certify = (spec: unknown) => handle({ spec: roleASpec(spec) });

/** N distinct series, one row each — consumed categorical cardinality = N. */
const seriesRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    quarter: 'Q1',
    revenue: 100 + i,
    series: `S${String(i + 1).padStart(2, '0')}`,
  }));

const buildSeriesBar = (n: number): NormalizedVizSpec =>
  buildVizSpecFromRows({
    rows: seriesRows(n),
    chartType: 'bar',
    encodings: {
      x: { field: 'quarter' },
      y: { field: 'revenue', aggregate: 'sum' },
      color: { field: 'series' },
    } as never,
  }).spec;

/** The baked categorical range of the compiled spec's top-level color scale. */
const bakedRange = (spec: NormalizedVizSpec): string[] => {
  const compiled = toVegaLiteSpec(spec) as {
    encoding?: { color?: { scale?: { range?: unknown; domain?: unknown } } };
  };
  const scale = compiled.encoding?.color?.scale;
  if (!scale || !Array.isArray(scale.range)) throw new Error('no baked color range');
  // The recycling mechanism needs BOTH halves: a finite range AND no domain (Vega then
  // maps series i -> range[i mod range.length]).
  expect(scale.domain).toBeUndefined();
  return scale.range as string[];
};

describe('artifact.certify — the §0 ten-series palette-recycling collision (RED-first, s176 m01)', () => {
  it('MECHANISM (in-test, independent of the verdict): 10 consumed series over a 6-hex domainless baked range', () => {
    const range = bakedRange(buildSeriesBar(10));
    expect(range).toHaveLength(6);
    expect(new Set(seriesRows(10).map((r) => r.series)).size).toBe(10);
    // 10 series over 6 hexes -> series 7-10 recycle hexes 1-4: four ΔE00=0 pairs rendered.
  });

  it('a 10-series chart with four recycled series pairs must NOT certify conformant (RED at 4f64bcf)', async () => {
    const out = await certify(buildSeriesBar(10));
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    // The collision is a rendered-reality contrast failure through the EXISTING role-A
    // branch: a recycled pair is ΔE00 = 0 < 2 (D3 — no new threshold, no new enum).
    expect(out.pillars?.contrast).toBe('fail');
    expect(out.contrastNote).toContain('Role-A fail: min-pairwise CIEDE2000');
    expect(out.contrastNote).toContain('= 0.00 < 2');
    // The s140 [B] rollup lock: contrast:'fail' pulls the folded gate false.
    expect(out.conformant).toBe(false);
    // Decoupled pillars: the collision is a contrast fact, nothing else moves.
    expect(out.pillars?.a11yEquivalence).toBe('pass');
    expect(out.pillars?.determinism).toBe('pass');
    expect(out.pillars?.accuracy).toBe('pass');
    expect(validateOutput(out)).toBe(true);
  });

  it('contentHash is the untouched compile hash — the render feeds grading, never the hash (D7)', async () => {
    const spec = buildSeriesBar(10);
    const out = await certify(spec);
    expect(out.determinism?.contentHash).toBe(sha256(canonicalize(toVegaLiteSpec(roleASpec(spec)))));
    expect(out.determinism?.stable).toBe(true);
  });

  it('CONTROL: a 6-series chart (no recycling) passes every pillar and stays conformant', async () => {
    const out = await certify(buildSeriesBar(6));
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    expect(out.pillars).toEqual({
      a11yEquivalence: 'pass',
      determinism: 'pass',
      contrast: 'pass',
      accuracy: 'pass',
    });
    expect(out.conformant).toBe(true);
    expect(out.findings).toEqual([]);
    expect(validateOutput(out)).toBe(true);
  });
});
