import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as dashboardRender } from '../../src/tools/dashboard.render.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import type { DashboardRenderInput, VizRenderInput } from '../../src/schemas/generated.js';
import { ECHARTS_OPERAND_CASES, type EChartsOperandCase } from './s172-echarts-operands.js';

// s239 (audit F-03). The chart tools are advertised read-only and closed-world, yet
// artifact_certify rendered a spec's data.url through Vega's default Node loader: it sent
// GETs to any host and read any file:// path (a present file and a missing one certified
// differently, a file-existence side channel). Prompt-injected input could trigger both,
// and an image or link field passed through to ECharts would have a viewer fetch or follow
// an address the caller chose. Every address below points at a local listener or a real
// temp file. The listener must see nothing, each call must answer with a typed, actionable
// error (or draw the value as plain data), and no reply may reference an external
// resource. The boundary is rebuilt in-test the way the dispatch loop runs it: the
// registered schema JSONs compiled with the same getAjv() instance, then handle().

function validator(file: string) {
  const schema = JSON.parse(readFileSync(new URL(`../../src/schemas/${file}`, import.meta.url), 'utf8'));
  return (schema.$id ? getAjv().getSchema(schema.$id) : undefined) ?? getAjv().compile(schema);
}
const certifyInput = validator('artifact.certify.input.json');
const certifyOutput = validator('artifact.certify.output.json');
const vizInput = validator('viz.render.input.json');
const dashboardInput = validator('dashboard.render.input.json');

const ROWS = [{ region: 'North', revenue: 120 }, { region: 'South', revenue: 90 }];
const INLINE = 'OODS Foundry renders charts from inline data only, so chart input cannot name a URL, file, image or link.';
const DATA_URL_REFUSAL = { status: 'error', errors: [{ code: 'OODS-V126', message: `data.url is not accepted: ${INLINE} Pass the rows inline as data.values instead.` }] };
// An inline data: URI fetches nothing, but it is still an image a viewer would draw, it can
// carry its own external references, and no chart needs one: refused like any address.
const DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
const SCRIPT = 'javascript:alert(document.domain)';

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

/** Run a call and prove the listener heard nothing, even from a request that lands late. */
async function silently<T>(call: () => Promise<T>): Promise<T> {
  const before = hits.length;
  const out = await call();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(hits.slice(before)).toEqual([]);
  return out;
}

/** Positions holding the caller's own rows or geometry, which renderers draw as text if at all. */
const DATA_POSITIONS = new Set(['values', 'datasets', 'dataset', 'rows', 'raw', 'rawProperties', '__registration']);

/**
 * Every reference a viewer would load or follow in a reply: in SVG or HTML an href or src
 * attribute that leaves the document, a url() aimed outside it, or an element that loads
 * (image, img, script, iframe, object, embed, link, video, audio, source); in a JSON spec a
 * url, href, link, sublink or image field, or an image:// symbol. A $schema identifier and
 * an SVG xmlns are names, not references.
 */
