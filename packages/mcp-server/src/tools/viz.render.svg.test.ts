import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveTokenToColor } from '@oods/viz-core';
import { toHex } from '../../../viz-core/src/tokens/categorical-palette.js';
import { sha256 } from '@oods/artifacts';
import * as renderer from '@oods/viz-render';
import { getAjv } from '../lib/ajv.js';
import { getDefinition } from '../errors/registry.js';
import { handle as render } from './viz.render.js';
import { handle as certify } from './artifact.certify.js';
import { handle as dashboard } from './dashboard.render.js';
import { resolveValueRef } from './schema-ref.js';
import { isEChartsPrimaryType } from './echarts-primary.js';
import { SALES, CASES } from './__fixtures__/cartesian-render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../../test/tools/s172-echarts-operands.js';
import type { DashboardRenderInput, VizRenderInput } from '../schemas/generated.js';

const inputs: VizRenderInput[] = [
  ...CASES.map(({ chartType, encodings }) => ({ chartType, rows: [...SALES], encodings } as VizRenderInput)),
  ...ECHARTS_OPERAND_CASES.map(operand => renderInputFor(operand) as unknown as VizRenderInput),
];
const schema = (name: string) => JSON.parse(readFileSync(new URL(`../schemas/${name}.json`, import.meta.url), 'utf8'));
const validateOutput = getAjv().compile(schema('viz.render.output'));
const validateInput = getAjv().compile(schema('viz.render.input'));
const checkDashboard = getAjv().compile(schema('dashboard.render.input'));
const svgInput = (input: VizRenderInput): VizRenderInput => ({ ...input, output: { ...input.output, svg: true, includeNormalizedSpec: true } });

afterEach(() => vi.restoreAllMocks());

