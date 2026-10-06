import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import tokens from '@oods/tokens';
import * as renderer from '@oods/viz-render';
import { resolveTokenToColor } from '@oods/viz-core';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { assertHcSvgPaints } from '../../src/tools/hc-svg-paints.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as dashboard } from '../../src/tools/dashboard.render.js';
import { SALES, CASES } from '../../src/tools/__fixtures__/cartesian-render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../tools/s172-echarts-operands.js';
import { wire } from '../helpers/wire-boundary.js';
import { getAjv } from '../../src/lib/ajv.js';

afterEach(() => vi.restoreAllMocks());

const inputs = [
  ...CASES.map(({ chartType, encodings }) => ({ chartType, rows: [...SALES], encodings })),
  ...ECHARTS_OPERAND_CASES.map(operand => renderInputFor(operand)),
];
function retain(name: string, value: unknown) {
  const directory = process.env.S195_HC_RECEIPTS;
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}

describe('HC scope at the public wire (s195-m05)', () => {
  it.each(inputs)('$chartType measures the actual HC renderer and certification', async input => {
    for (const brand of ['A', 'B'] as const) {
      const request = wire('viz.render', 'input', { ...input, theme: 'hc', brand, output: { svg: true, includeNormalizedSpec: true, includeA11y: true } });
      const result = wire('viz.render', 'output', await render(request as never));
      retain(`${input.chartType}-${brand}`, { request, result });
      const repeated = wire('viz.render', 'output', await render(request as never));
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      expect(result.svg).toContain('Canvas');
      expect(repeated.svg).toBe(result.svg);
      const declared = wire('viz.render', 'output', await render({ ...request, output: { includeNormalizedSpec: true } } as never));
      expect(declared.status).toBe('ok');
      const paints = [...new Set([...result.svg!.matchAll(/\b(?:fill|stroke|stop-color)="([^"]+)"/g)].map(match => match[1]))];
      expect(assertHcSvgPaints(result.svg!, { theme: 'hc', brand })).toBe(result.svg);
      const operand = ECHARTS_OPERAND_CASES.find(item => item.chartType === input.chartType);
      const certification = wire('artifact.certify', 'output', await certify(wire('artifact.certify', 'input', { spec: declared.normalizedSpec, theme: 'hc', brand, ...(operand ? { data: { [operand.branch]: operand.branchData } } : {}) }) as never));
      retain(`${input.chartType}-${brand}`, { request, result, certification, paints });
      expect(certification.pillars?.determinism).toBe('pass');
      expect(certification.conformant).toBe(true);
      expect(certification).toMatchObject({ status: 'ok', pillars: { contrast: 'exempt' }, contrastResults: [{ theme: 'hc', brand, verdict: 'exempt', measured: false, reason: 'forced-colors' }] });
      const light = await certify({ spec: declared.normalizedSpec!, theme: 'light', brand, ...(operand ? { data: { [operand.branch]: operand.branchData } } : {}) } as never);
      expect(certification.pillars?.accuracy).toBe(light.pillars?.accuracy);
      expect(certification.pillars?.a11yEquivalence).toBe(light.pillars?.a11yEquivalence);
      expect(certification.accuracySummary).toEqual(light.accuracySummary);
      if (operand) {
        const specOnly = wire('artifact.certify', 'output', await certify({ spec: declared.normalizedSpec!, theme: 'hc', brand }));
        expect(specOnly).toMatchObject({ coverage: 'uncertified', conformant: null, pillars: { contrast: 'exempt', a11yEquivalence: 'unchecked', determinism: 'unchecked', accuracy: 'unchecked' } });
      }
    }
  });
  it.each(['A', 'B'] as const)('dashboard %s retains HC token declarations in HTML', async brand => {
    const request = { schemaVersion: 'v0.1', theme: 'hc', brand, datasets: [{ id: 'sales', rows: SALES }], panels: CASES.slice(0, 2).map(({ chartType, encodings }) => ({ chartType, encodings, id: chartType, kind: 'chart', datasetId: 'sales' })), a11y: { description: 'High-contrast sales charts.' }, output: { html: true, contrastScan: true } };
    const result = wire('dashboard.render', 'output', await dashboard(wire('dashboard.render', 'input', request) as never));
    retain(`dashboard-${brand}`, { request, result });
    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-theme="hc"');
    expect(result.html).toContain('--oods-color-bg:' + tokens.cssVariablesByScope[brand].hc['--oods-theme-surface-canvas']);
    expect(result.html).toContain('--oods-color-fg:CanvasText');
    // s224-m01 (#2542 ruling 4): each of the two Vega panels also carries its phone render.
    expect(result.html?.match(/<svg\b/g)).toHaveLength(4);
    expect(result.a11yContrast?.summary).toEqual({ failing: 0, gradedPairs: 0 });
  });

  it.each(['placeholder', 'omit'] as const)('dashboard HC %s retains all eleven supported panels without fallback', async onPanelError => {
    const panels = inputs.filter(item => !['chord', 'flow_map'].includes(item.chartType!)).map(({ rows, output, name, ...item }: any) => ({ ...item, ...(name ? { title: name } : {}), id: item.chartType, kind: 'chart', ...(rows ? { datasetId: 'sales' } : {}) }));
    const request = { schemaVersion: 'v0.1', theme: 'hc', datasets: [{ id: 'sales', rows: SALES }], panels, onPanelError, a11y: { description: 'Measured HC render coverage.' }, output: { html: true } };
    const result = wire('dashboard.render', 'output', await dashboard(wire('dashboard.render', 'input', request) as never));
    // s224-m01 (#2542 ruling 4): the five Vega panels' phone renders make 16 SVGs for 11 panels.
    expect(result.html?.match(/<svg\b/g)).toHaveLength(16);
    expect(result.panels).toHaveLength(11);
    expect(result.panels.filter(panel => panel.kind === 'error')).toEqual([]);
    expect(result.warnings.filter(issue => issue.code === 'OODS-V165')).toEqual([]);
    retain(`dashboard-${onPanelError}`, { request, result });
  });

  it.each(['react', 'vue'] as const)('public code.generate emits the real HC payment asset for %s detail', async framework => {
    const composition = await compose({ object: 'Subscription', context: 'detail' });
    expect(composition.status).toBe('ok');
    const request = wire('code.generate', 'input', { schema: composition.schema, framework, profile: 'build', options: { theme: 'hc', brand: 'A' } });
    const result = wire('code.generate', 'output', await generate(request));
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const assets = result.artifact!.files.filter(file => file.path.endsWith('.svg'));
    // The design-size render, its narrow render (Sprint 202 m01) and its wide render (s213-m01), all on the HC paints.
    // s222-m02 (F7): the three in each of the light, dark and hc themes, so the page's nearest [data-theme] picks one;
    // the hc renders carry the HC paints and the light and dark ones do not.
    expect(assets.map(asset => asset.path).sort()).toEqual(['dark.narrow', 'dark', 'dark.wide', 'hc.narrow', 'hc', 'hc.wide', 'narrow', '', 'wide'].map(suffix => `src/charts/payment-001${suffix ? `.${suffix}` : ''}.svg`));
    for (const asset of assets) {
      const hc = /\.hc(?:\.narrow|\.wide)?\.svg$/.test(asset.path);
      expect(asset.contents.includes('CanvasText'), asset.path).toBe(hc);
      if (hc) expect(asset.contents).toContain(tokens.cssVariablesByScope.A.hc['--oods-viz-scale-categorical-01']);
    }
    retain(`codegen-${framework}`, { request, result });
  });

  it('rejects an actual renderer fallback without assigning a replacement color', async () => {
    const original = renderer.renderVegaLiteToSvg;
    vi.spyOn(renderer, 'renderVegaLiteToSvg').mockImplementation(async (...args) => (await original(...args)).replace('fill="Canvas"', 'fill="#010203"'));
    const result = wire('viz.render', 'output', await render({ ...inputs[0], theme: 'hc', output: { svg: true } } as never));
    expect(result.status).toBe('error');
    expect(result.errors?.[0]).toMatchObject({ code: 'OODS-V165', message: expect.stringContaining('#010203') });
    expect(result).not.toHaveProperty('svg');
    retain('fallback-fault', result);
  });

  it('resolves HC tokens verbatim and validates declared colors across all SVG paint channels', () => {
    const raw = tokens.cssVariablesByScope.B.hc;
    for (const token of ['--oods-sys-surface-canvas', '--oods-sys-text-primary', '--oods-viz-scale-categorical-01']) {
      expect(resolveTokenToColor(token, { brand: 'B', theme: 'hc' })).toBe(raw[token]);
    }
    const good = '<svg><rect fill="Canvas" stroke="none"/><style>.x{fill:CanvasText}</style><stop stop-color="CanvasText"/><path style="stroke:CanvasText;fill:none"/></svg>';
    expect(assertHcSvgPaints(good, { theme: 'hc' })).toBe(good);
    for (const svg of ['<svg><stop stop-color="#010203"/></svg>', '<svg><path style="fill:#010203"/></svg>', '<svg><style>.x{stroke:#010203}</style></svg>']) {
      expect(() => assertHcSvgPaints(svg, { theme: 'hc' })).toThrow('#010203');
      expect(assertHcSvgPaints(svg, { theme: 'light' })).toBe(svg);
      expect(assertHcSvgPaints(svg, { theme: 'dark' })).toBe(svg);
    }
  });

  it('admits hc and rejects unknown themes at each public input schema', () => {
    for (const name of ['viz.render', 'dashboard.render', 'artifact.certify']) {
      const schema = JSON.parse(fs.readFileSync(new URL(`../../src/schemas/${name}.input.json`, import.meta.url), 'utf8'));
      const validate = getAjv().compile(schema.properties.theme);
      expect(validate('hc')).toBe(true);
      expect(validate('sepia')).toBe(false);
    }
  });
});
