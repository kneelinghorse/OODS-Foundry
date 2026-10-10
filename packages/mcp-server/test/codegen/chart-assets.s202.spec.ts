import { describe, expect, it } from 'vitest';
import { svgCarriesTitle } from '@oods/component-contracts';
import { PLACED_CHART_NARROW_BREAKPOINT, PLACED_CHART_NARROW_OUTPUT, PLACED_CHART_OUTPUT, PLACED_CHART_SIZE, PLACED_CHART_THEMES, PLACED_CHART_WIDE_BREAKPOINT, PLACED_CHART_WIDE_OUTPUT, narrowChartPath, placedChartRequests, prepareChartAssets, themeChartPath, wideChartPath } from '../../src/codegen/chart-assets.js';
import { certifyPlacedCharts } from '../../src/lib/measurements.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as render } from '../../src/tools/viz.render.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const subscriptionDetail = async (): Promise<UiSchema> => {
  const composed = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
  expect(composed.status).toBe('ok');
  // This test exercises non-empty authored payments. The default seed now has no invented history.
  composed.schema.objectSchema!.payment_history = { type: 'array', required: false, examples: [[
    { at: '2026-01-01T00:00:00Z', amount: 1000 }, { at: '2026-02-01T00:00:00Z', amount: 1200 },
    { at: '2026-03-01T00:00:00Z', amount: 900 }, { at: '2026-04-01T00:00:00Z', amount: 1100 },
  ]] };
  return composed.schema!;
};
const painted = (svg: string, title: string) => svg.includes('role-title-text') || svgCarriesTitle(svg, title);

