import { describe, expect, it, vi } from 'vitest';
import * as echarts from 'echarts';
import { adaptSankeyToECharts } from '../src/adapters/echarts/sankey-adapter.js';
import { adaptTreemapToECharts } from '../src/adapters/echarts/treemap-adapter.js';
import { applyHcEchartsChrome, resolveOodsEchartsChrome } from '../src/tokens/oods-echarts-chrome.js';
import { createVisualMapForScale } from '../src/adapters/spatial/echarts-visualmap-generator.js';
import { resolveTokenToColor } from '../src/adapters/echarts/token-resolver.js';

describe('HC chrome does not replace data encodings (s199)', () => {
  const chrome = resolveOodsEchartsChrome({}, { theme: 'hc' });
  it.each(['light', 'dark'] as const)('%s preserves the exact original option', theme => {
    const option = { title: { text: 'Chart' }, legend: {}, visualMap: { inRange: { color: ['red'] } }, series: [{ data: [1] }] };
    expect(applyHcEchartsChrome(option, chrome, { theme })).toBe(option);
  });
  it('decorates scalar/array chrome without mutating series or hidden width mapping', () => {
    const widthMap = { show: false, inRange: { lineWidth: [1, 6] } };
    const series = [{ data: [1, 2] }];
    const option = { title: [{ text: 'A' }], legend: [{ data: ['a'] }], visualMap: widthMap, series };
    const result = applyHcEchartsChrome(option, chrome, { theme: 'hc' });
    expect(result.series).toBe(series);
    expect(result.visualMap).toBe(widthMap);
    expect(result.title[0]).toMatchObject({ textStyle: { color: 'CanvasText' }, backgroundColor: 'transparent' });
    expect(result.legend[0]).toMatchObject({ textStyle: { color: 'CanvasText' } });
    expect(option.title[0]).toEqual({ text: 'A' });
  });
  it.each(['linear', 'diverging'] as const)('%s numeric HC mapping carries declared literal pieces without interpolation', scale => {
    const mapped = createVisualMapForScale({ scope: { theme: 'hc' }, scale, values: [-2, 8] }) as any;
    expect(mapped.type).toBe('piecewise');
    expect(mapped.pieces).toHaveLength(3);
    expect(mapped.inRange).toBeUndefined();
    expect(mapped.pieces.map((piece:any) => piece.color)).toEqual((scale === 'linear'
      ? ['--oods-viz-scale-sequential-01', '--oods-viz-scale-sequential-05', '--oods-viz-scale-sequential-07']
      : ['--oods-viz-scale-diverging-neg-05', '--oods-viz-scale-diverging-neutral', '--oods-viz-scale-diverging-pos-05'])
      .map(token => resolveTokenToColor(token, { theme: 'hc' })));
    expect(mapped.pieces[0].min).toBe(scale === 'diverging' ? -8 : -2);
    expect(mapped.pieces.at(-1).max).toBe(8);
  });
});

it('explicit HC node colors avoid native palette fallback warnings while retaining visible geometry', () => {
  const spec = { id: 'hc-parser-bite', name: 'Declared nodes', config: {}, a11y: { description: 'Declared nodes' } } as any;
  const options = [
    adaptSankeyToECharts(spec, { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 5 }] }, { theme: 'hc' }),
    adaptTreemapToECharts(spec, { data: { name: 'root', children: [{ name: 'A', value: 2 }, { name: 'B', value: 3 }] } } as any, { theme: 'hc' }),
  ];
  const warn = vi.spyOn(console, 'warn');
  try {
    for (const option of options) {
      const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 400 });
      try {
        chart.setOption({ ...option, animation: false });
        expect(chart.renderToSVGString()).toContain('fill="CanvasText"');
      } finally { chart.dispose(); }
    }
    expect(warn.mock.calls.flat().filter(message => String(message).includes('illegal color'))).toEqual([]);
  } finally { warn.mockRestore(); }
});
