import { describe, expect, it } from 'vitest';
import { preserveQuantizedSymbolLegends, renderVegaLiteToSvg } from '../src/emitter.js';
import { renderEChartsToSvg } from '../src/echarts-renderer.js';

describe('native renderer paint boundaries (s199)', () => {
  it('restores only requested quantized symbol legends and retains unrelated gradients', () => {
    const source = { encoding: { color: { field: 'amount', scale: { type: 'quantize' }, legend: { type: 'symbol' } } } };
    const compiled = { scales: [{ name: 'amountScale', type: 'quantize', domain: { field: 'amount' } }, { name: 'otherScale', type: 'quantize', domain: { field: 'other' } }], legends: [{ fill: 'amountScale' }, { fill: 'otherScale' }] };
    preserveQuantizedSymbolLegends(source, compiled);
    expect(compiled.legends).toEqual([{ fill: 'amountScale', type: 'symbol' }, { fill: 'otherScale' }]);
    const unchanged = { legends: [{ fill: 'amountScale' }] };
    preserveQuantizedSymbolLegends({}, unchanged);
    expect(unchanged).toEqual({ legends: [{ fill: 'amountScale' }] });
  });
  it('quantized colors render discrete symbols instead of the native fallback gradient border', async () => {
    const svg = await renderVegaLiteToSvg({
      data: { values: [{ category: 'A', amount: 2 }, { category: 'B', amount: 8 }] },
      config: { view: { stroke: null } }, mark: 'rect', encoding: { x: { field: 'category', type: 'nominal' }, color: { field: 'amount', type: 'quantitative', scale: { type: 'quantize', range: ['Canvas', 'CanvasText'] }, legend: { type: 'symbol', symbolStrokeColor: 'CanvasText' } } },
    } as any);
    expect(svg).toContain('role-legend-symbol');
    expect(svg).not.toContain('role-legend-band');
    expect(svg).not.toContain('stroke="#ddd"');
  });
  it('native chord preserves the source ribbon fill and suppresses only its meaningless zero-width stroke', async () => {
    const option = { animation: false, series: [{ type: 'chord', data: [{ name: 'A', itemStyle: { color: '#123456' } }, { name: 'B', itemStyle: { color: '#abcdef' } }], links: [{ source: 'A', target: 'B', value: 4 }], lineStyle: { color: 'source', width: 0 }, emphasis: { disabled: true } }] };
    const svg = await renderEChartsToSvg(option);
    expect(svg).toContain('fill="#123456"');
    expect(svg).not.toContain('stroke="source"');
    expect(svg).toMatch(/fill="#123456"[^>]*stroke="none"[^>]*stroke-width="0"/);
    const visibleStroke = await renderEChartsToSvg({ ...option, series: [{ ...option.series[0], lineStyle: { color: '#654321', width: 2 } }] });
    expect(visibleStroke).toContain('stroke="#654321"');
    expect(visibleStroke).toContain('stroke-width="2"');
  });
});
