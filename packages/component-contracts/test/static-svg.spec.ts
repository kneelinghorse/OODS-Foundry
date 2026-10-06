import { describe, expect, it } from 'vitest';
import { assertStaticSvg } from '../src/static-svg.js';
import samples from '../fixtures/viz-preview-samples.v1.json';

describe('passive SVG boundary', () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-document"><defs><clipPath id="clip-1"><rect width="20" height="20"/></clipPath></defs><g role="graphics-object" aria-label="A &amp; B" clip-path="url(#clip-1)"><path d="M0,0L20,20"/></g></svg>';
  it('retains every byte of IDs, local references and renderer accessibility', () => {
    expect(assertStaticSvg(safe)).toBe(safe);
  });
  it('preserves the exact public ECharts graph with bounded local hover and font CSS', () => {
    const graph = samples.samples.VizGraphPreview.svg;
    expect(graph).toContain('<![CDATA[');
    expect(graph).toContain('style="font-size:');
    expect(assertStaticSvg(graph)).toBe(graph);
  });
  it('accepts a render-scoped local ECharts selector while keeping external paints forbidden (s228-m01)', () => {
    const graph = samples.samples.VizGraphPreview.svg.replace(/oods-zr-(\d+)/g, 'oods-zr-record-1-hc-design-$1');
    expect(assertStaticSvg(graph)).toBe(graph);
    expect(() => assertStaticSvg('<svg><style><![CDATA[.oods-zr-record-1-hc-design-0:hover{fill:url(https://example.com/x)}]]></style></svg>')).toThrow('self-contained');
  });
  it.each([
    '.oods-zr-0:hover{fill:url(https://example.com/x)}',
    '.oods-zr-0:hover{fill:u\\72l(https://example.com/x)}',
    '.oods-zr-0:hover{fill:var(--remote)}',
    '.oods-zr-0:hover{filter:url(#x)}',
    'body{fill:red}', '.oods-zr-0:hover{cursor:url(https://example.com/x)}',
    '@import "https://example.com/x";', '.oods-zr-0:hover{fill:CanvasText!important}',
  ])('rejects CSS outside the renderer-local paint grammar (%s)', css => {
    expect(() => assertStaticSvg(`<svg><style><![CDATA[${css}]]></style></svg>`)).toThrow('self-contained');
  });
  it.each([
    '<script>alert(1)</script>', '<foreignObject><div>HTML</div></foreignObject>',
    '<image href="https://example.com/a.png"/>', '<use href="https://example.com/a.svg#x"/>',
    '<use href="data:image/svg+xml,anything"/>', '<use href="javascript:alert(1)"/>',
    '<g onload="alert(1)"/>', '<g style="fill:url(https://example.com/a.svg)"/>',
    '<g style="fill:u&#114;l(https://example.com/a.svg)"/>',
    '<g style="fill:u\\72l(https://example.com/a.svg)"/>',
    '<g fill="u\\72l(https://example.com/a.svg)"/>',
    '<g style="background:image-set(\'https://example.com/a.png\')"/>',
    '<text style="font-family:url(https://example.com/font)">Label</text>',
    '<text style="font-size:expression(alert(1))">Label</text>',
    '<text style="font-family:sans-serif;background:red">Label</text>',
    '<style>@import "https://example.com/a.css";</style>',
    '<g xml:base="https://example.com/"><use href="#x"/></g>',
    '<g aria-label=noquotes/>', '<animate attributeName="href" to="https://example.com"/>',
    '<!DOCTYPE svg>', '<g aria-label="&Tab;"/>',
  ])('rejects active or externally dependent content: %s', content => {
    expect(() => assertStaticSvg(`<svg>${content}</svg>`)).toThrow('self-contained static SVG');
  });
});
