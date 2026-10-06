import { resolveTokenToColor, resolveTokenValue } from '../../viz-core/src/adapters/echarts/token-resolver.js';
import { describe, expect, it } from 'vitest';
import { renderVegaLiteToSvg, type VegaLiteSpec } from '@oods/viz-render';

// The renderer's formerly unthemed golden now requests the real light/A scope (#1850).
function chromeTokens(theme: 'light' | 'dark'): Record<string, string> {
  const scope = { theme, brand: 'A' as const };
  const colors = ['surface-canvas', 'text-primary', 'text-neutral', 'border-subtle', 'border-neutral'];
  const type = ['ref-typography-families-sans', 'sys-text-scale-heading-lg-font-size', 'sys-text-scale-heading-lg-font-weight'];
  return Object.fromEntries([
    ...colors.map(suffix => { const key = `--oods-sys-${suffix}`; return [key, resolveTokenToColor(key, scope)!]; }),
    ...type.map(suffix => { const key = `--oods-${suffix}`; return [key, resolveTokenValue(key, scope)!]; }),
  ]);
}

// A fixed line spec (the dashboard "trend" panel shape): tabular data, line mark.
const TREND_SPEC: VegaLiteSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: {
    values: [
      { month: 'Jan', revenue: 100 },
      { month: 'Feb', revenue: 140 },
      { month: 'Mar', revenue: 120 },
      { month: 'Apr', revenue: 175 },
    ],
  },
  mark: 'line',
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'revenue', type: 'quantitative' },
  },
  width: 300,
  height: 200,
};

// A fixed bar spec (the dashboard "breakdown" panel shape): categorical bars.
const BREAKDOWN_SPEC: VegaLiteSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: {
    values: [
      { region: 'North', sales: 30 },
      { region: 'South', sales: 55 },
      { region: 'East', sales: 43 },
      { region: 'West', sales: 21 },
    ],
  },
  mark: 'bar',
  encoding: {
    x: { field: 'region', type: 'nominal' },
    y: { field: 'sales', type: 'quantitative' },
  },
  width: 300,
  height: 200,
};

/** The opening `<svg ...>` tag (where the root width/height/viewBox live). */
const svgTag = (svg: string): string => svg.slice(0, svg.indexOf('>') + 1);
/** Read a numeric attribute off the root svg tag. */
const dim = (svg: string, attr: string): number =>
  Number(svgTag(svg).match(new RegExp(`\\b${attr}="(\\d+)"`))?.[1]);

