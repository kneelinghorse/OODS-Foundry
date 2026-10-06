import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { sharedScenarios, VIZ_CONTROL_IDS, VIZ_PREVIEW_TYPES, isVizIntentFragment } from '@oods/component-contracts';
import { handle as render } from '../../src/tools/viz.render.js';
import type { VizRenderInput } from '../../src/schemas/generated.js';
import { normalizeEChartsSvg } from '@oods/viz-render';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/viz.render.input.json' with { type: 'json' };
const root = path.resolve(import.meta.dirname, '../../../..');
const samples = JSON.parse(fs.readFileSync(path.join(root, 'packages/component-contracts/fixtures/viz-preview-samples.v1.json'), 'utf8'));
const ajv = getAjv(); const validate = ajv.getSchema(inputSchema.$id) ?? ajv.compile(inputSchema);
const reactRequire = createRequire(path.join(root, 'packages/components-react/package.json'));
const vueRequire = createRequire(path.join(root, 'packages/components-vue/package.json'));
const echarts = createRequire(path.join(root, 'packages/viz-render/package.json'))('echarts');
function cartesianEChartsSvg(option: Record<string, unknown>): string {
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 360, height: 200 });
  try { chart.setOption(option); return normalizeEChartsSvg(chart.renderToSVGString()); }
  finally { chart.dispose(); }
}

describe('visualization recipes use the public renderer input and pixels', () => {
  it.each(Object.keys(VIZ_PREVIEW_TYPES))('%s preserves the deterministic public SVG in both governed recipes', async id => {
    const sample = samples.samples[id];
    expect(validate(sample.input), JSON.stringify(validate.errors)).toBe(true);
    const first = await render(sample.input); const second = await render(sample.input);
    expect(first.status, JSON.stringify(first.errors)).toBe('ok');
    expect(first.svg).toBe(sample.svg); expect(second.svgHash).toBe(sample.svgHash);
    expect(createHash('sha256').update(sample.svg).digest('hex')).toBe(sample.svgHash);
    const props = { svg: sample.svg, title: sample.input.name };
    const React = reactRequire('react'); const ReactDOM = reactRequire('react-dom/server');
    const reactMarkup = ReactDOM.renderToStaticMarkup(React.createElement(reactRequire('./dist/index.cjs')[id], props));
    const Vue = vueRequire('vue'); const VueServer = vueRequire('@vue/server-renderer');
    const vueMarkup = await VueServer.renderToString(Vue.createSSRApp({ render: () => Vue.h(vueRequire('./dist/index.cjs')[id], props) }));
    for (const markup of [reactMarkup, vueMarkup]) {
      expect(markup).toContain(sample.svg);
      expect(markup).toContain(`data-oods-component="${id}"`);
      expect(markup).not.toContain('data-viz-preview-placeholder');
    }
  });
  it.each(VIZ_CONTROL_IDS)('%s emits a fragment that the actual renderer accepts after a consumer adds data', async id => {
    const scenario = sharedScenarios.find(scenario => scenario.oodsComponentId === id)!;
    const changed = scenario.event.find(event => event.effect.kind === 'event')!.effect.value as Record<string, any>;
    expect(isVizIntentFragment(changed)).toBe(true);
    const scatter = /Size|Shape|Scale/.test(id);
    const base = samples.samples[scatter ? 'VizScatterPreview' : 'VizMarkPreview'].input;
    const input = { ...base, ...changed, encodings: { ...base.encodings, ...changed.encodings }, output: { svg: true, width: 360, height: 200, includeNormalizedSpec: true } } as VizRenderInput;
    expect(validate(input), JSON.stringify(validate.errors)).toBe(true);
    const result = await render(input);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(result.svg).toContain('<svg');
    expect(result.svgHash).toHaveLength(64);
    expect(result.normalizedSpec).toBeDefined();
  });
  it.each(['bar', 'line', 'area', 'scatter', 'heatmap'] as const)('%s opacity changes both renderer outputs and retains normalized intent', async chartType => {
    const source = Object.values(samples.samples).find((sample: any) => sample.input.chartType === chartType) as any;
    const base = source?.input ?? { ...samples.samples.VizLinePreview.input, chartType };
    const input = { ...base, output: { svg: true, echarts: true, includeNormalizedSpec: true, width: 360, height: 200 } };
    expect(validate({ ...input, opacity: 0.4 }), JSON.stringify(validate.errors)).toBe(true);
    const opaque = await render({ ...input, opacity: 0.8 });
    const faint = await render({ ...input, opacity: 0.4 });
    expect(opaque.status, JSON.stringify(opaque.errors)).toBe('ok'); expect(faint.status, JSON.stringify(faint.errors)).toBe('ok');
    expect(opaque.svgHash).not.toBe(faint.svgHash);
    expect((faint.normalizedSpec as any).marks[0].options.opacity).toBe(0.4);
    expect(JSON.stringify(faint.echartsSpec)).toContain('"opacity":0.4');
    // Public Cartesian SVG is Vega-Lite; independently execute the returned
    // ECharts option through its actual engine. The shared SSR worker accepts
    // only ECharts-primary families today; no public Cartesian ECharts SVG claim.
    const echartsOpaque = cartesianEChartsSvg(opaque.echartsSpec!);
    const echartsFaint = cartesianEChartsSvg(faint.echartsSpec!);
    expect(echartsFaint).not.toBe(echartsOpaque);

  });
  it('rejects invalid opacity and unsupported primary families rather than accepting an inert control', async () => {
    const base = samples.samples.VizMarkPreview.input;
    for (const opacity of [-0.1, 1.1, Number.NaN]) {
      expect((await render({ ...base, opacity })).status).toBe('error');
    }
    for (const opacity of [-0.1, 1.1, '0.5']) expect(validate({ ...base, opacity })).toBe(false);
    const result = await render({ chartType: 'treemap', opacity: 0.5, hierarchy: { type: 'nested', data: { name: 'Root', value: 1 } } });
    expect(result.errors?.[0]?.message).toContain('Cartesian');
  });
});