describe('public SVG contract', () => {
  it('covers every chart admitted by the public input schema', () => {
    expect(inputs.map(input => input.chartType).sort()).toEqual(schema('viz.render.input').properties.chartType.enum.slice().sort());
  });

  it.each(inputs)('$chartType returns actual, repeatable SVG bytes and a resolvable byte-identity reference', async input => {
    const request = svgInput(input);
    expect(validateInput(request)).toBe(true);
    const first = await render(request); const second = await render(request);
    expect(first.status, JSON.stringify(first.errors)).toBe('ok');
    expect(validateOutput(first), JSON.stringify(validateOutput.errors)).toBe(true);
    expect(first.svg).toMatch(/^<svg\b/);
    expect(first.svg).toMatch(/<(path|rect|circle|polygon)\b/);
    expect(first.svgHash).toBe(sha256(first.svg!));
    expect(first.svgBytes).toBe(Buffer.byteLength(first.svg!, 'utf8'));
    expect(second.svg).toBe(first.svg); expect(second.svgHash).toBe(first.svgHash);
    expect(first.render).toMatchObject({ engine: isEChartsPrimaryType(input.chartType) ? 'echarts' : 'vega-lite', theme: 'light', brand: 'A' });
    expect(first.render!.width).toBeGreaterThan(0); expect(first.render!.height).toBeGreaterThan(0);
    expect(resolveValueRef(first.svgRef!)).toMatchObject({ ok: true, value: first.svg });
    if (isEChartsPrimaryType(input.chartType)) {
      expect(renderer.discoverEChartsStructuralTokens(first.svg!)).toEqual([]);
      expect(renderer.normalizeEChartsSvg(first.svg!)).toBe(first.svg);
    } else {
      expect(first.svg).toContain('role="graphics-object"');
      expect(first.svg).toContain('aria-roledescription=');
      const grade = await certify({ spec: first.normalizedSpec! });
      expect(grade.determinism?.renderHash).toBe(first.svgHash);
    }
  });

  it('SVG opt-in leaves the spec identity unchanged; explicit dimensions change only rendered identity', async () => {
    for (const input of [inputs[0]!, inputs[5]!]) {
      const plain = await render(input); const intrinsic = await render(svgInput(input));
      const sized = await render({ ...svgInput(input), output: { svg: true, width: 800, height: 450 } });
      expect(plain.svg).toBeUndefined(); expect(plain.render).toBeUndefined();
      expect(intrinsic.contentHash).toBe(plain.contentHash); expect(sized.contentHash).toBe(plain.contentHash);
      expect(sized.svgHash).not.toBe(intrinsic.svgHash);
      // Vega's existing autosize behavior adds 5px padding on each edge;
      // the echo names the actual SVG size, while output preserves the request.
      expect(sized.render).toMatchObject(isEChartsPrimaryType(input.chartType) ? { width: 800, height: 450 } : { width: 810, height: 460 });
      expect(sized.output).toMatchObject({ width: 800, height: 450 });
    }
    for (const width of [0, -1, 1.5]) expect(validateInput({ ...inputs[0], output: { svg: true, width } })).toBe(false);
  });

  it('a shared renderer mutation moves render and certify hashes together; a one-sided mutation breaks identity', async () => {
    const request = svgInput(inputs[0]!); const baseline = await render(request);
    const actual = renderer.renderVegaLiteToSvg;
    vi.spyOn(renderer, 'renderVegaLiteToSvg').mockImplementation(async (...args) => (await actual(...args)).replace('<svg ', '<svg data-mutation="shared" '));
    const changed = await render(request); const grade = await certify({ spec: changed.normalizedSpec! });
    expect(changed.svgHash).not.toBe(baseline.svgHash);
    expect(grade.determinism?.renderHash).toBe(changed.svgHash);
    expect(() => expect(grade.determinism?.renderHash).toBe(sha256(changed.svg! + '<!-- divergence -->'))).toThrow();
  });

  it.each(['vega-lite', 'echarts'])('%s renderer failure is a typed failure without a success payload', async engine => {
    vi.spyOn(renderer, engine === 'vega-lite' ? 'renderVegaLiteToSvg' : 'renderEChartsToSvg').mockRejectedValue(new Error('renderer bite'));
    const out = await render(svgInput(inputs[engine === 'vega-lite' ? 0 : 5]!));
    expect(out.status).toBe('error'); expect(out.errors).toEqual([{ code: 'OODS-V165', message: 'SVG rendering failed: renderer bite', severity: 'error' }]);
    expect(out.svg).toBeUndefined(); expect(out.svgRef).toBeUndefined(); expect(out.contentHash).toBeUndefined();
    expect(validateOutput(out)).toBe(true); expect(getDefinition('OODS-V165')).toBeDefined();
  });

  it('dashboard HTML draws all 11 admitted panel types; only failed panels use placeholders', async () => {
    const admitted = inputs.filter(input => !['chord', 'flow_map'].includes(input.chartType!));
    const request = {
      schemaVersion: 'v0.1', datasets: [{ id: 'sales', rows: [...SALES] }],
      panels: admitted.map(({ output: _output, rows: _rows, ...input }) => ({ ...input, id: input.chartType, kind: 'chart', ...(isEChartsPrimaryType(input.chartType) ? {} : { datasetId: 'sales' }) })),
      output: { html: true }, a11y: { description: 'All admitted dashboard charts.' },
    } as DashboardRenderInput;
    const first = await dashboard(request); const second = await dashboard(request);
    expect(first.status, JSON.stringify(first.errors)).toBe('ok');
    expect(first.panels).toHaveLength(11); expect(first.panels.every(panel => panel.kind === 'chart')).toBe(true);
    // s224-m01 (#2542 ruling 4): each of the five Vega panels also carries its phone render (332x180, shown below 600px),
    // so 11 panels write 16 SVGs; the six ECharts panels keep one each.
    expect(first.html?.match(/<svg\b/g)).toHaveLength(16);
    expect(first.html).not.toContain('class="oods-panel oods-placeholder');
    expect(first.outputHtmlHash).toBe(sha256(first.html!)); expect(second.html).toBe(first.html);
    const failed = await dashboard({ ...request, strictFields: true, panels: [{ id: 'bad', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: 'missing' } }] });
    expect(failed.html).toContain('oods-placeholder-error'); expect(failed.html).not.toContain('<svg');
  });
});

