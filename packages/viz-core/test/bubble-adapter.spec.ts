import { describe, expect, it } from 'vitest';
import { adaptBubbleToECharts, type SpatialSpec } from '@oods/viz-core';

// sprint-112 m01 — the bubble_map (symbol) geo beachhead. Pins the WHY of the
// headless bubble path: the scatter series is built from the SEPARATE tabular
// `data` param on a 'geo' coordinate system, a numeric colour field drives a
// continuous visualMap (dimension 3) while an ordinal colour field paints
// per-point itemStyle colours, and the option is deterministic.

const DIMENSIONS = { width: 720, height: 480 } as const;

const CITIES = [
  { city: 'SF', lng: -122.4, lat: 37.8, pop: 870 },
  { city: 'LA', lng: -118.2, lat: 34.0, pop: 3990 },
];

function bubbleSpec(overrides: Partial<SpatialSpec> = {}): SpatialSpec {
  return {
    id: 'viz:bubble-test',
    name: 'City Population',
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lng' },
          latitude: { field: 'lat' },
          size: { field: 'pop', scale: 'sqrt' },
          color: { field: 'pop', scale: 'linear' },
        },
      },
    ],
    a11y: { description: 'Population by city.' },
    ...overrides,
  };
}

describe('adaptBubbleToECharts — decoupled spec+rows → renderable geo-scatter option', () => {
  it('builds a geo-anchored scatter series from the tabular data param', () => {
    const option = adaptBubbleToECharts(bubbleSpec(), undefined, CITIES, DIMENSIONS);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('scatter');
    expect(series.coordinateSystem).toBe('geo');

    const seriesData = series.data as Array<{ value: number[] }>;
    expect(seriesData).toHaveLength(2);
    // value = [lng, lat, size, color] — the lng/lat anchor the point on the geo CS.
    expect(seriesData[0].value[0]).toBe(-122.4);
    expect(seriesData[0].value[1]).toBe(37.8);
  });

  it('drives a continuous visualMap (dimension 3) from a numeric colour field', () => {
    const option = adaptBubbleToECharts(bubbleSpec(), undefined, CITIES, DIMENSIONS);
    const visualMap = option.visualMap as { min?: number; max?: number; dimension?: number };
    expect(visualMap.dimension).toBe(3);
    expect(visualMap.min).toBe(870);
    expect(visualMap.max).toBe(3990);
  });

  it('paints per-point itemStyle colours for an ordinal colour field (no visualMap)', () => {
    const spec = bubbleSpec({
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lng' },
            latitude: { field: 'lat' },
            color: { field: 'region', scale: 'ordinal' },
          },
        },
      ],
    });
    const rows = [
      { lng: -122.4, lat: 37.8, region: 'west' },
      { lng: -73.9, lat: 40.7, region: 'east' },
    ];
    const option = adaptBubbleToECharts(spec, undefined, rows, DIMENSIONS);

    expect(option.visualMap).toBeUndefined();
    const seriesData = option.series as Record<string, unknown>[];
    const points = (seriesData[0].data as Array<{ itemStyle?: { color?: string } }>);
    for (const point of points) {
      expect(point.itemStyle?.color).toBeDefined();
    }
  });

  it('emits RESOLVED colours (rgb/hex) through the shared resolver, never `var(--token)`', () => {
    // Ordinal colour field exercises the per-point itemStyle palette (written
    // straight into the option) — the strictest no-var() path.
    const spec = bubbleSpec({
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lng' },
            latitude: { field: 'lat' },
            color: { field: 'region', scale: 'ordinal' },
          },
        },
      ],
    });
    const rows = [
      { lng: -122.4, lat: 37.8, region: 'west' },
      { lng: -73.9, lat: 40.7, region: 'east' },
    ];
    const option = adaptBubbleToECharts(spec, undefined, rows, DIMENSIONS);
    const serialized = JSON.stringify(option);
    expect(serialized).not.toContain('var(');
    const points = (option.series as Record<string, unknown>[])[0].data as Array<{ itemStyle?: { color?: string } }>;
    for (const point of points) {
      expect(point.itemStyle?.color).toMatch(/^(#|rgb\()/);
    }
  });

  it('throws when the spec has no symbol layer (fail loud)', () => {
    expect(() => adaptBubbleToECharts(bubbleSpec({ layers: [] }), undefined, CITIES, DIMENSIONS)).toThrow(/symbol layer/);
  });

  it('throws when there are no tabular data records (the points ARE the data)', () => {
    expect(() => adaptBubbleToECharts(bubbleSpec(), undefined, [], DIMENSIONS)).toThrow(/tabular data/);
  });

  it('flows a11y into aria + carries usermeta provenance', () => {
    const option = adaptBubbleToECharts(bubbleSpec(), undefined, CITIES, DIMENSIONS);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe('Population by city.');
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:bubble-test');
  });

  it('is DETERMINISTIC — identical (spec, data) yields a byte-identical serialized option', () => {
    const a = JSON.stringify(adaptBubbleToECharts(bubbleSpec(), undefined, CITIES, DIMENSIONS));
    const b = JSON.stringify(adaptBubbleToECharts(bubbleSpec(), undefined, CITIES, DIMENSIONS));
    expect(a).toBe(b);
  });
});