describe('renderVegaLiteToSvg', () => {
  it('renders a Vega-Lite spec to an SVG string (headless, no DOM)', async () => {
    const svg = await renderVegaLiteToSvg(TREND_SPEC);
    // The emitter MUST produce real SVG markup, not a spec echo — this is the whole
    // point of the package (the moat: output that becomes pixels).
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    // Path marks for the line series are present (rendered geometry, not just axes).
    expect(svg).toContain('class="mark-line');
  });

  it('is byte-stable across repeated renders (determinism contract, seam d)', async () => {
    // Render the SAME spec twice. Because Vega's clip/gradient id counter is
    // PROCESS-GLOBAL, an un-normalized emitter would differ run-to-run; this asserts
    // the normalization holds the byte-for-byte guarantee.
    const a = await renderVegaLiteToSvg(TREND_SPEC);
    const b = await renderVegaLiteToSvg(TREND_SPEC);
    expect(a).toBe(b);
  });

  it('stays byte-stable even when other renders bump the global id counter in between', async () => {
    // This is the regression that motivates id normalization: render an unrelated
    // spec between two renders of the target so Vega's global counter advances.
    const first = await renderVegaLiteToSvg(BREAKDOWN_SPEC);
    await renderVegaLiteToSvg(TREND_SPEC); // bump the counter with a different spec
    const second = await renderVegaLiteToSvg(BREAKDOWN_SPEC);
    expect(first).toBe(second);
  });

  it('normalizes Vega auto-generated ids to stable oods-id-* tokens', async () => {
    // A spec that forces a clip-path id (axis-clipped area), proving the raw global
    // counter value never leaks into the output.
    const clipped: VegaLiteSpec = {
      ...BREAKDOWN_SPEC,
      mark: { type: 'area', clip: true },
    };
    const svg = await renderVegaLiteToSvg(clipped);
    // No raw `clipNNN` ids; any id present is a normalized token.
    expect(svg).not.toMatch(/id="clip\d+"/);
    for (const m of svg.matchAll(/\bid="([^"]+)"/g)) {
      expect(m[1]).toMatch(/^oods-id-\d+$/);
    }
  });

  it('preserves accessibility roles emitted by Vega in the SVG', async () => {
    // The export must carry a11y affordances by construction (the moat). Vega emits
    // ARIA roles on the scenegraph; they must survive id normalization.
    const svg = await renderVegaLiteToSvg(TREND_SPEC);
    expect(svg).toContain('role="graphics-object"');
    expect(svg).toContain('aria-roledescription');
  });

  it('applies dark-scope chrome tokens without changing series colors or mutating the spec', async () => {
    const before = JSON.stringify(TREND_SPEC);
    const withoutTokens = await renderVegaLiteToSvg(TREND_SPEC);
    const light = await renderVegaLiteToSvg(TREND_SPEC, { tokens: chromeTokens('light') });
    const dark = await renderVegaLiteToSvg(TREND_SPEC, { tokens: chromeTokens('dark') });
    expect(dark).not.toBe(light); expect(light).not.toBe(withoutTokens);
    expect(dark).toContain(`fill="${resolveTokenToColor('--oods-sys-surface-canvas', { theme: 'dark' })}"`);
    expect(dark).toContain(`fill="${resolveTokenToColor('--oods-sys-text-neutral', { theme: 'dark' })}"`);
    expect(dark).toContain(`stroke="${resolveTokenToColor('--oods-sys-border-subtle', { theme: 'dark' })}"`);
    // s222-m01 (#2502 ruling 4, recorded in epoch s222-m02): brand A's sans is Geist.
    expect(dark).toContain('Geist');
    // Chrome input must never secretly re-color the series.
    expect(dark).toContain('stroke="#4c78a8"'); expect(light).toContain('stroke="#4c78a8"');
    expect(JSON.stringify(TREND_SPEC)).toBe(before);
    expect(await renderVegaLiteToSvg(TREND_SPEC, { tokens: chromeTokens('dark') })).toBe(dark);
  });

  it('applies supplied typography sizes and rejects non-numeric size tokens', async () => {
    const titled = { ...TREND_SPEC, title: 'Revenue' };
    const svg = await renderVegaLiteToSvg(titled, { tokens: {
      ...chromeTokens('light'), '--oods-sys-text-scale-body-sm-font-size': '14px',
    } });
    expect(svg).toContain('font-size="24px"'); expect(svg).toContain('font-size="14px"');
    await expect(renderVegaLiteToSvg(titled, { tokens: {
      '--oods-sys-text-scale-heading-lg-font-size': 'broken',
    } })).rejects.toThrow('Invalid numeric chrome token');
  });

  it('matches the committed byte-stable SVG golden (fixed spec + dataset)', async () => {
    // The net-new RENDERED-OUTPUT golden (sprint-115 m05): pins the emitter's SVG
    // string for a fixed VL spec + inline dataset. Any drift in the compile/render
    // path or the determinism pins (text metrics / id normalization) must update a
    // committed snapshot. Byte-stable cross-machine: the text-width estimator is
    // arithmetic (font-independent) and vega is lockfile-pinned.
    const svg = await renderVegaLiteToSvg(TREND_SPEC, { tokens: chromeTokens('light') });
    expect(svg).toMatchSnapshot();
  });

  it('s149 F6a: width/height option resizes the SVG to the target box (autosize fit) without mutating the spec', async () => {
    // The dashboard export passes span-derived dims so a chart fills its grid cell
    // instead of Vega's intrinsic step size. The option MUST change the rendered
    // bytes (proving it is applied, not ignored) and MUST NOT mutate the caller's spec.
    const before = JSON.stringify(TREND_SPEC);
    const intrinsic = await renderVegaLiteToSvg(TREND_SPEC);
    const sized = await renderVegaLiteToSvg(TREND_SPEC, { width: 600, height: 320 });
    expect(JSON.stringify(TREND_SPEC)).toBe(before); // emitter-side clone: spec untouched
    expect(sized).not.toBe(intrinsic);
    // autosize:'fit' fits the WHOLE chart into the target box, so the root <svg> is the
    // requested width/height plus Vega's fixed 5px padding per side (600+10 / 320+10) —
    // the "fills its span, wide-and-short" outcome vs the intrinsic ~356×256 step size.
    expect(dim(sized, 'width')).toBe(610);
    expect(dim(sized, 'height')).toBe(330);
    // ...and materially wider than the intrinsic render it replaces (span-filling).
    expect(dim(sized, 'width')).toBeGreaterThan(dim(intrinsic, 'width'));
  });

  it('s149 F6a: the width/height option is deterministic (byte-stable run-to-run)', async () => {
    const a = await renderVegaLiteToSvg(BREAKDOWN_SPEC, { width: 600, height: 320 });
    const b = await renderVegaLiteToSvg(BREAKDOWN_SPEC, { width: 600, height: 320 });
    expect(a).toBe(b);
  });

  it('s149 F6a: a single dim override falls back to the spec value for the other axis', async () => {
    // width/height are independent options: passing one overrides that axis and leaves
    // the other at the spec's own value (TREND_SPEC ships 300×200). Only the overridden
    // axis moves off its intrinsic (5px-padded) size.
    const svgW = svgTag(await renderVegaLiteToSvg(TREND_SPEC, { width: 600 }));
    expect(svgW).toMatch(/\bwidth="610"/);
    expect(svgW).toMatch(/\bheight="210"/); // spec height 200 + 10 padding, unchanged
    const svgH = svgTag(await renderVegaLiteToSvg(TREND_SPEC, { height: 320 }));
    expect(svgH).toMatch(/\bwidth="310"/); // spec width 300 + 10 padding, unchanged
    expect(svgH).toMatch(/\bheight="330"/);
  });

  it('rejects a spec that cannot be compiled', async () => {
    // A structurally invalid spec must throw, so dashboard.render can fall back to
    // an a11y-described placeholder rather than emit broken markup.
    const broken = { mark: 'not-a-real-mark', encoding: {} } as unknown as VegaLiteSpec;
    await expect(renderVegaLiteToSvg(broken)).rejects.toBeDefined();
  });
});
