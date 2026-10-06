import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows } from '../builder/spec-builder.js';
import { toVegaLiteSpec } from '../adapters/vega-lite-adapter.js';
import { validateNormalizedVizSpec, type NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { applyPatternPresentation, PatternTranslationError, translatePattern, VIZ_PATTERN_SOURCES } from './translate-pattern.js';

const ROOT = path.resolve(import.meta.dirname, '../../../../');
const renderable = new Set([
  'simple-bar', 'stacked-bar', 'stacked-100-bar', 'diverging-bar', 'running-total-area',
  'correlation-scatter', 'time-grid-heatmap', 'correlation-matrix',
].map(id => `pattern:viz:${id}`));
const simple = (): NormalizedVizSpec => structuredClone(VIZ_PATTERN_SOURCES.find(row => row.id === 'pattern:viz:simple-bar')!.spec);

describe('authored pattern translation (s195-m03)', () => {
  it('bundles every exact source identity and byte hash so portable callers need no examples directory', () => {
    const files = readdirSync(path.join(ROOT, 'examples/viz/patterns-v2')).filter(file => file.endsWith('.spec.json')).sort();
    expect(files).toHaveLength(23);
    expect(VIZ_PATTERN_SOURCES.map(row => path.basename(row.specPath))).toEqual(files);
    expect(new Set(VIZ_PATTERN_SOURCES.map(row => row.id)).size).toBe(23);
    for (const row of VIZ_PATTERN_SOURCES) {
      const bytes = readFileSync(path.join(ROOT, row.specPath), 'utf8');
      expect(row.specSha256, row.id).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(row.spec, row.id).toEqual(JSON.parse(bytes));
      expect(row.id, row.specPath).toBe(row.spec.id);
      expect(row.portability, row.id).toEqual(row.spec.portability);
    }
    expect(VIZ_PATTERN_SOURCES.find(row => row.id === 'pattern:viz:linked-brush-scatter')?.baseChartType).toBe('scatter');
    expect(() => translatePattern('cohort-scatter')).toThrow(PatternTranslationError);
    expect(() => translatePattern('simple-bar')).toThrow('Unknown pattern identity');
  });

  it.each(VIZ_PATTERN_SOURCES.map(row => [row.id, row] as const))('%s preserves source semantics or reports its exact unsupported structure', (id, row) => {
    const before = structuredClone(row.spec);
    const result = translatePattern(id);
    expect(result).toEqual(translatePattern(row.spec));
    expect(result).toEqual(translatePattern(id));
    expect(row.spec).toEqual(before);
    expect(result.baseChartType).toBe(row.baseChartType);
    expect(result.status).toBe(renderable.has(id) ? 'renderable' : id.endsWith('linked-brush-scatter') ? 'retired' : 'scene');
    if (result.status === 'retired') { expect(result.reasons[0]).toContain('keyboard'); return; }
    if (result.status === 'scene') {
      expect(result.spec.marks).toHaveLength(row.spec.marks.length);
      expect(result.spec.layout).toEqual(row.spec.layout);
      expect(result.spec.interactions).toEqual(row.spec.interactions);
      expect(validateNormalizedVizSpec(result.spec).valid).toBe(true);
      return;
    }
    if (result.status === 'authoring-only') {
      expect(result.reasons.length).toBeGreaterThan(0);
      if (row.spec.layout) expect(result.reasons.some(reason => reason.startsWith('layout:'))).toBe(true);
      if (row.spec.interactions?.length) expect(result.reasons.some(reason => reason.startsWith('interactions:'))).toBe(true);
      if (row.spec.marks.length > 1) expect(result.reasons.some(reason => reason.startsWith('marks:'))).toBe(true);
      expect(result).not.toHaveProperty('explicitInput');
      return;
    }

    const raw = buildVizSpecFromRows(result.explicitInput).spec;
    const pristine = structuredClone(raw);
    const resolved = applyPatternPresentation(raw, result.presentation);
    expect(raw).toEqual(pristine);
    expect(resolved).not.toBe(raw);
    expect(validateNormalizedVizSpec(resolved)).toEqual({ valid: true, errors: [] });
    expect(resolved.data.values).toEqual(row.spec.data.values);
    expect(resolved.id).toBe(id);
    expect(resolved.config).toEqual(row.spec.config);
    expect(resolved.a11y).toMatchObject(row.spec.a11y);
    expect(resolved.portability).toMatchObject(row.spec.portability!);
    expect(resolved.marks[0].options).toEqual(row.spec.marks[0].options);
    for (const [channel, binding] of Object.entries({ ...row.spec.encoding, ...row.spec.marks[0].encodings })) {
      expect((resolved.encoding as Record<string, unknown>)[channel], `${id}/${channel}`).toMatchObject(binding);
    }
    const compiled = toVegaLiteSpec(resolved) as unknown as Record<string, any>;
    expect(compiled.width).toBe(row.spec.config!.layout!.width);
    expect(compiled.height).toBe(row.spec.config!.layout!.height);
    expect(compiled.padding).toBe(row.spec.config!.layout!.padding);
    expect(compiled.description).toBe(row.spec.a11y.description);
    expect(resolved).toEqual(applyPatternPresentation(raw, result.presentation));
  });

  it('keeps curve, baseline, aggregation and legend semantics in compiled output', () => {
    const compile = (id: string) => {
      const result = translatePattern(`pattern:viz:${id}`);
      if (result.status !== 'renderable') throw new Error(`Expected explicit translation; got ${result.status}`);
      return toVegaLiteSpec(applyPatternPresentation(buildVizSpecFromRows(result.explicitInput).spec, result.presentation)) as any;
    };
    const area = compile('running-total-area');
    expect(area.mark.interpolate).toBe('monotone');
    expect(area.encoding.y.scale.zero).toBe(true);
    expect(area.data.values.map((row: { arr: number }) => row.arr)).toEqual([140, 180, 220, 270, 310, 345, 390]);
    expect(compile('stacked-bar').encoding.y.aggregate).toBe('sum');
    expect(compile('stacked-bar').encoding.color.legend.title).toBe('Work Category');
    expect(compile('diverging-bar').encoding.x.scale.zero).toBe(true);
    expect(compile('correlation-matrix').encoding.color.scale.domainMid).toBe(0);
    const shares = compile('stacked-100-bar').data.values as Array<{ share: number }>;
    expect(shares.map(row => row.share)).toEqual([0.52, 0.28, 0.2, 0.41, 0.33, 0.26, 0.37, 0.42, 0.21]);
  });

  it.each([
    ['transforms', (spec: NormalizedVizSpec) => { spec.transforms = [{ type: 'filter', params: { field: 'headcount', value: 10 } }]; }, 'transforms:'],
    ['named datasets', (spec: NormalizedVizSpec) => { spec.datasets = { detail: [{ value: 10 }] }; }, 'datasets:'],
    ['mark data source', (spec: NormalizedVizSpec) => { spec.marks[0].from = 'detail'; }, 'marks.from:'],
    ['external data', (spec: NormalizedVizSpec) => { spec.data = { url: 'https://example.invalid/data.json' }; }, 'data:'],
    ['unmapped mark option', (spec: NormalizedVizSpec) => { spec.marks[0].options = { inventedStyle: 'unmapped' }; }, 'marks.options.inventedStyle:'],
    ['unknown mark', (spec: NormalizedVizSpec) => { spec.marks[0].trait = 'MarkUnknown'; }, 'marks.trait:'],
  ] as const)('does not silently flatten newly authored %s into a known renderable id', (_label, change, reasonPrefix) => {
    const spec = simple();
    change(spec);
    const result = translatePattern(spec);
    expect(result.status).toBe('authoring-only');
    if (result.status === 'authoring-only') expect(result.reasons.some(reason => reason.startsWith(reasonPrefix))).toBe(true);
  });

  it('requires x/y and bounded rows before entering the public explicit path', () => {
    const spec = simple();
    delete spec.encoding.y;
    delete spec.marks[0].encodings!.y;
    const missing = translatePattern(spec);
    expect(missing.status).toBe('authoring-only');
    if (missing.status === 'authoring-only') expect(missing.reasons).toContain('encoding: the public explicit translation requires both x and y bindings.');
    spec.data.values = Array.from({ length: 5001 }, () => ({ department: 'A', headcount: 1 }));
    const large = translatePattern(spec);
    expect(large.status).toBe('authoring-only');
    if (large.status === 'authoring-only') expect(large.reasons.some(reason => reason.startsWith('data:'))).toBe(true);
  });

  it('keeps returned inputs, presentation and applied IR isolated between requests', () => {
    const initial = translatePattern('pattern:viz:running-total-area');
    if (initial.status !== 'renderable') throw new Error('Expected area support');
    const expected = structuredClone(initial);
    const raw = buildVizSpecFromRows(initial.explicitInput).spec;
    const applied = applyPatternPresentation(raw, initial.presentation);
    applied.config!.layout!.padding = 999;
    applied.data.values![0].arr = 999;
    initial.explicitInput.rows[0].arr = -1;
    initial.presentation.a11y.description = 'Caller-local mutation';
    expect(translatePattern('pattern:viz:running-total-area')).toEqual(expected);
    expect(raw.config).toBeUndefined();
  });

  it('refuses to apply presentation to an already-composed multi-mark IR', () => {
    const result = translatePattern('pattern:viz:simple-bar');
    if (result.status !== 'renderable') throw new Error('Expected bar support');
    const built = buildVizSpecFromRows(result.explicitInput).spec;
    built.marks.push(structuredClone(built.marks[0]));
    expect(() => applyPatternPresentation(built, result.presentation)).toThrow('fresh single-mark');
  });
});