function externalReferences(reply: unknown): string[] {
  const found: string[] = [];
  const markup = (text: string): void => {
    for (const pattern of [
      /\b(?:xlink:)?href\s*=\s*["']?(?!#)[^"'\s>]/gi,
      /\bsrc\s*=\s*["']?[^"'\s>]/gi,
      /url\(\s*['"]?\s*(?!#)[^\s'")]/gi,
      /<(?:image|img|script|iframe|object|embed|link|video|audio|source)\b/gi,
    ]) for (const match of text.matchAll(pattern)) found.push(match[0]);
  };
  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (/^\s*image:\/\//i.test(value)) found.push(`${key}: ${value}`);
      markup(value);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [child, entry] of Object.entries(value)) {
      if (DATA_POSITIONS.has(child)) continue;
      if (!Array.isArray(value) && ['url', 'href', 'link', 'sublink', 'image'].includes(child)) found.push(`${child}: ${JSON.stringify(entry)}`);
      walk(entry, Array.isArray(value) ? key : child);
    }
  };
  walk(reply, '');
  return found;
}

/** A hand-authored cartesian IR, the shape an agent passes to artifact_certify. */
function ir(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data: { values: ROWS },
    marks: [{ trait: 'MarkBar' }],
    encoding: {
      x: { field: 'region', trait: 'EncodingPositionX', type: 'nominal' },
      y: { field: 'revenue', trait: 'EncodingPositionY', type: 'quantitative' },
    },
    a11y: { description: 'Revenue by region.' },
    ...extra,
  };
}

async function certifyWire(spec: Record<string, unknown>, data?: Record<string, unknown>) {
  const input = { spec, ...(data ? { data } : {}) };
  // The wire admits it (spec and operand nodes are open objects); the handler is the gate.
  expect(certifyInput(input)).toBe(true);
  const out = await silently(() => certify(input));
  expect(certifyOutput(out)).toBe(true);
  return out;
}

describe('artifact_certify refuses a spec that names a URL or file, and sends nothing (s239)', () => {
  it('spec.data.url over http is OODS-V126 naming data.url and the inline remedy', async () => {
    expect(await certifyWire(ir({ data: { url: `${base}/rows.json` } }))).toEqual(DATA_URL_REFUSAL);
  });

  it('file:// answers the same whether or not the file exists: nothing is read, nothing leaks', async () => {
    const present = await certifyWire(ir({ data: { url: `file://${rowsFile}` } }));
    const missing = await certifyWire(ir({ data: { url: `file://${rowsFile}.missing` } }));
    expect(present).toEqual(DATA_URL_REFUSAL);
    expect(missing).toEqual(present);
  });

  it('a lookup url in transform params and an image url in mark options are refused by field', async () => {
    const lookup = { lookup: 'region', from: { data: { url: `${base}/lookup.json` }, key: 'region', fields: ['target'] } };
    const viaLookup = await certifyWire(ir({ transforms: [{ type: 'filter', params: lookup }] }));
    expect(viaLookup.errors).toEqual([{ code: 'OODS-V126', message: `transforms[0].params.from.data.url is not accepted: ${INLINE} Pass the rows inline as transforms[0].params.from.data.values instead.` }]);
    const viaImage = await certifyWire(ir({ marks: [{ trait: 'MarkBar', options: { type: 'image', url: `${base}/image.png` } }] }));
    expect(viaImage.errors).toEqual([{ code: 'OODS-V126', message: `marks[0].options.url is not accepted: ${INLINE} Remove it.` }]);
  });

  it('a javascript: link is refused instead of ending the server process', async () => {
    // Before s239 this exact call died in Vega's SVG renderer with an unhandled rejection.
    const out = await certifyWire(ir({ marks: [{ trait: 'MarkBar', options: { href: SCRIPT } }] }));
    expect(out.errors).toEqual([{ code: 'OODS-V126', message: `marks[0].options.href is not accepted: ${INLINE} Remove it.` }]);
  });

  it('image sources, image symbols and external url() paints in spec options are refused by field', async () => {
    for (const [field, options] of [
      ['marks[0].options.itemStyle.color.image', { itemStyle: { color: { image: `${base}/pattern.png`, repeat: 'repeat' } } }],
      ['marks[0].options.symbol', { symbol: `image://${base}/symbol.png` }],
      ['marks[0].options.fill', { fill: `url(${DATA_URI})` }],
      ['marks[0].options.link', { link: SCRIPT }],
    ] as const) {
      const out = await certifyWire(ir({ marks: [{ trait: 'MarkBar', options }] }));
      expect(out.errors).toEqual([{ code: 'OODS-V126', message: `${field} is not accepted: ${INLINE} Remove it.` }]);
    }
  });

  it('inline data still certifies, with a render proof that never touched the loader', async () => {
    // The emitter throws if Vega asks its loader for anything, so a stable render proof
    // with a renderHash means the inline picture was drawn without one.
    const out = await certifyWire(ir());
    expect(out).toMatchObject({ status: 'ok', coverage: 'certified', determinism: { stable: true } });
    expect(out.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

interface OperandVariant {
  readonly chartType: string;
  /** The planted field, from the root of the viz_render input. */
  readonly field: string;
  readonly plant: (branch: any, address: Addresses) => string;
}
interface Addresses { readonly http: string; readonly file: string }

// Each plants one address into a clean operand from s172-echarts-operands and returns it.
// Node and link fields are copied into ECharts data items (hierarchy, sankey and graph
// nodes keep every extra field), where ECharts reads them as options; chord drops extras,
// and is refused alike so the rule does not depend on what an adapter happens to copy.
const VARIANTS: readonly OperandVariant[] = [
  { chartType: 'treemap', field: 'hierarchy.data.children[0].label.backgroundColor.image', plant: (b, a) => (b.data.children[0].label = { show: true, backgroundColor: { image: a.http } }, a.http) },
  { chartType: 'sunburst', field: 'hierarchy.data.children[1].label.rich.a.backgroundColor.image', plant: (b) => (b.data.children[1].label = { formatter: '{a|x}', rich: { a: { backgroundColor: { image: DATA_URI } } } }, DATA_URI) },
  { chartType: 'treemap', field: 'hierarchy.data.children[2].itemStyle.color.image', plant: (b, a) => (b.data.children[2].itemStyle = { color: { image: a.file, repeat: 'repeat' } }, a.file) },
  { chartType: 'treemap', field: 'hierarchy.data.children[0].itemStyle.decal.symbol', plant: (b, a) => (b.data.children[0].itemStyle = { decal: { symbol: `image://${a.http}` } }, a.http) },
  { chartType: 'sunburst', field: 'hierarchy.data.children[0].areaStyle.color.image', plant: (b, a) => (b.data.children[0].areaStyle = { color: { image: a.http } }, a.http) },
  { chartType: 'treemap', field: 'hierarchy.data.children[0].graphic.elements[0].style.image', plant: (b, a) => (b.data.children[0].graphic = { elements: [{ type: 'image', style: { image: a.http } }] }, a.http) },
  { chartType: 'treemap', field: 'hierarchy.data.children[0].link', plant: (b) => (b.data.children[0].link = SCRIPT, SCRIPT) },
  { chartType: 'sunburst', field: 'hierarchy.data.children[0].emphasis.itemStyle.borderColor', plant: (b, a) => (b.data.children[0].emphasis = { itemStyle: { borderColor: `url(${a.http})` } }, a.http) },
  { chartType: 'treemap', field: 'hierarchy.data.children[0].tooltip', plant: (b, a) => (b.data.children[0].tooltip = { formatter: `<img src="${a.http}">` }, a.http) },
  { chartType: 'sankey', field: 'sankey.nodes[0].color', plant: (b, a) => (b.nodes[0].color = `url(${a.http})`, a.http) },
  { chartType: 'sankey', field: 'sankey.links[0].lineStyle.color.image', plant: (b, a) => (b.links[0].lineStyle = { color: { image: a.http } }, a.http) },
  { chartType: 'chord', field: 'chord.nodes[0].itemStyle.color.image', plant: (b, a) => (b.nodes[0].itemStyle = { color: { image: a.http } }, a.http) },
  { chartType: 'force_graph', field: 'network.nodes[0].symbol', plant: (b, a) => (b.nodes[0].symbol = `image://${a.http}`, a.http) },
  { chartType: 'force_graph', field: 'network.nodes[0].cursor', plant: (b, a) => (b.nodes[0].cursor = `url(${a.file}), pointer`, a.file) },
];

const operandCase = (chartType: string): EChartsOperandCase => ECHARTS_OPERAND_CASES.find((entry) => entry.chartType === chartType)!;
const DASHBOARD_TYPES = new Set(['treemap', 'sunburst', 'sankey', 'force_graph']);

describe('image and link fields in chart data are refused by all three tools (s239)', () => {
  it.each(VARIANTS.map((variant) => [variant.field, variant] as const))('%s', async (field, variant) => {
    const clean = operandCase(variant.chartType);
    const branch = structuredClone(clean.branchData) as Record<string, unknown>;
    const planted = variant.plant(branch, { http: `${base}/planted.png`, file: `file://${rowsFile}` });
    const message = `${field} is not accepted: ${field.endsWith('.tooltip')
      ? "an item tooltip is rendered as HTML, which can load images and follow links, and OODS Foundry builds every chart's tooltip itself."
      : INLINE} Remove it.`;
    const unreferenced = (reply: unknown): void => {
      expect(JSON.stringify(reply)).not.toContain(planted);
      expect(externalReferences(reply)).toEqual([]);
    };

    // viz_render: the wire admits the open node fields; the handler refuses before any option is built.
    const input = { chartType: variant.chartType, [clean.branch]: branch, name: clean.name, output: { svg: true, echarts: true } } as unknown as VizRenderInput;
    expect(vizInput(input)).toBe(true);
    const rendered = await silently(() => vizRender(input));
    expect(rendered).toMatchObject({ status: 'error', errors: [{ code: 'OODS-V126', message }] });
    unreferenced(rendered);

    // artifact_certify: the same operand under data.<branch>, next to the IR viz_render emits for the clean operand.
    const cleanRender = await vizRender({ chartType: variant.chartType, [clean.branch]: clean.branchData, name: clean.name, output: { includeNormalizedSpec: true } } as unknown as VizRenderInput);
    const verdict = await certifyWire(cleanRender.normalizedSpec as Record<string, unknown>, { [clean.branch]: branch });
    expect(verdict).toEqual({ status: 'error', errors: [{ code: 'OODS-V126', message: `data.${message}` }] });
    unreferenced(verdict);

    // dashboard_render: the panel becomes an error placeholder carrying the same refusal.
    if (DASHBOARD_TYPES.has(variant.chartType)) {
      const dashboard = {
        schemaVersion: 'v0.1',
        datasets: [{ id: 'sales', rows: ROWS }],
        panels: [{ id: 'planted', kind: 'chart', chartType: variant.chartType, [clean.branch]: branch }],
        a11y: { description: 'A dashboard with one planted panel.' },
        output: { html: true, echarts: true },
      } as unknown as DashboardRenderInput;
      expect(dashboardInput(dashboard)).toBe(true);
      const composed = await silently(() => dashboardRender(dashboard));
      expect(composed.panels).toContainEqual(expect.objectContaining({ id: 'planted', kind: 'error', error: { code: 'OODS-V126', message, severity: 'error' } }));
      unreferenced(composed);
    }
  });
});

describe('viz_render and dashboard_render take no address and send nothing (s239)', () => {
  const bar = { chartType: 'bar', encodings: { x: { field: 'region' }, y: { field: 'revenue' } } };

  it('their registered input schemas refuse a URL where data goes', () => {
    // Each refusal must come from the address itself, not from an unrelated defect in the fixture.
    const refusedAt = (validate: typeof vizInput, input: unknown): string[] => {
      expect(validate(input)).toBe(false);
      return (validate.errors ?? []).map((error: { instancePath: string; keyword: string; params?: Record<string, unknown> }) =>
        `${error.instancePath}:${error.keyword}:${error.params?.additionalProperty ?? ''}`);
    };
    expect(vizInput({ ...bar, rows: ROWS })).toBe(true);
    expect(refusedAt(vizInput, { ...bar, rows: ROWS, data: { url: `${base}/rows.json` } })).toContain(':additionalProperties:data');
    expect(refusedAt(vizInput, { chartType: 'choropleth', geo: { geojson: `${base}/regions.json`, valueField: 'revenue' } })).toContain('/geo/geojson:type:');
    expect(refusedAt(dashboardInput, {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', url: `${base}/rows.json` }],
      panels: [{ id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: 'revenue' } }],
      a11y: { description: 'Revenue dashboard.' },
    })).toContain('/datasets/0:additionalProperties:url');
  });

  it('a URL in viz_render datasetRef, its one string data handle, is a typed reference error, not a fetch', async () => {
    const input = { ...bar, datasetRef: `${base}/rows.json` } as unknown as VizRenderInput;
    expect(vizInput(input)).toBe(true);
    const out = await silently(() => vizRender(input));
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('Pass the rows inline in the rows field.');
  });

  it('URL-shaped values in rows stay data: drawn as text or carried as raw rows, never a reference', async () => {
    const rows = [{ region: `${base}/north`, revenue: 120 }, { region: `file://${rowsFile}`, revenue: 90 }];
    const chart = { ...bar, rows, output: { svg: true } } as unknown as VizRenderInput;
    expect(vizInput(chart)).toBe(true);
    const rendered = await silently(() => vizRender(chart));
    expect(rendered.status).toBe('ok');
    expect(rendered.svg).toMatch(/^<svg\b/);
    expect(externalReferences(rendered)).toEqual([]);

    const bubble = structuredClone(operandCase('bubble_map').branchData) as { rows: Array<Record<string, unknown>> };
    bubble.rows = bubble.rows.map((row) => ({ ...row, link: SCRIPT, image: `image://${base}/row.png` }));
    const geo = { chartType: 'bubble_map', geo: bubble, output: { svg: true, echarts: true } } as unknown as VizRenderInput;
    expect(vizInput(geo)).toBe(true);
    const mapped = await silently(() => vizRender(geo));
    expect(mapped.status).toBe('ok');
    expect(externalReferences(mapped)).toEqual([]);

    const dashboard = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows }],
      panels: [{ id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: 'revenue' } }],
      a11y: { description: 'Revenue dashboard.' },
      output: { html: true },
    } as unknown as DashboardRenderInput;
    expect(dashboardInput(dashboard)).toBe(true);
    const composed = await silently(() => dashboardRender(dashboard));
    expect(composed.status).toBe('ok');
    expect(composed.html).toContain('<svg');
    expect(externalReferences(composed)).toEqual([]);
  });
});

describe('OODS Foundry emits no external reference of its own in any chart reply (s239)', () => {
  // The builder, the patterns and the adapters set no image, link or url() themselves, so
  // every chart type's SVG, specs and options are reference-free with nothing refused.
  const cartesian = [
    ['bar', { x: { field: 'region' }, y: { field: 'revenue' } }],
    ['line', { x: { field: 'region' }, y: { field: 'revenue' } }],
    ['scatter', { x: { field: 'revenue' }, y: { field: 'revenue' } }],
    ['area', { x: { field: 'region' }, y: { field: 'revenue' } }],
    ['heatmap', { x: { field: 'region' }, y: { field: 'region' }, color: { field: 'revenue' } }],
  ] as const;

  it.each(cartesian.map(([chartType, encodings]) => [chartType, encodings] as const))('%s: SVG, Vega-Lite, Vega and ECharts specs', async (chartType, encodings) => {
    const reply = await silently(() => vizRender({ chartType, rows: ROWS, encodings, output: { svg: true, echarts: true, includeNormalizedSpec: true, includeVegaSpec: true } } as unknown as VizRenderInput));
    expect(reply.status).toBe('ok');
    expect(reply.svg).toMatch(/^<svg\b/);
    expect(externalReferences(reply)).toEqual([]);
  });

  it.each(ECHARTS_OPERAND_CASES.map((operand) => [operand.chartType, operand] as const))('%s: SVG and ECharts option', async (_chartType, operand) => {
    const reply = await silently(() => vizRender({ chartType: operand.chartType, [operand.branch]: operand.branchData, name: operand.name, output: { svg: true, echarts: true, includeNormalizedSpec: true } } as unknown as VizRenderInput));
    expect(reply.status).toBe('ok');
    expect(reply.svg).toMatch(/^<svg\b/);
    expect(externalReferences(reply)).toEqual([]);
  });

  it('a dashboard HTML export with Vega and ECharts panels', async () => {
    const dashboard = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [
        { id: 'total', kind: 'kpi', title: 'Revenue', datasetId: 'sales', field: 'revenue', aggregate: 'sum' },
        { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'sales', encodings: { x: 'region', y: 'revenue' } },
        { id: 'split', kind: 'chart', chartType: 'treemap', hierarchy: operandCase('treemap').branchData },
        { id: 'flow', kind: 'chart', chartType: 'sankey', sankey: operandCase('sankey').branchData },
      ],
      a11y: { description: 'Revenue dashboard.' },
      output: { html: true, echarts: true },
    } as unknown as DashboardRenderInput;
    expect(dashboardInput(dashboard)).toBe(true);
    const composed = await silently(() => dashboardRender(dashboard));
    expect(composed.status).toBe('ok');
    expect(composed.html).toContain('<svg');
    expect(externalReferences(composed)).toEqual([]);
  });
});
