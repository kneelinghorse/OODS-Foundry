import { expect, it } from 'vitest';
import { renderMappedComponent } from '../../src/render/component-map.js';

it('preserves static chart bytes while escaping the surrounding figure copy', () => {
  const svg = '<svg role="graphics-document"><g id="area-1" role="graphics-object" aria-label="Payment amount 19"><path d="M0,0L2,2"/></g></svg>';
  const node = { id: 'chart', component: 'VizAreaPreview', props: { svg, title: 'Payments & dates', description: '<major units>' } };
  const html = renderMappedComponent(node);
  expect(html).toContain('<figure');
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Payments &amp; dates"');
  expect(html).toContain(svg);
  expect(html).toContain('&lt;major units&gt;');
  expect(html).not.toContain('data-viz-preview-placeholder');
  expect(renderMappedComponent({ id: 'empty', component: 'VizAreaPreview' })).toContain('Area preview (640 x 360)');
  expect(() => renderMappedComponent({ ...node, props: { svg: '<svg><use href="https://example.com/a.svg"/></svg>' } })).toThrow('self-contained');
});