describe('placed charts name themselves in the figure heading and carry a narrow render (s202-m01)', () => {
  it('renders every placed chart without a painted title at the design size and at the narrow size', async () => {
    const schema = await subscriptionDetail();
    const requests = placedChartRequests(schema);
    expect(requests.length).toBeGreaterThan(0);
    for (const placed of requests) {
      expect(placed.request.output).toEqual(PLACED_CHART_OUTPUT);
      expect(placed.narrow.request.output).toEqual(PLACED_CHART_NARROW_OUTPUT);
      expect(placed.narrow.path).toBe(narrowChartPath(placed.path));
      expect(placed.narrow.request).toEqual({ ...placed.request, output: PLACED_CHART_NARROW_OUTPUT });
      // s213-m01 (Sprint 212 review finding 5): a third render for a desktop column, the same request at the wide size.
      expect(placed.wide.path).toBe(wideChartPath(placed.path));
      expect(placed.wide.request).toEqual({ ...placed.request, output: PLACED_CHART_WIDE_OUTPUT });
    }
    expect(PLACED_CHART_OUTPUT).toEqual({ svg: true, titlePlacement: 'figure', ...PLACED_CHART_SIZE });
    // s222-m02 (#2502 ruling 12): at most 320px tall as displayed at every width the figure CSS draws each render (the
    // each render is capped at 1.25x; switching waits until the next native width fits (s241).)
    expect(PLACED_CHART_SIZE).toEqual({ width: 720, height: 240 });
    expect(PLACED_CHART_NARROW_OUTPUT).toEqual({ svg: true, titlePlacement: 'figure', width: 292, height: 240 });
    expect(PLACED_CHART_NARROW_BREAKPOINT).toBe(729);
    expect(PLACED_CHART_WIDE_OUTPUT).toEqual({ svg: true, titlePlacement: 'figure', width: 1120, height: 240 });
    expect(PLACED_CHART_WIDE_BREAKPOINT).toBe(1130);
    const displayed = (render: { width: number; height: number }, shownUpTo: number) => shownUpTo * (render.height + 10) / (render.width + 10);
    expect(displayed(PLACED_CHART_SIZE, 730 * 1.25)).toBeLessThanOrEqual(320);
    expect(displayed({ width: 292, height: 240 }, 302 * 1.25)).toBeLessThanOrEqual(320);
    expect(displayed({ width: 1120, height: 240 }, 1130 * 1.25)).toBeLessThanOrEqual(320);
    // s222-m02 (F7): every theme's renders, light at the design path, dark and hc beside it; the generation theme's (light
    // here) are the ones measurement certifies.
    for (const placed of requests) {
      expect(Object.keys(placed.themes)).toEqual([...PLACED_CHART_THEMES]);
      for (const theme of PLACED_CHART_THEMES) {
        expect(placed.themes[theme].path).toBe(themeChartPath(placed.themes.light.path, theme));
        expect(placed.themes[theme].request).toEqual({ ...placed.themes.light.request, theme });
        expect(placed.themes[theme].narrow.request).toEqual({ ...placed.themes[theme].request, output: PLACED_CHART_NARROW_OUTPUT });
      }
      expect({ path: placed.path, request: placed.request }).toEqual({ path: placed.themes.light.path, request: placed.themes.light.request });
    }
    const prepared = await prepareChartAssets(schema);
    const node = prepared.schema.screens[0]!.children!.flatMap(function collect(child): typeof child[] { return [...(child.chart ? [child] : []), ...(child.children ?? []).flatMap(collect)]; })[0]!;
    const title = String(node.props!.title);
    expect(typeof node.props!.svg).toBe('string');
    expect(typeof node.props!.svgNarrow).toBe('string');
    expect(painted(node.props!.svg as string, title)).toBe(false);
    expect(painted(node.props!.svgNarrow as string, title)).toBe(false);
    expect(painted(node.props!.svgWide as string, title)).toBe(false);
    expect(node.props!.svg as string).toMatch(/viewBox="0 0 730 250"/);
    expect(node.props!.svgNarrow as string).toMatch(/viewBox="0 0 302 250"/);
    // Every render is a file of the artifact, design size first and light first, so the consumer carries the same bytes
    // the figure shows; the dark and hc renders are the same chart in those themes (their canvas is the theme's).
    expect(prepared.files.map(file => file.path)).toEqual(requests.flatMap(placed => PLACED_CHART_THEMES.flatMap(theme => [placed.themes[theme].path, placed.themes[theme].narrow.path, placed.themes[theme].wide.path])));
    const props = ['svg', 'svgNarrow', 'svgWide', 'svgDark', 'svgDarkNarrow', 'svgDarkWide', 'svgHc', 'svgHcNarrow', 'svgHcWide'];
    props.forEach((prop, index) => expect(prepared.files[index]!.contents, prop).toBe(node.props![prop]));
    expect(node.props!.svg as string).toMatch(/<rect[^>]*fill="#FFFFFF"/);
    expect(node.props!.svgDark as string).toMatch(/<rect[^>]*fill="#0A0A0A"/);
    expect(node.props!.svgHc as string).toMatch(/<rect[^>]*fill="Canvas"/);
  });

  it('viz.render paints the title unless output.titlePlacement is figure, and records the placement on the normalized spec so certify replays it', async () => {
    const schema = await subscriptionDetail();
    const placed = placedChartRequests(schema)[0]!;
    const title = String(placed.request.name);
    const { titlePlacement: _figure, ...chartOutput } = placed.request.output as Record<string, unknown> & { titlePlacement?: string };
    const inChart = await render({ ...placed.request, output: { ...chartOutput, includeNormalizedSpec: true } as never });
    const inFigure = await render({ ...placed.request, output: { ...placed.request.output, includeNormalizedSpec: true } });
    expect(inChart.status).toBe('ok');
    expect(inFigure.status).toBe('ok');
    expect(painted(inChart.svg!, title)).toBe(true);
    expect(painted(inFigure.svg!, title)).toBe(false);
    expect((inChart.normalizedSpec as { config?: { title?: unknown } }).config?.title).toBeUndefined();
    expect((inFigure.normalizedSpec as { config?: { title?: unknown } }).config?.title).toEqual({ placement: 'figure' });
    expect((inFigure.normalizedSpec as { name?: string }).name).toBe(title);
    expect(inFigure.svgHash).not.toBe(inChart.svgHash);
    // The a11y name survives: the figure's role img aria-label carries the title, and the spec keeps its name for A11Y-R-09.
    const certified = await certifyPlacedCharts(schema);
    expect(certified.map(chart => chart.path)).toEqual([placed.path]);
    expect(certified[0]!.svgHash).toBe(inFigure.svgHash);
    expect(certified[0]!.narrow.path).toBe(placed.narrow.path);
    expect(certified[0]!.narrow.certification.status).toBe(certified[0]!.certification.status);
    expect(certified[0]!.certification.conformant).toBe(true);
    expect(certified[0]!.narrow.certification.conformant).toBe(true);
    expect(certified[0]!.wide.path).toBe(placed.wide.path);
    expect(certified[0]!.wide.certification.conformant).toBe(true);
  });

  it('emits svg and svgNarrow on the placed chart in React and Vue, with the figure heading owned by the component', async () => {
    const schema = await subscriptionDetail();
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const code = result.artifact!.files.find(file => /GeneratedUI\.(tsx|vue)$/.test(file.path))!.contents;
      expect(code).toContain(framework === 'react' ? 'svgNarrow={svgNarrow ?? "<svg' : ':svgNarrow="svgNarrow ?? defaultChartSvgNarrow"');
      expect(code).toContain(framework === 'react' ? 'svgWide={svgWide ?? "<svg' : ':svgWide="svgWide ?? defaultChartSvgWide"');
      // s222-m02 (F7): and the dark and hc renders, so the chart follows the page's theme.
      expect(code).toContain(framework === 'react' ? 'svgDark={svgDark ?? "<svg' : ':svgDark="svgDark ?? defaultChartSvgDark"');
      expect(code).toContain(framework === 'react' ? 'svgHcWide={svgHcWide ?? "<svg' : ':svgHcWide="svgHcWide ?? defaultChartSvgHcWide"');
      expect(code).toContain('title="Payment amounts"');
      // The artifact envelope orders files by path; all nine renders travel with the consumer.
      expect(result.artifact!.files.map(file => file.path).filter(path => path.endsWith('.svg'))).toEqual(['src/charts/payment-001.dark.narrow.svg', 'src/charts/payment-001.dark.svg', 'src/charts/payment-001.dark.wide.svg', 'src/charts/payment-001.hc.narrow.svg', 'src/charts/payment-001.hc.svg', 'src/charts/payment-001.hc.wide.svg', 'src/charts/payment-001.narrow.svg', 'src/charts/payment-001.svg', 'src/charts/payment-001.wide.svg']);
    }
  });
});
