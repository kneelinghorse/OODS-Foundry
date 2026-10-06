// s172 m06 — the bubble_map per-datum size scale.
//
// The served-option half of this fix lives in the mcp-server suite (the defect was a
// wire-serialization defect, so it can only be proven at the wire). This file proves the
// MATHS: that moving the scale from a series-level closure to a per-datum number changed
// WHERE it runs and nothing else.
//
// The expectations are computed from the documented curve INDEPENDENTLY of the
// implementation — `minSize + (maxSize - minSize) * curve(ratio)` written out here — rather
// than by calling the function under test twice. An oracle that reuses the SUT certifies
// only that the SUT is consistent with itself.

import { describe, expect, it } from 'vitest';
import { buildSizeFunction } from './echarts-bubble-adapter.js';
import { adaptBubbleToECharts } from './echarts-bubble-adapter.js';
import type { SpatialSpec } from '../../spec/spatial.js';

const RANGE: [number, number] = [6, 28];

/** The independently-written oracle: the curve as documented, not as implemented. */
function expectedSize(value: number, min: number, max: number, curve: 'linear' | 'sqrt' | 'log'): number {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = curve === 'log' ? Math.log10(1 + ratio * 9) : curve === 'sqrt' ? Math.sqrt(ratio) : ratio;
  return RANGE[0] + (RANGE[1] - RANGE[0]) * scaled;
}

describe('bubble_map size scale — the maths is unchanged by the per-datum move (s172 m06)', () => {
  it('linear: endpoints hit the range exactly and the midpoint interpolates', () => {
    const size = buildSizeFunction([0, 100], RANGE, undefined);
    expect(size(0)).toBe(6);
    expect(size(100)).toBe(28);
    expect(size(50)).toBeCloseTo(expectedSize(50, 0, 100, 'linear'), 12);
    expect(size(50)).toBeCloseTo(17, 12);
  });

  it('sqrt: the curve is genuinely sqrt, not linear — the midpoint differs measurably', () => {
    const size = buildSizeFunction([0, 100], RANGE, 'sqrt');
    expect(size(50)).toBeCloseTo(expectedSize(50, 0, 100, 'sqrt'), 12);
    // Discriminating: a linear implementation would give 17 here.
    expect(size(50)).not.toBeCloseTo(17, 3);
    expect(size(0)).toBe(6);
    expect(size(100)).toBe(28);
  });

  it('log: the curve is genuinely log, distinct from BOTH linear and sqrt at the midpoint', () => {
    const size = buildSizeFunction([0, 100], RANGE, 'log');
    expect(size(50)).toBeCloseTo(expectedSize(50, 0, 100, 'log'), 12);
    expect(size(50)).not.toBeCloseTo(expectedSize(50, 0, 100, 'linear'), 3);
    expect(size(50)).not.toBeCloseTo(expectedSize(50, 0, 100, 'sqrt'), 3);
    expect(size(0)).toBe(6);
    expect(size(100)).toBe(28);
  });

  it('a degenerate domain (all values equal) collapses to the range MIDPOINT, not to the floor', () => {
    const size = buildSizeFunction([50, 50], RANGE, undefined);
    expect(size(50)).toBe(17);
    expect(size(999)).toBe(17);
  });

  it('an unresolvable value falls back to the range floor', () => {
    const size = buildSizeFunction([0, 100], RANGE, undefined);
    expect(size(null)).toBe(6);
    expect(size('not a number')).toBe(6);
  });

  it('values outside the domain CLAMP rather than escaping the range', () => {
    const size = buildSizeFunction([10, 20], RANGE, undefined);
    expect(size(-5)).toBe(6);
    expect(size(9999)).toBe(28);
  });
});

describe('bubble_map adapter emits per-datum numbers, not a series closure (s172 m06)', () => {
  const spec: SpatialSpec = {
    id: 'viz:bubble',
    name: 'Cities',
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lng' },
          latitude: { field: 'lat' },
          size: { field: 'pop' },
        },
      },
    ],
    a11y: { description: 'Bubble map of cities.' },
  } as unknown as SpatialSpec;

  const rows = [
    { city: 'A', lng: -122, lat: 37, pop: 100 },
    { city: 'B', lng: -115, lat: 36, pop: 300 },
    { city: 'C', lng: -119, lat: 39, pop: 500 },
  ];

  it('the series carries NO symbolSize; every datum carries its own NUMBER', () => {
    const option = adaptBubbleToECharts(spec, undefined, rows, { width: 860, height: 520 }) as Record<string, unknown>;
    const series = (option.series as Array<Record<string, unknown>>)[0];
    expect('symbolSize' in series).toBe(false);
    const data = series.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(3);
    for (const datum of data) {
      expect(typeof datum.symbolSize).toBe('number');
    }
  });

  it('those numbers match the independently-computed linear scale over the data domain', () => {
    const option = adaptBubbleToECharts(spec, undefined, rows, { width: 860, height: 520 }) as Record<string, unknown>;
    const data = ((option.series as Array<Record<string, unknown>>)[0].data) as Array<Record<string, unknown>>;
    const sizes = data.map((datum) => datum.symbolSize as number);
    expect(sizes[0]).toBeCloseTo(expectedSize(100, 100, 500, 'linear'), 12);
    expect(sizes[1]).toBeCloseTo(expectedSize(300, 100, 500, 'linear'), 12);
    expect(sizes[2]).toBeCloseTo(expectedSize(500, 100, 500, 'linear'), 12);
    // And concretely: 6, 17, 28.
    expect(sizes).toEqual([6, 17, 28]);
  });

  it('with NO size encoding every datum still gets a number (the floor) — never an absent key', () => {
    const sizeless = {
      ...spec,
      layers: [{ type: 'symbol', encoding: { longitude: { field: 'lng' }, latitude: { field: 'lat' } } }],
    } as unknown as SpatialSpec;
    const option = adaptBubbleToECharts(sizeless, undefined, rows, { width: 860, height: 520 }) as Record<string, unknown>;
    const data = ((option.series as Array<Record<string, unknown>>)[0].data) as Array<Record<string, unknown>>;
    expect(data.map((datum) => datum.symbolSize)).toEqual([6, 6, 6]);
  });
});
