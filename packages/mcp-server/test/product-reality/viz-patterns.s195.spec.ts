import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { translatePattern } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { getDefinition } from '../../src/errors/registry.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import type { VizRenderInput } from '../../src/schemas/generated.js';
import { repositoryRoot, wire } from '../helpers/wire-boundary.js';

const directory = path.join(repositoryRoot, 'examples/viz/patterns-v2');
const sources = fs.readdirSync(directory).filter(file => file.endsWith('.spec.json')).sort().map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')));
const supported = ['simple-bar', 'stacked-bar', 'stacked-100-bar', 'diverging-bar', 'running-total-area', 'correlation-scatter', 'time-grid-heatmap', 'correlation-matrix'].map(id => `pattern:viz:${id}`);
const retired = ['pattern:viz:linked-brush-scatter'];
const scenes = sources.map(source => source.id as string).filter(id => !supported.includes(id) && !retired.includes(id));
const inputSchema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'packages/mcp-server/src/schemas/viz.render.input.json'), 'utf8'));
const validate = getAjv().getSchema(inputSchema.$id) ?? getAjv().compile(inputSchema);
const request = (pattern: string) => ({ pattern, output: { svg: true, includeNormalizedSpec: true, includeA11y: true } }) as VizRenderInput;
const sourceFor = (id: string) => sources.find(source => source.id === id)!;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function retain(name: string, value: unknown): void {
  if (!process.env.S195_PATTERN_HANDLER_RECEIPTS) return;
  fs.mkdirSync(process.env.S195_PATTERN_HANDLER_RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(process.env.S195_PATTERN_HANDLER_RECEIPTS, name + '.json'), JSON.stringify(value, null, 2) + '\n');
}

