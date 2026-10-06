import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVizSpecFromRows, toVegaLiteSpec } from '@oods/viz-core';
import type { NormalizedVizSpec, VegaLiteAdapterSpec } from '@oods/viz-core';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { wire } from '../helpers/wire-boundary.js';

vi.mock('@oods/viz-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@oods/viz-core')>();
  return { ...actual, toVegaLiteSpec: vi.fn(actual.toVegaLiteSpec) };
});
const compile = vi.mocked(toVegaLiteSpec);
const originalCompile = compile.getMockImplementation()!;
afterEach(() => { compile.mockImplementation(originalCompile); compile.mockClear(); });
const rows = [{ category: 'One', amount: 8, series: 'First' }, { category: 'Two', amount: 12, series: 'Second' }];
function spec(type: 'nominal' | 'ordinal' = 'nominal'): NormalizedVizSpec {
  return buildVizSpecFromRows({ chartType: 'bar', rows, encodings: { x: 'category', y: 'amount', color: { field: 'series', type } } }).spec;
}
function retain(name: string, request: unknown, result: unknown) {
  if (!process.env.S195_CERTIFY_MEASUREMENT_RECEIPTS) return;
  fs.mkdirSync(process.env.S195_CERTIFY_MEASUREMENT_RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(process.env.S195_CERTIFY_MEASUREMENT_RECEIPTS, name + '.json'), JSON.stringify({ request, result }, null, 2) + '\n');
}
function removeRange(compiled: VegaLiteAdapterSpec): VegaLiteAdapterSpec {
  const changed = structuredClone(compiled) as any;
  const unit = changed.layer ? changed.layer.at(-1) : changed;
  expect(unit.encoding.color.scale.range).toHaveLength(6);
  delete unit.encoding.color.scale.range;
  return changed;
}

describe('missing categorical palette has no measured contrast claim (s195-m06)', () => {
  it.each(['nominal', 'ordinal'] as const)('%s missing bake fails without borrowing the determinism render as contrast evidence', async type => {
    compile.mockImplementation((input, scope) => removeRange(originalCompile(input, scope)));
    const request = wire('artifact.certify', 'input', { spec: spec(type) });
    const result = await certify(request);
    wire('artifact.certify', 'output', result);
    expect(result).toMatchObject({ status: 'ok', coverage: 'certified', conformant: false, pillars: { contrast: 'fail', determinism: 'pass' }, determinism: { stable: true, renderHash: expect.any(String) }, contrastResults: [{ verdict: 'fail', measured: false, evidence: 'none' }] });
    expect(result.contrastNote).toContain('missing its baked palette');
    expect(result).not.toHaveProperty('contrastMeasured');
    retain(type, request, result);
  });

  it('a measured passing sibling cannot turn the missing-palette winner into a measured ratio', async () => {
    const input = spec();
    input.marks = [...input.marks, { trait: 'MarkPoint' }];
    compile.mockImplementation((value, scope) => removeRange(originalCompile(value, scope)));
    const request = wire('artifact.certify', 'input', { spec: input });
    const result = await certify(request);
    wire('artifact.certify', 'output', result);
    expect(result).toMatchObject({ status: 'ok', conformant: false, pillars: { contrast: 'fail', determinism: 'pass' }, contrastResults: [{ measured: false, evidence: 'none' }] });
    expect(result.contrastNote).toContain('missing-palette unit');
    expect(result).not.toHaveProperty('contrastMeasured');
    retain('mixed-layers', request, result);
  });

  it('normal categorical rendering still reports completed render-backed measurement', async () => {
    const request = wire('artifact.certify', 'input', { spec: spec() });
    const result = await certify(request);
    wire('artifact.certify', 'output', result);
    expect(result).toMatchObject({ status: 'ok', conformant: true, contrastResults: [{ verdict: 'pass', measured: true, evidence: 'render' }] });
    expect(result).not.toHaveProperty('contrastMeasured');
    retain('normal-control', request, result);
  });
});
