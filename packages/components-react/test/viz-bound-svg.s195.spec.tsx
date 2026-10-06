// @vitest-environment node
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { handle as renderChart } from '../../mcp-server/src/tools/viz.render.js';
import { VizLinePreview, VizMarkPreview } from '../src/index.js';

const placements = [
  { chartType: 'bar' as const, component: VizMarkPreview, id: 'VizMarkPreview', rows: [{ description: 'Scale plan', amount_minor: 284000 }], encodings: { x: { field: 'description' }, y: { field: 'amount_minor', aggregate: 'sum' as const } } },
  { chartType: 'line' as const, component: VizLinePreview, id: 'VizLinePreview', rows: [{ timestamp: '2025-06-15T00:00:00Z', value: 1200 }, { timestamp: '2025-06-20T00:00:00Z', value: 1800 }, { timestamp: '2025-06-25T00:00:00Z', value: 1500 }], encodings: { x: { field: 'timestamp', scale: 'temporal' as const }, y: { field: 'value' } } },
];

describe('bound chart React previews', () => {
  it.each(placements)('$id embeds fresh public renderer SVG byte-for-byte with no replacement pixels or controls', async ({ component: Preview, id, chartType, rows, encodings }) => {
    const result = await renderChart({ chartType, rows, encodings, name: 'Authored measurements', output: { svg: true, width: 360, height: 200 } });
    expect(result.status).toBe('ok');
    const svg = result.svg!;
    expect(svg).toContain('role-mark');
    const html = renderToStaticMarkup(<Preview svg={svg} title="Authored measurements" description="Authored units" width={360} height={200}><button>Must not replace chart</button></Preview>);
    expect(html).toContain(svg);
    expect(html).toContain(`data-oods-component="${id}"`);
    expect(html).toContain(`data-viz-preview-type="${chartType}"`);
    expect(html).toContain('data-viz-rendered="true"');
    expect(html).toContain('aria-label="Authored measurements"');
    expect(html).toContain('Authored units');
    expect(html).not.toMatch(/placeholder|No rendered chart|Must not replace chart|<button|<input|<script|<canvas/);
  });

  it.each(placements)('$id fails closed on active SVG instead of substituting a successful placeholder', ({ component: Preview }) => {
    expect(() => renderToStaticMarkup(<Preview svg='<svg><script>alert(1)</script></svg>' />)).toThrow('self-contained');
    expect(renderToStaticMarkup(<Preview />)).toContain('No rendered chart supplied');
  });
});
