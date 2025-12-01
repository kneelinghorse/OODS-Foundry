import type { FeatureCollection } from 'geojson';
import * as vega from 'vega';
import * as vl from 'vega-lite';
import { describe, expect, it } from 'vitest';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import { adaptToVegaLite } from '../../../../src/viz/adapters/spatial/vega-lite-spatial-adapter.js';

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

async function renderSvg(spec: vl.TopLevelSpec): Promise<string> {
  const { spec: compiled } = vl.compile(spec);
  const view = new vega.View(vega.parse(compiled)).renderer('svg');
  return view.toSVG();
}

describe('Vega-Lite spatial adapter (visual smoke)', () => {
  it('produces drawable SVG for choropleth output', async () => {
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
      layers: [
        {
          type: 'regionFill',
          encoding: {
            color: { field: 'value', scale: 'quantize' },
          },
        },
      ],
      a11y: { description: 'Choropleth smoke test' },
    };

    const { vegaLiteSpec } = adaptToVegaLite({
      spec,
      geoData: GEO_FIXTURE,
      data: [
        { name: 'Region A', value: 1 },
        { name: 'Region B', value: 2 },
      ],
      dimensions: { width: 360, height: 240 },
    });

    const svg = await renderSvg(vegaLiteSpec);
    expect(svg.length).toBeGreaterThan(500);
    expect(svg).toContain('<path');
  });

  it('produces drawable SVG for bubble map output', async () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        values: [
          { city: 'Alpha', lon: -90, lat: 35, magnitude: 15 },
          { city: 'Beta', lon: -110, lat: 45, magnitude: 40 },
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
            color: { value: 'var(--oods-viz-scale-sequential-05)' },
          },
        },
      ],
      a11y: { description: 'Bubble map smoke test' },
    };

    const { vegaLiteSpec } = adaptToVegaLite({
      spec,
      geoData: GEO_FIXTURE,
      dimensions: { width: 400, height: 280 },
    });

    const svg = await renderSvg(vegaLiteSpec);
    expect(svg.length).toBeGreaterThan(500);
    expect(svg).toContain('graphics-symbol');
  });
});
