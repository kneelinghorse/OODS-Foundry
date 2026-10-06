/**
 * s224-m01 (#2542 ruling 3), fixed at the producer: a line or an area reads in its rows' order. Vega-Lite sorts a
 * nominal or ordinal domain ascending when the encoding declares no sort, so months in rows Jan, Feb drew as Feb, Jan
 * and revenue that rose read as falling. The adapter now gives such an x `sort: null`, Vega-Lite's data order. A bar
 * chart keeps its ascending order, a declared sort stays the caller's, and a continuous x is never sorted.
 * (mcp-server's charts.s224.spec.ts reads the order the rendered axis draws.)
 */
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { buildVizSpecFromRows, type EncodingInput } from '../builder/spec-builder.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

type Compiled = Record<string, any>;
const scope = { theme: 'light', brand: 'A' } as const;
const months = [{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 120 }, { month: 'Mar', revenue: 90 }];
const spec = (chartType: 'line' | 'area' | 'bar', x: EncodingInput | string, rows: Array<Record<string, unknown>> = months) =>
  buildVizSpecFromRows({ chartType, rows, encodings: { x, y: 'revenue' } }).spec;
const xOf = (compiled: Compiled): Compiled => (compiled.encoding ?? compiled.layer?.[0]?.encoding).x;
const layerXs = (compiled: Compiled): Compiled[] => compiled.layer.map((layer: Compiled) => layer.encoding.x);

describe("a line or an area keeps its rows' order (s224-m01, #2542 ruling 3)", () => {
  it('gives a line or an area over a nominal or ordinal x data order, where Vega-Lite would sort it', () => {
    for (const chartType of ['line', 'area'] as const) {
      expect(xOf(toVegaLiteSpec(spec(chartType, 'month'), scope)), chartType).toMatchObject({ field: 'month', type: 'nominal', sort: null });
      expect(xOf(toVegaLiteSpec(spec(chartType, { field: 'month', scale: 'point' }), scope)), chartType).toMatchObject({ type: 'ordinal', sort: null });
    }
  });

  it('keeps a bar chart ascending, and a declared sort as declared', () => {
    expect(xOf(toVegaLiteSpec(spec('bar', 'month'), scope))).not.toHaveProperty('sort');
    expect(xOf(toVegaLiteSpec(spec('line', { field: 'month', sort: 'descending' }), scope))).toMatchObject({ sort: 'descending' });
    expect(xOf(toVegaLiteSpec(spec('area', { field: 'month', sort: { field: 'revenue', order: 'ascending' } }), scope)))
      .toMatchObject({ sort: { field: 'revenue', order: 'ascending' } });
  });

  it("spells a declared 'none' null, which Vega-Lite reads as no sort ('none' is not one of its sort values)", () => {
    // The placed payment chart declares it on a bar's ordinal x (codegen/chart-assets.ts).
    expect(xOf(toVegaLiteSpec(spec('bar', { field: 'month', type: 'ordinal', sort: 'none' }), scope))).toMatchObject({ sort: null });
    expect(xOf(toVegaLiteSpec(spec('line', { field: 'month', sort: 'none' }), scope))).toMatchObject({ sort: null });
  });

  it('leaves a continuous or bucketed x alone: temporal, a time unit, binned', () => {
    const dated = [{ day: '2026-01-03', revenue: 1 }, { day: '2026-01-01', revenue: 2 }];
    expect(xOf(toVegaLiteSpec(spec('line', { field: 'day', scale: 'temporal' }, dated), scope))).not.toHaveProperty('sort');
    expect(xOf(toVegaLiteSpec(spec('area', { field: 'day', timeUnit: 'month', type: 'ordinal' }, dated), scope))).not.toHaveProperty('sort');
    const binned = spec('line', 'month');
    binned.encoding.x = { ...binned.encoding.x!, bin: true };
    expect(xOf(toVegaLiteSpec(binned, scope))).not.toHaveProperty('sort');
  });

  it('orders every layer that shares the x, since one ascending layer would sort the domain they union', () => {
    const base = spec('line', 'month');
    const layered = (traits: string[]) => ({ ...base, marks: traits.map((trait) => ({ trait })) }) as NormalizedVizSpec;
    for (const traits of [['MarkLine', 'MarkPoint'], ['MarkBar', 'MarkLine']]) {
      expect(layerXs(toVegaLiteSpec(layered(traits), scope)).map((x) => x.sort), traits.join('+')).toEqual([null, null]);
    }
    // Without a line or an area there is nothing to keep in order: a bar and its points stay ascending.
    expect(layerXs(toVegaLiteSpec(layered(['MarkBar', 'MarkPoint']), scope)).map((x) => 'sort' in x)).toEqual([false, false]);
  });
});
