/** The website must be able to draw the same chart it received as SVG, including hc legends and sizing. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as renderer from '@oods/viz-render';
import { handle } from '../../src/tools/viz.render.js';
import { wire } from '../helpers/wire-boundary.js';

afterEach(() => vi.restoreAllMocks());

const require = createRequire(path.resolve(import.meta.dirname, '../../../viz-render/package.json'));
const { parse, View, textMetrics } = await import(pathToFileURL(require.resolve('vega')).href);
textMetrics.canvas(false);
function drawing(svg: string): string {
  const ids = new Map<string, string>();
  return svg.replace(/<svg\b[^>]*>/, '<svg>').replace(/<(?:title|desc)\b[^>]*>[\s\S]*?<\/(?:title|desc)>/g, '')
    .replace(/(\bid="|url\(#)([^"\)]+)/g, (_all, prefix, id) => { if (!ids.has(id)) ids.set(id, `id-${ids.size}`); return prefix + ids.get(id); });
}
async function draw(spec: unknown): Promise<string> {
  const view = new View(parse(spec), { renderer: 'none' }); view.logLevel(0);
  try { await view.runAsync(); return await view.toSVG(); } finally { view.finalize(); }
}
const stable = (result: any) => {
  const { specRef, svgRef, specRefCreatedAt, specRefExpiresAt, vegaSpec, output, ...rest } = result;
  const { includeVegaSpec, ...controls } = output;
  return JSON.parse(JSON.stringify({ ...rest, output: controls }));
};
const sized = { chartType: 'bar', rows: [{ category: 'First', value: 17 }, { category: 'Second', value: 39 }], encodings: { x: 'category', y: 'value' }, output: { svg: true, width: 400, height: 260 } };

describe('s225: output.includeVegaSpec returns what the emitter actually parsed', () => {
  for (const [name, svgHash] of [
    ['correlation-matrix', '9bf33ce6644cd526c7b19dd4348a387557999ce94e22fb41452711df1129f706'],
    ['diverging-bar', 'abc88303cb4033bf7506aa93037a5c91ac12c4781d689e1ca7b4badd96b62345'],
    ['time-grid-heatmap', 'a1d5970861cb9ec139841a74d135cc59bb592e4fa27504862f5f5e59805fcd1f'],
    ['sized-bar', 'dd8ec2607b690a147f0cfc2461ab919ee14419f0a47b6db72ae668927feb4dd9'],
  ]) it(`${name}: replay keeps every data mark, legend and dimension, and the opt-in moves no existing output`, async () => {
    const input = name === 'sized-bar' ? sized : { pattern: `pattern:viz:${name}`, brand: 'A', theme: 'hc', output: { svg: true } };
    const baseline = await handle(input as never) as any;
    const request = wire('viz.render', 'input', { ...input, output: { ...input.output, includeVegaSpec: true } });
    const result = wire('viz.render', 'output', await handle(request as never)) as any;
    expect(result.status).toBe('ok'); expect(result.vegaSpec).toBeDefined();
    expect(baseline.vegaSpec).toBeUndefined(); expect(baseline.output.includeVegaSpec).toBeUndefined();
    expect(result.svgHash).toBe(svgHash); // s241 changes only correlation table wording; the other three render controls stay pinned.
    expect(stable(result)).toEqual(stable(baseline));
    const replayed = await draw(JSON.parse(JSON.stringify(result.vegaSpec)));
    expect(drawing(replayed)).toBe(drawing(result.svg));
    expect(replayed.match(/<svg[^>]*width="([^"]+)"/)?.[1]).toBe(String(result.render.width));
    expect(replayed.match(/<svg[^>]*height="([^"]+)"/)?.[1]).toBe(String(result.render.height));
    if (name !== 'sized-bar') {
      expect(replayed).toContain('Symbol legend'); expect(replayed).not.toContain('Discrete legend');
      expect(replayed).not.toContain('role-legend-band');
    }
  }, 60_000);

  it('can return the Vega spec without adding the SVG payload', async () => {
    const result = await handle({ ...sized, output: { width: 400, height: 260, includeVegaSpec: true } } as never) as any;
    expect(result.status).toBe('ok'); expect(result.vegaSpec).toBeDefined();
    expect(result.svg).toBeUndefined(); expect(result.svgHash).toBeUndefined(); expect(result.render).toBeUndefined();
    expect(result.output).toEqual({ compact: true, includeVegaSpec: true });
    expect(await draw(result.vegaSpec)).toContain('width="410"');
  });

  it('keeps ECharts output unchanged when the Vega-only flag is requested', async () => {
    const input = { chartType: 'treemap', hierarchy: { type: 'nested', data: [{ name: 'A', value: 2 }, { name: 'B', value: 4 }] }, output: { svg: true } };
    const before = await handle(input as never) as any;
    const after = await handle({ ...input, output: { ...input.output, includeVegaSpec: true } } as never) as any;
    expect(after.status).toBe('ok'); expect(after.vegaSpec).toBeUndefined();
    expect(after.output.includeVegaSpec).toBeUndefined(); expect(stable(after)).toEqual(stable(before));
  }, 60_000);

  it('keeps the hc paint guard on the exact-spec path, even without an SVG payload', async () => {
    const original = renderer.renderVegaLiteWithSpec;
    vi.spyOn(renderer, 'renderVegaLiteWithSpec').mockImplementation(async (...args) => {
      const result = await original(...args);
      return { ...result, svg: result.svg.replace('fill="Canvas"', 'fill="#010203"') };
    });
    for (const svg of [true, false]) {
      const result = await handle({ ...sized, theme: 'hc', output: { svg, includeVegaSpec: true } } as never);
      expect(result.status).toBe('error');
      expect(result.errors?.[0]).toMatchObject({ code: 'OODS-V165', message: expect.stringContaining('#010203') });
      expect(result).not.toHaveProperty('vegaSpec'); expect(result).not.toHaveProperty('svg');
    }
  });
});
