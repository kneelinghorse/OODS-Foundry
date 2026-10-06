import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as ReactComponents from '@oods/components-react';
import { svgCarriesTitle } from '@oods/component-contracts';
import { PLACED_CHART_SIZE } from '../../src/codegen/chart-assets.js';
import { chartNodes } from '../../src/codegen/chart-declaration.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';

const vueRequire = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { renderToString: renderVue } = vueRequire('@vue/server-renderer');
const { createSSRApp, h } = vueRequire('vue');
const VueComponents = vueRequire('@oods/components-vue');
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const css = readFileSync(new URL('../../../component-styles/src/components.css', import.meta.url), 'utf8');
vi.setConfig({ testTimeout: 60_000 });

describe('s200-m02 placed charts render at design size and never scale above it', () => {
  // s222-m02 (#2502 ruling 12): 720x240, so no render is drawn more than 320px tall at any width the figure CSS allows.
  it('renders every placed chart at 720x240 and binds that width to the preview', async () => {
    expect(PLACED_CHART_SIZE).toEqual({ width: 720, height: 240 });
    for (const [object, previewType] of [['Subscription', 'bar'], ['Relationship', 'graph']] as const) {
      const composed = await compose({ object, context: 'detail' });
      expect(composed.status).toBe('ok');
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: composed.schema, framework, profile: 'build', options: { styling: 'tokens', typescript: true } });
        expect(result.status, JSON.stringify(result.errors)).toBe('ok');
        // The design-size asset; the narrow render beside it (Sprint 202 m01) is the figure's own switch, not a scale-up.
        const asset = result.artifact!.files.find(file => /-001\.svg$/.test(file.path))!;
        expect(asset, `${object}/${framework} chart asset`).toBeDefined();
        const narrow = result.artifact!.files.find(file => file.path.endsWith('.narrow.svg'))!;
        expect(Number(narrow.contents.match(/^<svg[^>]*\bwidth="(\d+)"/)![1])).toBeLessThanOrEqual(370);
        const [, width, height] = asset.contents.match(/^<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/)!;
        // Vega adds its 5px padding around the requested frame; ECharts renders the frame exactly.
        expect(Number(width)).toBeGreaterThanOrEqual(720); expect(Number(width)).toBeLessThanOrEqual(730);
        expect(Number(height)).toBeGreaterThanOrEqual(240); expect(Number(height)).toBeLessThanOrEqual(250);
        // s220-m01: the Subscription payment chart is bars (VizMarkPreview).
        expect(result.code).toContain(previewType === 'bar' ? 'VizMarkPreview' : 'VizGraphPreview');
        expect(result.code).toMatch(framework === 'react' ? /width=\{720\}/ : /:width="720"/);
        expect(result.code).toMatch(framework === 'react' ? /height=\{240\}/ : /:height="240"/);
        expect(result.code).not.toMatch(/(?:width=\{|:width=")360/);
      }
    }
  });

  it('caps the placed SVG at its rendered width in the shared stylesheet so it scales down, never up', () => {
    expect(css).toContain(':where([data-viz-svg]) > svg { display: block; inline-size: 100%; max-inline-size: var(--oods-viz-width, 100%); block-size: auto; }');
  });

  it('keeps one visible title whether the SVG owns it through role-title-text or as an ECharts text title', async () => {
    const vega = '<svg><g class="role-title-text"><text>Connected relationships</text></g></svg>';
    const echarts = '<svg width="720" height="400"><text dominant-baseline="central" style="font-size:18px;font-family:sans-serif;font-weight:bold;" fill="#1A1D23">Connected relationships</text><path d="M0,0L1,1"/></svg>';
    const bare = '<svg><path d="M0,0L1,1"/></svg>';
    const legendOnly = '<svg><text>Connected</text><text>relationships</text></svg>';
    expect(svgCarriesTitle(vega, 'Connected relationships')).toBe(true);
    expect(svgCarriesTitle(echarts, 'Connected relationships')).toBe(true);
    expect(svgCarriesTitle(bare, 'Connected relationships')).toBe(false);
    expect(svgCarriesTitle(legendOnly, 'Connected relationships')).toBe(false);
    expect(svgCarriesTitle(echarts, undefined)).toBe(false);
    for (const [svg, captions] of [[vega, 0], [echarts, 0], [bare, 1]] as const) {
      const props = { svg, title: 'Connected relationships', width: 720, height: 400 };
      const outputs = {
        html: renderMappedComponent({ id: 'chart', component: 'VizGraphPreview', props }, '')!,
        react: renderToStaticMarkup(createElement(ReactComponents.VizGraphPreview, props)),
        vue: await renderVue(createSSRApp({ render: () => h(VueComponents.VizGraphPreview, props) })),
      };
      for (const [framework, output] of Object.entries(outputs)) {
        expect(text(output).match(/Connected relationships/g), `${framework} visible titles`).toHaveLength(1);
        expect((output.match(/<figcaption>/g) ?? []).length, `${framework} figcaption`).toBe(captions);
        expect(output, `${framework} accessible name`).toContain('aria-label="Connected relationships"');
        expect(output, `${framework} rendered width`).toContain('data-viz-width="720"');
        expect(output.replace(/\s/g, ''), `${framework} width variable`).toMatch(/--oods-viz-width:\s*720px/);
      }
    }
  });
});
