import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderEChartsToSvg, renderVegaLiteToSvg, renderVegaLiteWithSpec, type VegaLiteSpec } from '@oods/viz-render';

// s239 (audit F-03): Vega's default Node loader fetches any http(s) URL and reads any
// file path a spec names. Every chart tool renders through this package, and the MCP
// tools are advertised read-only and closed-world, so chart input must never make the
// server send a request or touch its disk. These tests point every address at a local
// listener and a real temp file: the listener must see nothing, and a present file
// must look exactly like a missing one (no file-existence side channel).

const ROWS = [{ k: 'a', v: 3 }, { k: 'b', v: 5 }];
const ENCODING = { x: { field: 'k', type: 'nominal' }, y: { field: 'v', type: 'quantitative' } } as const;

let server: Server;
let base: string;
let dir: string;
let rowsFile: string;
const hits: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    hits.push(`${request.method} ${request.url}`);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(ROWS));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  dir = mkdtempSync(path.join(tmpdir(), 'oods-s239-'));
  rowsFile = path.join(dir, 'rows.json');
  writeFileSync(rowsFile, JSON.stringify(ROWS));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

async function refusal(spec: VegaLiteSpec): Promise<string> {
  const before = hits.length;
  const error = await renderVegaLiteToSvg(spec).then(() => undefined, (caught: unknown) => caught);
  // A fetch that slipped through would land after the render settles; give it a beat.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(hits.slice(before)).toEqual([]);
  expect(error).toBeInstanceOf(Error);
  return (error as Error).message;
}

describe('the Vega renderer loads nothing named in a spec (s239)', () => {
  it('refuses an http data url without sending a request, naming the address and the inline remedy', async () => {
    const url = `${base}/rows.json`;
    const message = await refusal({ data: { url }, mark: 'bar', encoding: ENCODING } as VegaLiteSpec);
    expect(message).toContain(JSON.stringify(url));
    expect(message).toContain('Pass the rows inline as values instead.');
  });

  it('refuses file:// and bare paths without reading them: a present file and a missing one fail identically', async () => {
    const present = `file://${rowsFile}`;
    const missing = `file://${rowsFile}.missing`;
    const outcome = async (url: string) =>
      (await refusal({ data: { url }, mark: 'bar', encoding: ENCODING } as VegaLiteSpec)).replace(url, '<url>');
    expect(await outcome(present)).toBe(await outcome(missing));
    // No protocol: the default Node loader treated this as a local file path.
    expect(await outcome(rowsFile)).toBe(await outcome(present));
  });

  it('refuses a secondary data source (a lookup from.data.url), not only the top-level data', async () => {
    await refusal({
      data: { values: ROWS },
      transform: [{ lookup: 'k', from: { data: { url: `${base}/lookup.json` }, key: 'k', fields: ['w'] } }],
      mark: 'bar',
      encoding: ENCODING,
    } as VegaLiteSpec);
  });

  it('refuses an image mark url', async () => {
    await refusal({ data: { values: ROWS }, mark: { type: 'image', url: `${base}/image.png`, width: 8, height: 8 }, encoding: ENCODING } as VegaLiteSpec);
  });

  it('refuses a link without crashing the process (a rejected link sanitize is an uncaught TypeError in Vega)', async () => {
    let unhandled = 0;
    const count = () => { unhandled += 1; };
    process.on('unhandledRejection', count);
    try {
      for (const href of ['javascript:alert(1)', `${base}/link`]) {
        expect(await refusal({ data: { values: ROWS }, mark: { type: 'bar', href }, encoding: ENCODING } as VegaLiteSpec)).toContain(JSON.stringify(href));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      process.off('unhandledRejection', count);
    }
    expect(unhandled).toBe(0);
  });

  // Byte-identity of inline renders is held by the emitter goldens (emitter.spec.ts.snap);
  // here, a render that consulted the loader at all would have thrown.
  it('still renders inline data, which never consults the loader', async () => {
    const spec = { data: { values: ROWS }, mark: 'bar', encoding: ENCODING } as VegaLiteSpec;
    const before = hits.length;
    const svg = await renderVegaLiteToSvg(spec);
    expect(svg).toMatch(/^<svg\b/);
    expect((await renderVegaLiteWithSpec(spec)).svg).toBe(svg);
    expect(hits.slice(before)).toEqual([]);
  });
});

describe('the ECharts renderer has no loader to reach (s239)', () => {
  // ECharts SSR draws an image only from a value it is handed; in this worker it has no
  // image constructor and never calls fetch, so image-bearing options must still send
  // nothing. (Geometry is inline-only: ECHARTS_NO_MAP is covered in echarts-render-worker.)
  it.each([
    ['a sized pattern fill', { series: [{ type: 'treemap', data: [{ name: 'a', value: 3, itemStyle: { color: { image: 'PATTERN', repeat: 'repeat', imageWidth: 4, imageHeight: 4 } } }, { name: 'b', value: 2 }] }] }],
    ['a rich-text background image', { series: [{ type: 'treemap', label: { show: true, formatter: '{a|{b}}', rich: { a: { backgroundColor: { image: 'RICH' }, width: 10, height: 10 } } }, data: [{ name: 'a', value: 3 }, { name: 'b', value: 2 }] }] }],
    ['an image symbol', { series: [{ type: 'graph', layout: 'none', data: [{ name: 'a', x: 1, y: 1, symbol: 'image://SYMBOL', symbolSize: 10 }, { name: 'b', x: 5, y: 5 }], links: [{ source: 'a', target: 'b' }] }] }],
  ])('sends no request for %s', async (_label, option) => {
    const before = hits.length;
    const withAddress = JSON.parse(JSON.stringify(option).replace(/PATTERN|RICH|SYMBOL/g, (name) => `${base}/${name.toLowerCase()}.png`));
    await renderEChartsToSvg(withAddress);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hits.slice(before)).toEqual([]);
  });
});