describe('viz.render registered pattern wire boundary (s195-m03)', () => {
  // s222-m02 (#2502 ruling 12, I47): the retired pattern stays a source (the taxonomy and pattern registry keep its
  // reason) but leaves the input enum, so viz.render offers only what it renders: sources minus the retired.
  it('offers the 22 renderable source identities; the retired one stays a source, not an option', () => {
    expect(inputSchema.properties.pattern.enum).toEqual(sources.map(source => source.id).filter(id => !retired.includes(id)).sort());
    expect(sources).toHaveLength(23);
    expect(supported).toHaveLength(8);
    expect(retired).toHaveLength(1);
    for (const id of retired) expect(validate(request(id)), id).toBe(false);
  });

  it.each(supported)('%s renders source data and presentation into real pixels and certifiable IR', async id => {
    const input = wire('viz.render', 'input', request(id));
    const before = JSON.stringify(input);
    const result = wire('viz.render', 'output', await render(input));
    const source = sourceFor(id);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(result.mode).toBe('explicit');
    expect(result.svg).toMatch(/^<svg\b/);
    expect(result.svg).toMatch(/<(path|rect|circle)\b/);
    expect(result.svgHash).toBe(hash(result.svg!));
    expect(result.svg).toContain(source.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    const normalized = result.normalizedSpec as any;
    expect(normalized.id).toBe(source.id);
    expect(normalized.name).toBe(source.name);
    expect(normalized.data.values).toEqual(source.data.values);
    expect(normalized.config).toEqual(source.config);
    expect(normalized.portability).toEqual(source.portability);
    expect(normalized.a11y).toMatchObject(source.a11y);
    expect(normalized.encoding).toMatchObject(source.encoding);
    for (const [index, mark] of source.marks.entries()) {
      expect(normalized.marks[index].trait).toBe(mark.trait);
      if (mark.options) expect(normalized.marks[index].options).toMatchObject(mark.options);
    }
    expect(result.a11yDescription).toBe(source.a11y.description);
    expect(result.a11y!.narrative!.summary).toBe(source.a11y.narrative.summary);
    expect(result.a11y!.narrative!.keyFindings).toEqual(source.a11y.narrative.keyFindings);
    expect(result.a11y!.table!.caption).toBe(source.a11y.tableFallback.caption);
    expect(result.a11y!.table!.columns.map(column => column.field)).toEqual(source.portability.tableColumnOrder);
    const compiled = result.spec as any;
    expect({ width: compiled.width, height: compiled.height, padding: compiled.padding }).toEqual(source.config.layout);
    expect(compiled.title).toBe(source.name);
    expect(compiled.description).toBe(source.a11y.description);
    for (const [channel, binding] of Object.entries(source.encoding) as Array<[string, any]>) {
      expect(compiled.encoding[channel].field).toBe(binding.field);
      if (binding.legend) expect(compiled.encoding[channel].legend).toEqual(binding.legend);
      if (binding.title) expect(compiled.encoding[channel].title).toBe(binding.title);
      if (binding.aggregate) expect(compiled.encoding[channel].aggregate).toBe(binding.aggregate);
    }
    if (id === 'pattern:viz:running-total-area') {
      expect(compiled.mark.interpolate).toBe('monotone');
      expect(compiled.encoding.y.scale.zero).toBe(true);
    }
    const grade = wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', { spec: normalized })));
    expect(grade.determinism?.renderHash).toBe(result.svgHash);
    expect(JSON.stringify(input)).toBe(before);
    retain(id.split(':').at(-1)!, { input, result, certify: grade });
  });

  it.each(retired)('%s retains its exact retirement as V174 with no public pixels', async id => {
    const translated = translatePattern(id);
    expect(translated.status).toBe('retired');
    if (translated.status !== 'retired') throw new Error('Expected retired source');
    expect(translated.reasons.length).toBeGreaterThan(0);
    // The input schema no longer offers it (above); a caller that skips the schema still gets the served reason.
    const result = wire('viz.render', 'output', await render(request(id)));
    expect(result.status).toBe('error');
    expect(result.errors).toEqual([{ code: 'OODS-V174', message: `viz.render: pattern "${id}" is retired: ${translated.reasons.join('; ')}`, severity: 'error' }]);
    for (const key of ['svg', 'svgHash', 'contentHash', 'normalizedSpec', 'specRef']) expect(result).not.toHaveProperty(key);
    expect(getDefinition('OODS-V174')).toMatchObject({ category: 'validation', retryable: false });
    retain(id.split(':').at(-1)!, { input: request(id), result });
  });

  it.each(scenes)('%s preserves the authored scene and certifies the same SVG operand', async id => {
    const result = wire('viz.render', 'output', await render(wire('viz.render', 'input', request(id))));
    const source = sourceFor(id), normalized = result.normalizedSpec as any;
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(normalized.data.values).toEqual(source.data.values);
    expect(normalized.layout).toEqual(source.layout);
    expect(normalized.interactions).toEqual(source.interactions);
    expect(normalized.marks).toHaveLength(source.marks.length);
    for (const [index, mark] of source.marks.entries()) expect(normalized.marks[index]).toMatchObject(mark);
    const grade = await certify({ spec: normalized });
    expect(grade.conformant, JSON.stringify(grade)).toBe(true);
    expect(grade.determinism?.renderHash).toBe(result.svgHash);
    if (source.interactions?.length) expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'OODS-V175' }));
  });

  it('draws histogram heights proportional to frequency rather than equal-height range ticks', async () => {
    const result = await render(request('pattern:viz:histogram'));
    const paths = [...result.svg!.matchAll(/<path[^>]*aria-roledescription="bar"[^>]*>/g)].map(match => match[0]);
    const rows = sourceFor('pattern:viz:histogram').data.values;
    expect(paths).toHaveLength(rows.length);
    const geometry = paths.map(tag => {
      const path = /d="M([\d.-]+),([\d.e+-]+)h([\d.e+-]+)v([\d.e+-]+)/.exec(tag)!;
      expect(path, tag).not.toBeNull();
      return { y: Number(path[2]), width: Number(path[3]), height: Number(path[4]) };
    });
    const maxHeight = Math.max(...geometry.map(rect => rect.height));
    for (const [index, rect] of geometry.entries()) {
      expect(rect.height / maxHeight).toBeCloseTo(rows[index].count / 12, 8);
      expect(rect.y + rect.height).toBeCloseTo(360, 8);
      expect(rect.width).toBeGreaterThan(0);
    }
  });

  const conflictingFields: Array<[string, unknown]> = [
    ['chartType', 'bar'], ['encodings', {}], ['rows', [{}]], ['datasetRef', 'expired-dataset'],
    ['intent', { goal: 'comparison', measures: [{ name: 'amount' }], dimensions: [] }],
    ['hierarchy', { type: 'nested', data: { name: 'root' } }],
    ['sankey', { nodes: [{ name: 'a' }, { name: 'b' }], links: [{ source: 'a', target: 'b', value: 1 }] }],
    ['chord', { nodes: [{ name: 'a' }, { name: 'b' }], links: [{ source: 'a', target: 'b', value: 1 }] }],
    ['network', { nodes: [{ id: 'a' }], links: [] }], ['geo', {}],
    ['id', ''], ['name', ''], ['description', ''], ['opacity', 0],
  ];
  it.each(conflictingFields)('lets pattern + %s reach the handler and rejects the conflict before data resolution', async (field, value) => {
    const input = wire('viz.render', 'input', { ...request('pattern:viz:simple-bar'), [field]: value });
    const result = wire('viz.render', 'output', await render(input));
    expect(result.status).toBe('error');
    expect(result.errors).toEqual([{ code: 'OODS-V166', message: `viz.render: pattern cannot be combined with ${field}; the source identity, data and presentation must remain intact.`, severity: 'error' }]);
    expect(result).not.toHaveProperty('svg');
    expect(getDefinition('OODS-V166')).toMatchObject({ category: 'validation', retryable: true });
    retain('conflict-' + field, { input, result });
  });

  it('reports every conflict even for a retired identity without invoking another rendering mode', async () => {
    const input = { ...request(retired[0]!), rows: [{}], chartType: 'treemap', opacity: 0 } as VizRenderInput;
    const result = wire('viz.render', 'output', await render(input));
    expect(result.errors?.[0]).toMatchObject({ code: 'OODS-V166', message: expect.stringContaining('chartType, rows, opacity') });
  });

  it.each([{}, { pattern: '' }, { pattern: 'simple-bar' }, { pattern: 'pattern:viz:unknown' }, { pattern: null }, { pattern: 1 }])('rejects missing or invalid pattern input %j at AJV', input => {
    expect(validate(structuredClone(input))).toBe(false);
  });

  it('preserves existing explicit data requirements without a pattern', () => {
    for (const input of [{ chartType: 'bar' }, { rows: [{}], datasetRef: 'data' }, { chartType: 'treemap', rows: [{}] }]) expect(validate(input)).toBe(false);
    expect(validate({ chartType: 'bar', rows: [{ x: 'a', y: 2 }], encodings: { x: 'x', y: 'y' } })).toBe(true);
  });

  it('allows brand, theme and output controls while source identity and intrinsic presentation remain stable', async () => {
    const id = 'pattern:viz:simple-bar';
    const first = wire('viz.render', 'output', await render(wire('viz.render', 'input', request(id))));
    const themed = wire('viz.render', 'output', await render(wire('viz.render', 'input', { ...request(id), brand: 'B', theme: 'dark', output: { ...request(id).output, echarts: true, width: 800, height: 450 }, strictFields: true, a11yEquivalence: true })));
    expect(themed.status, JSON.stringify(themed.errors)).toBe('ok');
    expect(themed.render).toMatchObject({ brand: 'B', theme: 'dark' });
    expect(themed.output).toMatchObject({ echarts: true, width: 800, height: 450 });
    expect(themed.svgHash).not.toBe(first.svgHash);
    expect(themed.normalizedSpec).toEqual(first.normalizedSpec);
    expect(themed.echartsSpec).toBeDefined();
    const repeated = wire('viz.render', 'output', await render(wire('viz.render', 'input', request(id))));
    expect(repeated.svg).toBe(first.svg);
    expect(repeated.normalizedSpec).toEqual(first.normalizedSpec);
    retain('allowed-controls', { first, themed, repeatHash: repeated.svgHash });
  });
});
