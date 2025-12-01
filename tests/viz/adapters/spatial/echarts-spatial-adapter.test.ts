import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import { adaptToECharts, EChartsSpatialAdapterError } from '../../../../src/viz/adapters/spatial/echarts-spatial-adapter.js';

const SAMPLE_FEATURES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Alpha', region: 'Alpha' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]] },
    },
    {
      type: 'Feature',
      properties: { name: 'Beta', region: 'Beta' },
      geometry: { type: 'Polygon', coordinates: [[[0, 1], [2, 1], [2, 2], [0, 2], [0, 1]]] },
    },
  ],
};

const SAMPLE_DATA = [
  { region: 'Alpha', value: 10 },
  { region: 'Beta', value: 25 },
];

describe('ECharts spatial adapter', () => {
  it('builds a choropleth option with visualMap and geo registration', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        type: 'data.geo.join',
        source: 'inline://data',
        geoSource: 'inline://geo',
        joinKey: 'region',
        geoKey: 'region',
      },
      projection: { type: 'mercator' },
      geo: { source: 'inline://geo', feature: 'usa' },
      layers: [
        {
          type: 'regionFill',
          encoding: {
            color: {
              field: 'value',
              scale: 'quantile',
              range: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
            },
            stroke: { value: 'var(--sys-border-strong)' },
          },
        },
      ],
      a11y: { description: 'Choropleth test map' },
    };

    const { echartsOption, geoRegistration } = adaptToECharts({
      spec,
      geoData: SAMPLE_FEATURES,
      data: SAMPLE_DATA,
      dimensions: { width: 640, height: 360 },
    });

    expect(geoRegistration?.name).toBe('usa');
    const series = (echartsOption.series as any[])[0];
    expect(series.type).toBe('map');
    expect(series.map).toBe('usa');
    expect((echartsOption.geo as any).map).toBe('usa');
    expect((echartsOption.visualMap as any).type).toBe('piecewise');
    expect((echartsOption.visualMap as any).splitNumber).toBe(4);
    expect(series.data[0].value).toBe(10);
    expect(series.data[1].name).toBe('Beta');
  });

  it('builds a bubble map option with symbol sizing and ordinal colors', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: { values: [
        { city: 'Alpha', lon: -75, lat: 40, magnitude: 120, category: 'east' },
        { city: 'Beta', lon: -122, lat: 47, magnitude: 60, category: 'west' },
      ] },
      projection: { type: 'mercator' },
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lon' },
            latitude: { field: 'lat' },
            size: { field: 'magnitude', scale: 'sqrt', range: [6, 32] },
            color: { field: 'category', scale: 'ordinal', range: ['#003f5c', '#7a5195'] },
            opacity: { value: 0.8 },
          },
        },
      ],
      a11y: { description: 'Bubble map test' },
    };

    const { echartsOption } = adaptToECharts({
      spec,
      geoData: SAMPLE_FEATURES,
      dimensions: { width: 480, height: 360 },
    });

    const series = (echartsOption.series as any[])[0];
    expect(series.type).toBe('scatter');
    expect(series.coordinateSystem).toBe('geo');
    expect(typeof series.symbolSize).toBe('function');
    const sized = series.symbolSize([0, 0, 120]);
    expect(sized).toBeGreaterThan(12);
    expect(series.data[0].itemStyle.color).toBe('#003f5c');
    expect(echartsOption.visualMap).toBeUndefined();
  });

  it('throws when bubble layers are missing data', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: { url: 'https://example.com/data.json' },
      projection: { type: 'mercator' },
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lon' },
            latitude: { field: 'lat' },
          },
        },
      ],
      a11y: { description: 'Bubble map without data' },
    };

    expect(() =>
      adaptToECharts({
        spec,
        geoData: SAMPLE_FEATURES,
        dimensions: { width: 320, height: 240 },
      })
    ).toThrow(EChartsSpatialAdapterError);
  });
});
