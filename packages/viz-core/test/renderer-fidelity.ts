import { expect } from 'vitest';
import { toEChartsOption } from '../src/adapters/echarts-adapter.js';
import { toVegaLiteSpec } from '../src/adapters/vega-lite-adapter.js';
import { selectVizRenderer } from '../src/adapters/renderer-selector.js';
import type { NormalizedVizSpec } from '../src/spec/normalized-viz-spec.js';

type ObjectValue = Record<string, any>;
function units(value: ObjectValue): ObjectValue[] {
  if (value.mark) return [value];
  if (value.spec) return units(value.spec);
  return ['layer', 'concat', 'hconcat', 'vconcat'].flatMap((key) => (value[key] ?? []).flatMap(units));
}

/** Field use is checked in the selected renderer's drawing operands, never usermeta or tooltip. */
export function assertRendererFidelity(spec: NormalizedVizSpec): void {
  const renderer = selectVizRenderer(spec).renderer;
  const maps = spec.marks.map((mark) => ({ ...spec.encoding, ...mark.encodings }));
  if (renderer === 'vega-lite') {
    const rendered = units(toVegaLiteSpec(spec));
    expect(rendered.length, `${spec.id}: selected renderer lost a mark`).toBeGreaterThanOrEqual(maps.length);
    for (const map of maps) {
      expect(rendered.some((unit) => Object.entries(map).every(([channel, binding]) => {
        const encoded = unit.encoding?.[channel];
        return [encoded, encoded?.condition].flat().some((entry) => entry?.field === binding?.field);
      })), `${spec.id}: Vega-Lite dropped a declared mark encoding ${JSON.stringify(map)}`).toBe(true);
    }
    return;
  }
  const option = toEChartsOption(spec);
  const visualMaps = [option.visualMap].flat().filter(Boolean) as ObjectValue[];
  const widths = spec.marks.map((mark, index) => (mark.trait === 'MarkArea' || mark.trait === 'MarkBar') && (maps[index].x2 || maps[index].y2) ? 2 : 1);
  const stride = widths.reduce((sum, width) => sum + width, 0);
  expect(option.series.length % stride).toBe(0);
  expect(option.series.length).toBeGreaterThanOrEqual(stride);
  for (const [markIndex, map] of maps.entries()) {
    const offset = widths.slice(0, markIndex).reduce((sum, width) => sum + width, 0);
    const seriesForMark = option.series.filter((_, index) => index % stride >= offset && index % stride < offset + widths[markIndex]);
    for (const [channel, binding] of Object.entries(map)) {
      if (!binding) continue;
      const key = ({ color: 'itemName', size: 'size', detail: 'detail', shape: 'shape' } as ObjectValue)[channel] ?? channel;
      const used = seriesForMark.some((series) => [series.encode[key as keyof typeof series.encode]].flat().includes(binding.field)) ||
        (channel === 'color' && visualMaps.some((entry) => entry.dimension === binding.field));
      if (channel === 'x2' || channel === 'y2') {
        const axis = channel[0] as 'x' | 'y';
        const lower = map[axis]?.field;
        const pairs = seriesForMark.filter((series) => series.stack && series.encode[axis] === lower);
        expect(pairs.length, `${spec.id}: ECharts dropped ${channel}`).toBeGreaterThan(0);
        for (const base of pairs) {
          const range = seriesForMark.find((series) => series !== base && series.stack === base.stack && series.datasetId === base.datasetId);
          expect(range, `${spec.id}: missing band difference series`).toBeDefined();
          expect(base.stackStrategy).toBe('all');
          expect(range?.stackStrategy).toBe('all');
          let dataset = option.dataset.find((entry) => entry.id === base.datasetId);
          while (dataset?.fromDatasetId) dataset = option.dataset.find((entry) => entry.id === dataset!.fromDatasetId);
          expect(dataset?.source?.length, `${spec.id}: band has no value proof`).toBeGreaterThan(0);
          for (const row of dataset!.source!) {
            expect(Number(row[lower!]) + Number(row[range!.encode[axis] as string])).toBeCloseTo(Number(row[binding.field]), 10);
          }
        }
      } else {
        expect(used, `${spec.id}: ECharts dropped ${channel}:${binding.field}`).toBe(true);
      }
    }
  }
}
