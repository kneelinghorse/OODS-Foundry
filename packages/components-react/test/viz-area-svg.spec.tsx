import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { VizAreaPreview } from '../src/index.js';

it('embeds a labelled static figure without altering renderer IDs or ARIA', () => {
  const svg = '<svg role="graphics-document"><g id="area-1" role="graphics-object" aria-label="Payment amount 19"><path d="M0,0L2,2"/></g></svg>';
  const html = renderToStaticMarkup(<VizAreaPreview svg={svg} title="Payments" description="Major units" />);
  expect(html).toContain('<figure');
  expect(html).toContain('role="img" aria-label="Payments"');
  expect(html).toContain(svg);
  expect(html).toContain('<figcaption>Payments</figcaption>');
  expect(html).not.toContain('data-viz-preview-placeholder');
  expect(renderToStaticMarkup(<VizAreaPreview />)).toContain('Area preview (640 x 360)');
  // A painted title (Vega's role-title-text) is not repeated; a title the SVG does not paint is the figure heading (Sprint 202 m01).
  const painted = '<svg><g class="mark-group role-title-text"><text>Payments</text></g></svg>';
  expect(renderToStaticMarkup(<VizAreaPreview svg={painted} title="Payments" />)).not.toContain('<figcaption>');
  // The narrow render sits beside the design-size one; the styles show it at 600px or less of figure width.
  const narrow = '<svg viewBox="0 0 370 230"><path d="M0,0L1,1"/></svg>';
  const both = renderToStaticMarkup(<VizAreaPreview svg={svg} svgNarrow={narrow} title="Payments" />);
  expect(both).toContain('data-viz-narrow="true"');
  expect(both).toContain(`<div data-viz-svg="true">${svg}</div><div data-viz-svg-narrow="true">${narrow}</div>`);
  expect(html).not.toContain('data-viz-narrow');
  expect(() => renderToStaticMarkup(<VizAreaPreview svg={svg} svgNarrow='<svg><script>bad()</script></svg>' />)).toThrow('self-contained');
  expect(() => renderToStaticMarkup(<VizAreaPreview svg='<svg><script>bad()</script></svg>' />)).toThrow('self-contained');
});

// s222-m02 (#2502 ruling 12, F7): a placed chart carries a render per theme, so a generated page that switches to dark
// switches its chart. Each theme's renders sit in a [data-viz-theme] wrapper that repeats the size flags; component-styles
// shows the wrapper the nearest [data-theme] names. React, Vue and the HTML renderer lay this out from one plan
// (vizPreviewLayers), so each spec pins the same body.
it('lays out a render per theme, each in its own theme wrapper', () => {
  const svg = (name: string) => `<svg><title>${name}</title></svg>`;
  const html = renderToStaticMarkup(<VizAreaPreview svg={svg('light')} svgNarrow={svg('light narrow')} svgDark={svg('dark')} svgDarkNarrow={svg('dark narrow')} svgHc={svg('hc')} title="Payments" />);
  expect(html).toContain('<figcaption>Payments</figcaption>'
    + '<div data-viz-theme="light" data-viz-narrow="true"><div data-viz-svg="true"><svg><title>light</title></svg></div><div data-viz-svg-narrow="true"><svg><title>light narrow</title></svg></div></div>'
    + '<div data-viz-theme="dark" data-viz-narrow="true"><div data-viz-svg="true"><svg><title>dark</title></svg></div><div data-viz-svg-narrow="true"><svg><title>dark narrow</title></svg></div></div>'
    + '<div data-viz-theme="hc"><div data-viz-svg="true"><svg><title>hc</title></svg></div></div></figure>');
  // Without dark or hc renders nothing is wrapped: the one set shows in every theme, as before.
  expect(renderToStaticMarkup(<VizAreaPreview svg={svg('only')} />)).not.toContain('data-viz-theme');
  expect(() => renderToStaticMarkup(<VizAreaPreview svg={svg('light')} svgDark='<svg><script>bad()</script></svg>' />)).toThrow('self-contained');
});
