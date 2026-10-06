// s176 m02 — RENDER-BACKED DETERMINISM (memo §1b).
//
// Before this mission the determinism pillar was a COMPILE proof only —
// canonicalize(toVegaLiteSpec(spec)) twice, string-equal — and the fold comment conceded
// "`stable` is inert (a pure compile is always byte-stable)". Now the cartesian pillar
// carries a render half: sha256(renderVegaLiteToSvg(compiled)) twice, equal, with the
// contrast grade's own render reused as the first hash and the SECOND render being the
// proof (the "KEEP the second call" discipline, render edition). The first hash is
// reported as the OPTIONAL determinism.renderHash, present when server rendering succeeds, including contrast-exempt charts. Operand-backed ECharts calls now
// carry their sibling normalized-SVG proof; ECharts {spec}-only calls still do not render.
//
// What these tests pin: presence conditions on both sides, renderHash stability across
// calls, contentHash IMMOVABILITY (the render never feeds it — D7), and schema validity
// with the widened-but-closed determinism object.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalize, sha256 } from '@oods/artifacts';
import { buildVizSpecFromRows, toVegaLiteSpec, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle } from '../../src/tools/artifact.certify.js';
import { echartsPrimaryIr } from './s172-spec-only-cases.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

const certify = (input: Record<string, unknown>) => handle(input as never);

const ROWS3 = [
  { region: 'North', quarter: 'Q1', revenue: 100 },
  { region: 'South', quarter: 'Q1', revenue: 120 },
  { region: 'East', quarter: 'Q1', revenue: 90 },
];

const barSpec = (): NormalizedVizSpec =>
  buildVizSpecFromRows({
    rows: ROWS3,
    chartType: 'bar',
    encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
  }).spec;

/**
 * A cartesian chart whose ONLY color-bearing unit is CASE-3 exempt (no render happens):
 * the divergence-binding shape the existing exempt-keeps-conformant test uses — a built
 * multi-series spec whose color trait the bake gate leaves quantitative, so the compiled
 * spec bakes no categorical range.
 */
const exemptSpec = (): NormalizedVizSpec => {
  const built = buildVizSpecFromRows({
    rows: ROWS3,
    chartType: 'bar',
    encodings: {
      x: { field: 'quarter' },
      y: { field: 'revenue', aggregate: 'sum' },
      color: { field: 'region' },
    } as never,
  }).spec as unknown as { encoding: Record<string, unknown> };
  built.encoding = { ...built.encoding, color: { field: 'region', trait: 'EncodingDetail' } };
  return built as unknown as NormalizedVizSpec;
};

describe('artifact.certify — render-backed determinism (s176 m02)', () => {
  it('a rendered-graded cartesian chart carries renderHash (64-hex), stable, conformant, schema-valid', async () => {
    const out = await certify({ spec: barSpec() });
    expect(out.status).toBe('ok');
    expect(out.coverage).toBe('certified');
    expect(out.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
    // The double-render proof held: stable folds compile AND render byte-equality.
    expect(out.determinism?.stable).toBe(true);
    expect(out.pillars?.determinism).toBe('pass');
    expect(out.conformant).toBe(true);
    expect(validateOutput(out)).toBe(true);
  });

  it('contentHash is UNMOVED by the render half — still the untouched compile hash, never fed by the render (D7)', async () => {
    const spec = barSpec();
    const out = await certify({ spec });
    expect(out.determinism?.contentHash).toBe(sha256(canonicalize(toVegaLiteSpec(spec))));
    expect(out.determinism?.contentHash).not.toBe(out.determinism?.renderHash);
  });

  it('renderHash is itself deterministic: two certify calls report the same hash', async () => {
    const a = await certify({ spec: barSpec() });
    const b = await certify({ spec: barSpec() });
    expect(a.determinism?.renderHash).toBe(b.determinism?.renderHash);
  });

  it('a contrast-exempt cartesian chart still proves rendered determinism for its public pixels', async () => {
    const out = await certify({ spec: exemptSpec() });
    expect(out.status).toBe('ok');
    expect(out.pillars?.contrast).toBe('exempt');
    expect(out.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.determinism?.stable).toBe(true);
    expect(out.conformant).toBe(true);
    expect(validateOutput(out)).toBe(true);
  });

  it('ECharts {spec}-only has no determinism while a renderable operand carries the option and normalized-render hashes', async () => {
    const specOnly = await certify({ spec: echartsPrimaryIr('MarkTreemap', 'treemap') });
    expect(specOnly.status).toBe('ok');
    expect(specOnly.coverage).toBe('uncertified');
    expect(specOnly.determinism).toBeUndefined();

    const dataBacked = await certify({
      spec: echartsPrimaryIr('MarkTreemap', 'treemap'),
      data: {
        chartType: 'treemap',
        hierarchy: {
          type: 'adjacency_list',
          data: [
            { id: 'root', parentId: null, value: 0, name: 'R' },
            { id: 'a', parentId: 'root', value: 5, name: 'A' },
            { id: 'b', parentId: 'root', value: 3, name: 'B' },
          ],
        },
      },
    });
    expect(dataBacked.status).toBe('ok');
    expect(dataBacked.coverage).toBe('certified');
    expect(Object.keys(dataBacked.determinism ?? {})).toEqual([
      'stable',
      'contentHash',
      'renderHash',
    ]);
    expect(dataBacked.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
    expect(validateOutput(dataBacked)).toBe(true);
  });
});
