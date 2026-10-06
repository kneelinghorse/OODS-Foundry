import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { expect, it } from 'vitest';
import { VizAreaPreview } from '../src/index.js';

it('embeds a labelled static figure without altering renderer IDs or ARIA', async () => {
  const svg = '<svg role="graphics-document"><g id="area-1" role="graphics-object" aria-label="Payment amount 19"><path d="M0,0L2,2"/></g></svg>';
  const html = await renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg, title: 'Payments', description: 'Major units' }) }));
  expect(html).toContain('<figure');
  expect(html).toContain('role="img" aria-label="Payments"');
  expect(html).toContain(svg);
  expect(html).toContain('<figcaption>Payments</figcaption>');
  expect(html).not.toContain('data-viz-preview-placeholder');
  expect(await renderToString(createSSRApp(VizAreaPreview))).toContain('Area preview (640 x 360)');
  // A painted title (Vega's role-title-text) is not repeated; a title the SVG does not paint is the figure heading (Sprint 202 m01).
  const painted = '<svg><g class="mark-group role-title-text"><text>Payments</text></g></svg>';
  expect(await renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg: painted, title: 'Payments' }) }))).not.toContain('<figcaption>');
  // The narrow render sits beside the design-size one; the styles show it at 600px or less of figure width.
  const narrow = '<svg viewBox="0 0 370 230"><path d="M0,0L1,1"/></svg>';
  const both = await renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg, svgNarrow: narrow, title: 'Payments' }) }));
  expect(both).toContain('data-viz-narrow="true"');
  expect(both).toContain(`<div data-viz-svg="true">${svg}</div><div data-viz-svg-narrow="true">${narrow}</div>`);
  expect(html).not.toContain('data-viz-narrow');
  await expect(renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg, svgNarrow: '<svg><script>bad()</script></svg>' }) }))).rejects.toThrow('self-contained');
  await expect(renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg: '<svg><script>bad()</script></svg>' }) }))).rejects.toThrow('self-contained');
});

// s222-m02 (#2502 ruling 12, F7): the same per-theme layout React and the HTML renderer draw (vizPreviewLayers).
it('lays out a render per theme, each in its own theme wrapper', async () => {
  const svg = (name: string) => `<svg><title>${name}</title></svg>`;
  const html = await renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg: svg('light'), svgNarrow: svg('light narrow'), svgDark: svg('dark'), svgDarkNarrow: svg('dark narrow'), svgHc: svg('hc'), title: 'Payments' }) }));
  expect(html).toContain('<figcaption>Payments</figcaption>'
    + '<div data-viz-theme="light" data-viz-narrow="true"><div data-viz-svg="true"><svg><title>light</title></svg></div><div data-viz-svg-narrow="true"><svg><title>light narrow</title></svg></div></div>'
    + '<div data-viz-theme="dark" data-viz-narrow="true"><div data-viz-svg="true"><svg><title>dark</title></svg></div><div data-viz-svg-narrow="true"><svg><title>dark narrow</title></svg></div></div>'
    + '<div data-viz-theme="hc"><div data-viz-svg="true"><svg><title>hc</title></svg></div></div></figure>');
  expect(await renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg: svg('only') }) }))).not.toContain('data-viz-theme');
  await expect(renderToString(createSSRApp({ render: () => h(VizAreaPreview, { svg: svg('light'), svgDark: '<svg><script>bad()</script></svg>' }) }))).rejects.toThrow('self-contained');
});
