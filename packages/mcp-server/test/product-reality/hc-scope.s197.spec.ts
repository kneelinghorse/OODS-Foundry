import { describe, expect, it } from 'vitest';
import { handle as render } from '../../src/tools/viz.render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../tools/s172-echarts-operands.js';
import { undeclaredHcPaints } from '../../../../scripts/product-reality/s197-hc-scope.js';

// These are compile-only checks. They do not relax the SVG paint guard or claim
// that the nine deferred families now have certified forced-colors pixels.
describe('HC compiler chrome uses declared scope roles (s197)', () => {
  it.each(['treemap', 'choropleth', 'bubble_map', 'flow_map'])('%s replaces its unscoped chrome literal only in HC', async chartType => {
    const operand = ECHARTS_OPERAND_CASES.find(row => row.chartType === chartType)!;
    for (const theme of ['light', 'dark', 'hc'] as const) {
      const output = await render({ ...renderInputFor(operand), theme, output: { svg: false, echarts: true } });
      expect(output.status, JSON.stringify(output.errors)).toBe('ok');
      expect(output.svg).toBeUndefined();
      const option = output.echartsSpec as any;
      const paint = chartType === 'treemap' ? option.series[0].emphasis.itemStyle.shadowColor : option.geo.itemStyle.areaColor;
      // s222-m02 (#2510): the land is the theme's neutral step 3 (it read a token that did not exist and painted #f2f2f2 in
      // every theme), so light and dark differ; only hc takes the system colour.
      expect(paint).toBe(theme === 'hc' ? 'Canvas' : chartType === 'treemap' ? 'rgba(0, 0, 0, 0.05)' : theme === 'dark' ? 'rgb(38, 38, 38)' : 'rgb(245, 245, 245)');
    }
  });
  it('the census fails an undeclared or malformed paint instead of passing an empty measurement', () => {
    const roles = [{ role: 'axis', value: 'CanvasText' }, { role: 'mark', value: '#123456' }, { role: 'focus', value: 'invalid-paint' }];
    expect(undeclaredHcPaints(roles, ['CanvasText', '#000000'])).toEqual(roles.slice(1));
    expect(undeclaredHcPaints(roles.slice(0, 1), [])).toEqual(roles.slice(0, 1));
  });
});