const canvasFill = (svg: string): string | undefined => /^<svg\b[^>]*>\s*(?:<title>[\s\S]*?<\/title>\s*<desc>[\s\S]*?<\/desc>\s*)?<rect\b[^>]*\bfill="([^"]+)"/.exec(svg)?.[1];

describe('public scoped SVG contract', () => {
  it.each(inputs)('$chartType paints and repeats all four supported CSS scopes', async input => {
    const defaultRender = await render(svgInput(input));
    for (const brand of ['A', 'B'] as const) {
      let light: string | undefined;
      for (const theme of ['light', 'dark'] as const) {
        const request = { ...svgInput(input), brand, theme };
        const first = await render(request); const second = await render(request);
        expect(first.status, JSON.stringify(first.errors)).toBe('ok');
        expect(validateOutput(first), JSON.stringify(validateOutput.errors)).toBe(true);
        expect(first.svg).toBe(second.svg);
        expect(first.render).toMatchObject({ brand, theme });
        expect(canvasFill(first.svg!)).toBe(toHex(resolveTokenToColor('--sys-surface-canvas', { brand, theme })!));
        if (theme === 'light') light = first.svg;
        else expect(first.svg).not.toBe(light);
        if (brand === 'A' && theme === 'light') expect(first.svg).toBe(defaultRender.svg);
      }
    }
    // A dark/B render must not contaminate the next omitted-scope render.
    expect((await render(svgInput(input))).svg).toBe(defaultRender.svg);
  });

  it.each([{ theme: 'sepia' }, { brand: 'C' }, { brand: 'a' }])('rejects unsupported scope %j at the public schema boundary', scope => {
    // s213-m04: a theme is an enum; a brand is checked against the brand registry (format oods-brand).
    const keyword = 'brand' in scope ? 'format' : 'enum';
    expect(validateInput({ ...svgInput(inputs[0]!), ...scope })).toBe(false);
    expect(validateInput.errors?.some(error => error.keyword === keyword)).toBe(true);
    expect(checkDashboard({ schemaVersion: 'v0.1', datasets: [], panels: [], a11y: { description: 'Scope rejection.' }, ...scope })).toBe(false);
    expect(checkDashboard.errors?.some(error => error.keyword === keyword)).toBe(true);
  });

  it.each(['A', 'B'] as const)('dashboard %s draws 11 scoped charts with matching document attributes and stable hashes', async brand => {
    const request = {
      schemaVersion: 'v0.1', datasets: [{ id: 'sales', rows: [...SALES] }],
      panels: inputs.filter(input => !['chord', 'flow_map'].includes(input.chartType!)).map(({ rows, output, ...input }) => ({ ...input, id: input.chartType, kind: 'chart', ...(rows ? { datasetId: 'sales' } : {}) })),
      a11y: { description: 'All eleven chart types at the requested scope.' }, output: { html: true }, brand,
    } as DashboardRenderInput;
    let light: string | undefined;
    for (const theme of ['light', 'dark'] as const) {
      const first = await dashboard({ ...request, theme }); const second = await dashboard({ ...request, theme });
      expect(first.status, JSON.stringify(first.errors)).toBe('ok');
      expect(first.html).toContain(`data-theme="${theme}" data-brand="${brand}"`);
      expect(first.html).toBe(second.html); expect(first.outputHtmlHash).toBe(sha256(first.html!));
      const svgs = first.html!.match(/<svg\b[\s\S]*?<\/svg>/g)!;
      // s224-m01 (#2542 ruling 4): the five Vega panels' phone renders paint the same canvas as their desktop renders.
      expect(svgs).toHaveLength(16);
      for (const svg of svgs) expect(canvasFill(svg)).toBe(toHex(resolveTokenToColor('--sys-surface-canvas', { brand, theme })!));
      if (theme === 'light') light = first.html;
      else expect(first.html).not.toBe(light);
    }
    if (brand === 'A') expect((await dashboard({ ...request, brand: undefined })).html).toBe(light);
  });
});
