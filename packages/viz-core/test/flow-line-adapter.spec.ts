import { describe, expect, it } from 'vitest';
import { adaptFlowLineToECharts, adaptToECharts, type SpatialSpec } from '@oods/viz-core';

// sprint-119 m01 — the flow_map (route/flow-line) geo beachhead. Pins the WHY of the
// headless flow path: a 'lines' series is built from the SEPARATE tabular `data`
// param on a 'geo' coordinate system, each datum carries the origin→destination
// `coords` pair, lineStyle.curveness bends it into an ARC (native ECharts, no
// plugin), a numeric strength field drives a continuous visualMap over lineWidth,
// and the option is deterministic.

const DIMENSIONS = { width: 860, height: 520 } as const;

const FLOWS = [
  { oLng: -122.4, oLat: 37.8, dLng: -73.9, dLat: 40.7, volume: 120 },
  { oLng: -118.2, oLat: 34.0, dLng: 2.35, dLat: 48.85, volume: 320 },
];

function flowSpec(overrides: Partial<SpatialSpec> = {}): SpatialSpec {
  return {
    id: 'viz:flow-test',
    name: 'Trade flows',
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'route',
        encoding: {
          start: { field: 'oLng', longitude: 'oLng', latitude: 'oLat' },
          end: { field: 'dLng', longitude: 'dLng', latitude: 'dLat' },
          strokeWidth: { field: 'volume' },
          curvature: { value: 0.25 },
        },
      },
    ],
    a11y: { description: 'Trade flows between ports.' },
    ...overrides,
  };
}

describe('adaptFlowLineToECharts — decoupled spec+rows → renderable geo-arc option', () => {
  it('builds a geo-anchored lines series with origin→destination coords from the tabular data param', () => {
    const option = adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('lines');
    expect(series.coordinateSystem).toBe('geo');
    expect(series.polyline).toBe(false);

    const seriesData = series.data as Array<{ coords: number[][] }>;
    expect(seriesData).toHaveLength(2);
    // coords = [[originLng, originLat], [destLng, destLat]] — the two endpoints on the geo CS.
    expect(seriesData[0].coords[0]).toEqual([-122.4, 37.8]);
    expect(seriesData[0].coords[1]).toEqual([-73.9, 40.7]);
  });

  it('bends each line into an ARC via lineStyle.curveness (the native ECharts arc, no plugin)', () => {
    const option = adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS);
    const series = (option.series as Record<string, unknown>[])[0];
    const lineStyle = series.lineStyle as { curveness?: number };
    expect(lineStyle.curveness).toBe(0.25);
  });

  it('drives a continuous visualMap over lineWidth from a numeric strength field', () => {
    const option = adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS);
    const visualMap = option.visualMap as { min?: number; max?: number; inRange?: { lineWidth?: number[] } };
    expect(visualMap.min).toBe(120);
    expect(visualMap.max).toBe(320);
    expect(visualMap.inRange?.lineWidth).toEqual([1, 6]);
    // strength rides each datum's scalar value (the visualMap quantity).
    const seriesData = (option.series as Record<string, unknown>[])[0].data as Array<{ value?: number }>;
    expect(seriesData[0].value).toBe(120);
  });

  it('pins a static lineStyle.width (no visualMap) when no strength field is given', () => {
    const spec = flowSpec({
      layers: [
        {
          type: 'route',
          encoding: {
            start: { field: 'oLng', longitude: 'oLng', latitude: 'oLat' },
            end: { field: 'dLng', longitude: 'dLng', latitude: 'dLat' },
          },
        },
      ],
    });
    const option = adaptFlowLineToECharts(spec, undefined, FLOWS, DIMENSIONS);
    expect(option.visualMap).toBeUndefined();
    const lineStyle = (option.series as Record<string, unknown>[])[0].lineStyle as { width?: number; curveness?: number };
    expect(lineStyle.width).toBe(2);
    // curvature defaults to a gentle arc even without an explicit encoding.
    expect(lineStyle.curveness).toBe(0.3);
  });

  it('emits RESOLVED colours (rgb/hex) through the shared resolver, never `var(--token)`', () => {
    const option = adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS);
    const serialized = JSON.stringify(option);
    expect(serialized).not.toContain('var(');
    const lineStyle = (option.series as Record<string, unknown>[])[0].lineStyle as { color?: string };
    expect(lineStyle.color).toMatch(/^(#|rgb\()/);
  });

  it('attaches __registration when a base map is supplied (geo specs are NOT self-contained)', () => {
    const geoData = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 'world',
          properties: {},
          geometry: { type: 'Polygon' as const, coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]] },
        },
      ],
    };
    const option = adaptFlowLineToECharts(flowSpec(), geoData, FLOWS, DIMENSIONS);
    expect((option as Record<string, unknown>).__registration).toBeDefined();
  });

  it('throws when the spec has no route layer (fail loud)', () => {
    expect(() => adaptFlowLineToECharts(flowSpec({ layers: [] }), undefined, FLOWS, DIMENSIONS)).toThrow(/route layer/);
  });

  it('throws when there are no tabular data records (the flows ARE the data)', () => {
    expect(() => adaptFlowLineToECharts(flowSpec(), undefined, [], DIMENSIONS)).toThrow(/tabular data/);
  });

  it('flows a11y into aria + carries usermeta provenance', () => {
    const option = adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe('Trade flows between ports.');
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:flow-test');
  });

  it('is DETERMINISTIC — identical (spec, data) yields a byte-identical serialized option', () => {
    const a = JSON.stringify(adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS));
    const b = JSON.stringify(adaptFlowLineToECharts(flowSpec(), undefined, FLOWS, DIMENSIONS));
    expect(a).toBe(b);
  });
});

describe('adaptToECharts (spatial dispatcher) — route layers compose into a lines series', () => {
  it('dispatches a route layer to the flow-line builder', () => {
    const out = adaptToECharts({ spec: flowSpec(), data: FLOWS, dimensions: DIMENSIONS });
    const series = (out.echartsOption.series as Record<string, unknown>[])[0];
    expect(series.type).toBe('lines');
    expect((series.data as unknown[])).toHaveLength(2);
  });

  it('throws when a route-only spec carries no tabular data (fail loud)', () => {
    expect(() => adaptToECharts({ spec: flowSpec(), data: [], dimensions: DIMENSIONS })).toThrow(/route layers require tabular data/);
  });
});
