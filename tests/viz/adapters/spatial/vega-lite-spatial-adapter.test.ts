import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { SpatialSpec } from '../../../../src/types/viz/spatial.js';
import {
  adaptToVegaLite,
  VegaLiteSpatialAdapterError,
} from '../../../../src/viz/adapters/spatial/vega-lite-spatial-adapter.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(
  moduleDir,
  '../../../../node_modules/vega-lite/build/vega-lite-schema.json'
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const SAMPLE_FEATURES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'alpha',
      properties: { name: 'Alpha' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]] },
    },
    {
      type: 'Feature',
      id: 'beta',
      properties: { name: 'Beta' },
      geometry: { type: 'Polygon', coordinates: [[[0, 1], [2, 1], [2, 2], [0, 2], [0, 1]]] },
    },
  ],
};

const SAMPLE_DATA = [
  { region: 'Alpha', value: 10 },
  { region: 'Beta', value: 25 },
];

function assertValid(spec: unknown): void {
  const valid = validate(spec);
  if (!valid) {
    const messages = (validate.errors ?? []).map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
    throw new Error(`Vega-Lite spec failed validation: ${messages}`);
  }
}

describe('Vega-Lite spatial adapter', () => {
  it('builds a valid choropleth spec with joined data and projection mapping', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        type: 'data.geo.join',
        source: 'inline://data',
        geoSource: 'inline://geo',
        joinKey: 'region',
        geoKey: 'name',
      },
      projection: { type: 'equalEarth', fitToData: true },
      layers: [
        {
          type: 'regionFill',
          encoding: {
            color: {
              field: 'value',
              scale: 'quantile',
              range: [
                'var(--oods-viz-scale-sequential-01)',
                'var(--oods-viz-scale-sequential-05)',
              ],
            },
            stroke: { value: 'var(--sys-border-strong)' },
          },
        },
      ],
      config: { layout: { width: 640, height: 360 } },
      a11y: { description: 'Choropleth test map' },
    };

    const result = adaptToVegaLite({
      spec,
      geoData: SAMPLE_FEATURES,
      data: SAMPLE_DATA,
      dimensions: { width: 640, height: 360 },
    });

    assertValid(result.vegaLiteSpec);
    const choroplethLayer = (result.vegaLiteSpec.layer ?? [])[0] as Record<string, any>;
    expect(choroplethLayer?.mark?.type).toBe('geoshape');
    expect(choroplethLayer?.encoding?.color?.scale?.type).toBe('quantile');
    expect(result.vegaLiteSpec.projection?.type).toBe('equalEarth');

    const embedded = choroplethLayer?.data?.values as FeatureCollection;
    expect(embedded.features[0].properties?.value).toBe(10);
    expect(result.dataUrls).toEqual({ data: 'inline://data', geo: 'inline://geo' });
  });

  it('builds a layered bubble map with optional basemap and validates spec', () => {
    const spec: SpatialSpec = {
      type: 'spatial',
      data: {
        values: [
          { city: 'Alpha', lon: -75, lat: 40, magnitude: 120, category: 'east' },
          { city: 'Beta', lon: -122, lat: 47, magnitude: 60, category: 'west' },
        ],
      },
      projection: { type: 'mercator', fitToData: false },
      layers: [
        {
          type: 'symbol',
          encoding: {
            longitude: { field: 'lon' },
            latitude: { field: 'lat' },
            size: { field: 'magnitude', scale: 'sqrt', range: [6, 32] },
            color: { field: 'category', scale: 'ordinal', nullValue: 'var(--sys-border-strong)' },
            opacity: { value: 0.8 },
          },
        },
      ],
      a11y: { description: 'Bubble map test' },
    };

    const result = adaptToVegaLite({
      spec,
      geoData: SAMPLE_FEATURES,
      dimensions: { width: 480, height: 360 },
    });

    assertValid(result.vegaLiteSpec);

    const layers = result.vegaLiteSpec.layer ?? [];
    expect(layers.length).toBe(2); // basemap + symbols

    const symbolLayer = layers[1] as Record<string, any>;
    expect(symbolLayer.mark?.type).toBe('circle');
    expect(symbolLayer.encoding?.size?.scale?.range).toEqual([6, 32]);
    expect(symbolLayer.encoding?.color?.value).toBe('var(--sys-border-strong)');
    expect(symbolLayer.encoding?.color?.condition).toBeDefined();
  });

  it('throws when bubble layers are missing tabular data', () => {
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
      adaptToVegaLite({
        spec,
        geoData: SAMPLE_FEATURES,
        dimensions: { width: 320, height: 240 },
      })
    ).toThrow(VegaLiteSpatialAdapterError);
  });
});
