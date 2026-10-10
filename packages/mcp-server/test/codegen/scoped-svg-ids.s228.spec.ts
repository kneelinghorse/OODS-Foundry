import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDashboardHtml } from '../../src/tools/dashboard.render.html.js';
import { scopedSvgIds } from '../../src/lib/scoped-svg-ids.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { CASES, SALES } from '../../src/tools/__fixtures__/cartesian-render.js';
import type { UiSchema } from '../../src/schemas/generated.js';

function uniqueSvgIds(markup: string) {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!);
  assert(ids.length > 0, 'fixture must contain SVG ids to exercise the collision');
  assert.equal(new Set(ids).size, ids.length, 'every embedded SVG id must be unique');
  for (const match of markup.matchAll(/url\(#([^)]+)\)/g)) assert(ids.includes(match[1]!), `local reference ${match[1]} resolves`);
  return ids;
}
function retain(name: string, contents: string) {
  if (!process.env.S228_M01_RECEIPTS) return;
  fs.mkdirSync(process.env.S228_M01_RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(process.env.S228_M01_RECEIPTS, name), contents);
}

describe('each embedded chart render owns its ids and ECharts hover classes (s228-m01)', () => {
  it('rewrites id definitions, local links and CSS selectors while preserving text', () => {
    const svg = '<svg><defs><linearGradient id="oods-zr-0"/></defs><style><![CDATA[.oods-zr-1:hover{fill:#fff}]]></style><path class="oods-zr-1" fill="url(#oods-zr-0)"/><use href="#oods-zr-0"/><text>oods-zr-0 stays text</text></svg>';
    const scoped = scopedSvgIds(svg, 'panel-0-span');
    expect(scoped).toContain('id="oods-zr-panel-0-span-0"');
    expect(scoped).toContain('.oods-zr-panel-0-span-1:hover');
    expect(scoped).toContain('class="oods-zr-panel-0-span-1"');
    expect(scoped).toContain('href="#oods-zr-panel-0-span-0"');
    expect(scoped).toContain('<text>oods-zr-0 stays text</text>');
    uniqueSvgIds(scoped);
  });

  it('preserves descriptive attributes and CSS literals while scoping actual IDREFs and paint URLs', () => {
    const svg = `<svg aria-label="oods-zr-0" aria-description="url(#oods-id-2)" title="oods-id-2" ecmeta="oods-zr-1" aria-labelledby="oods-id-2 authored-label" aria-describedby="oods-zr-3"><title id="oods-id-2">oods-id-2</title><desc id="oods-zr-3">oods-zr-3</desc><text id="authored-label">oods-zr-0 stays text</text><defs><linearGradient id="oods-zr-0"/></defs><style><![CDATA[/* .oods-zr-1 url(#oods-zr-0) */ .oods-zr-1:hover{fill:url('#oods-zr-0');content:".oods-zr-1 url(#oods-zr-0)"} #oods-id-2{stroke:url(#oods-zr-0)}]]></style><path class="oods-zr-1 authored-class" style="fill:url('#oods-zr-0');font-family:'oods-zr-1';--note:'url(#oods-zr-0)';/* url(#oods-zr-0) */"/><use xlink:href="#oods-zr-0"/></svg>`;
    const scoped = scopedSvgIds(svg, 'panel-0-span');
    for (const attribute of ['aria-label="oods-zr-0"', 'aria-description="url(#oods-id-2)"', 'title="oods-id-2"', 'ecmeta="oods-zr-1"']) expect(scoped).toContain(attribute);
    expect(scoped).toContain('aria-labelledby="oods-id-panel-0-span-2 authored-label"');
    expect(scoped).toContain('aria-describedby="oods-zr-panel-0-span-3"');
    expect(scoped).toContain('<title id="oods-id-panel-0-span-2">oods-id-2</title>');
    expect(scoped).toContain('<desc id="oods-zr-panel-0-span-3">oods-zr-3</desc>');
    expect(scoped).toContain('<text id="authored-label">oods-zr-0 stays text</text>');
    expect(scoped).toContain('class="oods-zr-panel-0-span-1 authored-class"');
    expect(scoped).toContain('xlink:href="#oods-zr-panel-0-span-0"');
    expect(scoped).toContain(".oods-zr-panel-0-span-1:hover{fill:url('#oods-zr-panel-0-span-0')");
    expect(scoped).toContain('#oods-id-panel-0-span-2{stroke:url(#oods-zr-panel-0-span-0)}');
    expect(scoped).toContain("style=\"fill:url('#oods-zr-panel-0-span-0');font-family:'oods-zr-1';--note:'url(#oods-zr-0)';/* url(#oods-zr-0) */\"");
    expect(scoped).toContain('content:".oods-zr-1 url(#oods-zr-0)"');
    expect(scoped).toContain('/* .oods-zr-1 url(#oods-zr-0) */');
  });

  it('two real ECharts panels do not collide, and the check bites on a planted duplicate', async () => {
    const option = { animation: false, series: [{ type: 'graph', layout: 'none', data: [{ id: 'north', name: 'North', x: 0, y: 0 }, { id: 'south', name: 'South', x: 100, y: 100 }], links: [{ source: 'north', target: 'south' }], symbolSize: 30, label: { show: true }, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3168bb' }, { offset: 1, color: '#91bedf' }] } } }] };
    const other = structuredClone(option);
    other.series[0]!.itemStyle.color.colorStops = [{ offset: 0, color: '#a84719' }, { offset: 1, color: '#eab58c' }];
    const html = await composeDashboardHtml({ title: 'Warehouse connections', columns: 12, panels: ['North network', 'South network'].map((name, index) => ({ id: `panel-${index}`, kind: 'chart', title: name, echartsSpec: index === 0 ? option : other } as any)), layout: [{ id: 'panel-0', x: 0, y: 0, w: 6, h: 2 }, { id: 'panel-1', x: 6, y: 0, w: 6, h: 2 }], a11y: {} as any });
    const ids = uniqueSvgIds(html);
    // Every panel's phone and full-width render has its own id scope.
    for (const panel of [0, 1]) for (const variant of [0, 1]) {
      expect(ids.some(id => id.includes(`panel-${panel}-${variant}-`))).toBe(true);
    }
    expect(() => uniqueSvgIds(html + `<svg><g id="${ids[0]}"/></svg>`)).toThrow('unique');
    retain('dashboard-scoped.html', html);
    retain('dashboard-before.html', html.replace(/oods-(id|zr)-panel-\d+-\d+-(\d+)/g, 'oods-$1-$2'));
  });

  it.each(['react', 'vue'] as const)('generated %s heatmap owns all nine render id sets, and the check bites on a planted duplicate', async framework => {
    const schema: UiSchema = { version: '2026.02', objectSchema: { measurements: { type: 'array', required: true } }, screens: [{ id: 'heatmap', component: 'VizHeatmapPreview', props: { title: 'Regional revenue', description: 'Authored sales by quarter.' }, chart: { source: 'record-array', chartType: 'heatmap', dataField: 'measurements', encodings: structuredClone(CASES[4]!.encodings) as never, sampleRows: SALES.map(row => ({ ...row })) as never } }] };
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const svgs = result.artifact!.files.filter(file => file.path.endsWith('.svg'));
    expect(svgs).toHaveLength(9);
    const markup = svgs.map(file => file.contents).join('\n');
    const ids = uniqueSvgIds(markup);
    for (const id of ids) expect(result.code).toContain(id);
    expect(ids.every(id => /oods-id-record-1-[a-f0-9]{12}-(light|dark|hc)-(design|narrow|wide)-\d+/.test(id))).toBe(true);
    expect(() => uniqueSvgIds(markup + svgs[0]!.contents)).toThrow('unique');
    retain(`heatmap-${framework}.json`, JSON.stringify({ files: svgs, ids, plantedDuplicateRejected: true }, null, 2));
  });
});
