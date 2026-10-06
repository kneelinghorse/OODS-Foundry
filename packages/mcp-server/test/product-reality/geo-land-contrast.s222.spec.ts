// s222-m02 (#2502 ruling 12): a mark drawn on a map's land needs 3:1 against the land (WCAG 1.4.11), in every theme the
// recipe paints. The bubble ramp once started at a step that read 1.1:1 on the light land, the dark arc read 1.5:1 at
// its opacity, and a colourless bubble map's first categorical token read 2.90:1 (A) and 2.80:1 (B) on the dark land.
import { describe, expect, it } from 'vitest';
import { contrastOnGround } from '../../../viz-core/src/adapters/spatial/geo-token-color.js';
import { resolveTokenToColor } from '@oods/viz-core';
import { handle as render } from '../../src/tools/viz.render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../tools/s172-echarts-operands.js';

const operand = (chartType: string) => renderInputFor(ECHARTS_OPERAND_CASES.find((candidate) => candidate.chartType === chartType)!) as any;
const option = async (input: Record<string, unknown>, brand: 'A' | 'B', theme: 'light' | 'dark') => {
  const out: any = await render({ ...input, brand, theme, output: { echarts: true } } as never);
  expect(out.status, JSON.stringify(out.errors)).toBe('ok');
  return out.echartsSpec as any;
};
const scopes = (['A', 'B'] as const).flatMap((brand) => (['light', 'dark'] as const).map((theme) => ({ brand, theme })));

describe('geo marks read on the land (s222-m02)', () => {
  it.each(scopes)('$brand/$theme: every default bubble colour reaches 3:1 on the land', async ({ brand, theme }) => {
    const spec = await option(operand('bubble_map'), brand, theme);
    const land = spec.geo.itemStyle.areaColor;
    const ramp: string[] = spec.visualMap.inRange.color;
    expect(ramp).toHaveLength(3);
    for (const color of ramp) expect(contrastOnGround(color, land)).toBeGreaterThanOrEqual(3);
  });

  it.each(scopes)('$brand/$theme: the default flow arc reaches 3:1 on the land at its opacity', async ({ brand, theme }) => {
    const spec = await option(operand('flow_map'), brand, theme);
    const { color, opacity } = spec.series[0].lineStyle;
    expect(contrastOnGround(color, spec.geo.itemStyle.areaColor, opacity)).toBeGreaterThanOrEqual(3);
  });

  it.each(scopes)('$brand/$theme: a bubble map with no colour field draws the first categorical token, moved only to reach 3:1', async ({ brand, theme }) => {
    const { colorField: _field, colorScale: _scale, ...geo } = operand('bubble_map').geo;
    const spec = await option({ ...operand('bubble_map'), geo }, brand, theme);
    const land = spec.geo.itemStyle.areaColor;
    const drawn = spec.series[0].itemStyle.color;
    const token = resolveTokenToColor('--oods-viz-scale-categorical-01', { brand, theme })!;
    expect(contrastOnGround(drawn, land)).toBeGreaterThanOrEqual(3);
    // I48: the token itself wherever it already passes; otherwise the nearest lightness on its own hue that does.
    if ((contrastOnGround(token, land) ?? 0) >= 3) expect(drawn).toBe(token);
    else expect(contrastOnGround(drawn, land)!).toBeLessThan(3.1);
  });
});
