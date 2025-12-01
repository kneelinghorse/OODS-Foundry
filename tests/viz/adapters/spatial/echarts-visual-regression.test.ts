import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import { adaptToECharts } from '../../../../src/viz/adapters/spatial/echarts-spatial-adapter.js';

const GEO_FIXTURE: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Region A' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [3, 2], [0, 2], [0, 0]]] },
    },
    {
      type: 'Feature',
      properties: { name: 'Region B' },
      geometry: { type: 'Polygon', coordinates: [[[0, 2], [3, 2], [3, 4], [0, 4], [0, 2]]] },
    },
  ],
};

function sanitizeForSnapshot(option: unknown): unknown {
  if (Array.isArray(option)) {
    return option.map(sanitizeForSnapshot);
  }
  if (option && typeof option === 'object') {
    return Object.fromEntries(
      Object.entries(option as Record<string, unknown>).map(([key, value]) => {
        if (typeof value === 'function') {
          return [key, '[function]'];
        }
        return [key, sanitizeForSnapshot(value)];
      })
    );
  }
  return option;
}

describe('ECharts spatial adapter (visual smoke)', () => {
  it('produces stable choropleth option output', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        type: 'data.geo.join',
        source: 'inline://data',
        geoSource: 'inline://geo',
        joinKey: 'name',
        geoKey: 'name',
      },
      projection: { type: 'mercator', fitToData: true },
      geo: { source: 'inline://geo', feature: 'choropleth-map' },
      layers: [
        {
          type: 'regionFill',
          encoding: {
            color: { field: 'value', scale: 'quantize', range: ['#e0f3f8', '#abd9e9', '#74add1'] },
          },
        },
      ],
      a11y: { description: 'Choropleth smoke test' },
    };

    const { echartsOption } = adaptToECharts({
      spec,
      geoData: GEO_FIXTURE,
      data: [
        { name: 'Region A', value: 1 },
        { name: 'Region B', value: 2 },
      ],
      dimensions: { width: 360, height: 240 },
    });

    expect(sanitizeForSnapshot(echartsOption)).toMatchSnapshot();
  });

  it('produces stable bubble map option output', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        values: [
          { city: 'Alpha', lon: -90, lat: 35, magnitude: 15, group: 'east' },
          { city: 'Beta', lon: -110, lat: 45, magnitude: 40, group: 'west' },
        ],
      },
      projection: { type: 'albersUsa', fitToData: false },
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lon' },
            latitude: { field: 'lat' },
            size: { field: 'magnitude', range: [4, 24] },
            color: { field: 'group', scale: 'ordinal', range: ['#2f4b7c', '#ffa600'] },
          },
        },
      ],
      a11y: { description: 'Bubble map smoke test' },
    };

    const { echartsOption } = adaptToECharts({
      spec,
      geoData: GEO_FIXTURE,
      dimensions: { width: 400, height: 280 },
    });

    expect(sanitizeForSnapshot(echartsOption)).toMatchSnapshot();
  });
});
