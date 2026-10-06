/**
 * s223-m01 (#2527 ruling 8): in high contrast a bubble map's value bins were the sequential steps 01, 05 and 07, and its
 * lowest bin (01, oklch(0.94 0 265), fallback #EBEBEB) all but vanished on the white Canvas land, 1.2:1; its ordinal
 * colours began at 03, 2.3:1. hc's bubbles take steps 05, 07 and 09, each clearing 3:1 on white as ECharts draws a
 * scatter bubble, at 0.8 opacity. A choropleth's hc bins are the regions themselves and do not change.
 */
import { describe, expect, it } from 'vitest';
import { adaptBubbleToECharts, adaptChoroplethToECharts, getVizScaleTokens, type SpatialSpec } from '@oods/viz-core';
import { contrastOnGround, resolveColor } from '../src/adapters/spatial/geo-token-color.js';

const hc = { theme: 'hc', brand: 'A' } as const;
const CITIES = [
  { city: 'Alder', lng: -121, lat: 44, pop: 120, region: 'west' },
  { city: 'Birch', lng: -117, lat: 36, pop: 410, region: 'west' },
  { city: 'Cedar', lng: -102, lat: 43, pop: 900, region: 'east' },
];
const spec = (color: Record<string, unknown>): SpatialSpec => ({
  id: 'viz:bubble-hc', name: 'City population', type: 'spatial', data: { values: [] },
  layers: [{ type: 'symbol', encoding: { longitude: { field: 'lng' }, latitude: { field: 'lat' }, size: { field: 'pop', scale: 'sqrt' }, color } }],
  a11y: { description: 'Population by city.' },
} as SpatialSpec);
const step = (n: number) => resolveColor(`var(${(getVizScaleTokens('sequential') as string[])[n - 1]})`, hc);
/** The sRGB hex of an hc grey: OKLCH at zero chroma is linear light L³ in every channel. */
const grey = (oklch: string) => {
  const lightness = Number(/^oklch\(([\d.]+) 0 /.exec(oklch)?.[1]);
  const linear = lightness ** 3;
  const channel = Math.round(255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055));
  return `#${channel.toString(16).padStart(2, '0').repeat(3)}`;
};

describe('hc bubbles clear 3:1 on the land (s223-m01)', () => {
  it('bins a bubble map\'s values in steps 05, 07 and 09, each at least 3:1 on white at the bubbles\' 0.8 opacity', () => {
    const option = adaptBubbleToECharts(spec({ field: 'pop', scale: 'linear' }), undefined, CITIES, { width: 720, height: 480 }, hc);
    const pieces = (option.visualMap as { pieces: Array<{ color: string }> }).pieces.map(piece => piece.color);
    expect(pieces).toEqual([step(5), step(7), step(9)]);
    for (const color of pieces) expect(contrastOnGround(grey(color), '#FFFFFF', 0.8)!, color).toBeGreaterThanOrEqual(3);
    // The step it replaced, for the record: 01 read about 1.2:1.
    expect(contrastOnGround(grey(step(1)), '#FFFFFF')!).toBeLessThan(1.3);
  });

  it('colours ordinal bubbles from the same steps (they began at 03, 2.3:1)', () => {
    const option = adaptBubbleToECharts(spec({ field: 'region', scale: 'ordinal' }), undefined, CITIES, { width: 720, height: 480 }, hc);
    const colors = [...new Set(((option.series as Array<{ data: Array<{ itemStyle?: { color?: string } }> }>)[0]!.data).map(point => point.itemStyle!.color!))];
    expect(colors).toEqual([step(5), step(7)]);
  });

  it('leaves a choropleth\'s hc bins as they were: there the bin is the region, not a mark on the land', () => {
    const geojson = { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 'W', properties: { name: 'W' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } },
      { type: 'Feature', id: 'E', properties: { name: 'E' }, geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] } },
    ] };
    const choropleth = {
      id: 'viz:choropleth-hc', name: 'Sales', type: 'spatial', data: { values: [] }, a11y: { description: 'Sales by region.' },
      layers: [{ type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } }],
    } as unknown as SpatialSpec;
    const option = adaptChoroplethToECharts(choropleth, geojson as never, [{ name: 'W', sales: 1 }, { name: 'E', sales: 9 }], { width: 400, height: 300 }, hc);
    const pieces = ((Array.isArray(option.visualMap) ? option.visualMap[0] : option.visualMap) as { pieces: Array<{ color: string }> }).pieces.map(piece => piece.color);
    expect(pieces).toEqual([step(1), step(5), step(7)]);
  });
});
