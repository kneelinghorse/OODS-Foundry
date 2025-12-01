import { readFileSync } from 'node:fs';
import path from 'node:path';

import Ajv from 'ajv';
import { describe, expect, it, beforeAll } from 'vitest';

const SCHEMA_PATH = path.resolve(process.cwd(), 'schemas/viz/spatial-spec.schema.json');

describe('Spatial Spec Schema', () => {
  let ajv: Ajv;
  let validate: ReturnType<Ajv['compile']>;

  beforeAll(() => {
    ajv = new Ajv({ strict: false, allErrors: true });
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
    validate = ajv.compile(schema);
  });

  describe('valid specifications', () => {
    it('validates a basic choropleth spec with GeoJSON', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [
            { state: 'CA', population: 39500000 },
            { state: 'TX', population: 29000000 },
          ],
        },
        projection: {
          type: 'albersUsa',
        },
        geo: {
          source: 'https://example.com/us-states.json',
          format: 'geojson',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'population',
                scale: 'quantize',
              },
            },
          },
        ],
        a11y: {
          description: 'Choropleth map showing US state populations',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates a bubble map with symbol layer', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [
            { city: 'New York', lat: 40.7128, lon: -74.006, population: 8400000 },
            { city: 'Los Angeles', lat: 34.0522, lon: -118.2437, population: 3900000 },
          ],
        },
        projection: {
          type: 'mercator',
          center: [-98, 39],
          scale: 1000,
        },
        layers: [
          {
            type: 'symbol',
            encoding: {
              longitude: { field: 'lon' },
              latitude: { field: 'lat' },
              size: {
                field: 'population',
                scale: 'sqrt',
                range: [4, 40],
              },
              color: {
                value: 'var(--viz-scale-sequential-05)',
              },
            },
          },
        ],
        a11y: {
          description: 'Bubble map showing major US cities by population',
          ariaLabel: 'City population map',
          narrative: {
            summary: 'Major cities distributed across the United States',
            keyFindings: ['New York is the largest city', 'Cities are concentrated on coasts'],
          },
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates a route/flow map with route layer', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [
            { origin: 'SFO', dest: 'JFK', flights: 150 },
            { origin: 'LAX', dest: 'ORD', flights: 120 },
          ],
        },
        projection: {
          type: 'albersUsa',
        },
        layers: [
          {
            type: 'route',
            encoding: {
              start: { field: 'origin' },
              end: { field: 'dest' },
              strokeWidth: {
                field: 'flights',
                scale: 'linear',
                range: [1, 10],
              },
              opacity: {
                value: 0.6,
              },
            },
          },
        ],
        a11y: {
          description: 'Flow map showing flight routes between major US airports',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates data.geo.join data source', () => {
      const spec = {
        type: 'spatial',
        data: {
          type: 'data.geo.join',
          source: 'sales_by_state.json',
          geoSource: 'us-states.topojson',
          joinKey: 'state_fips',
          geoKey: 'properties.FIPS',
          format: 'topojson',
        },
        projection: {
          type: 'albersUsa',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'sales',
                scale: 'quantile',
              },
            },
          },
        ],
        a11y: {
          description: 'Sales choropleth by US state',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates spec with TopoJSON geo source', () => {
      const spec = {
        type: 'spatial',
        data: {
          url: 'https://example.com/data.json',
        },
        projection: {
          type: 'mercator',
        },
        geo: {
          source: 'https://example.com/world.topojson',
          format: 'topojson',
          topology: 'countries',
          feature: 'countries',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'gdp',
                scale: 'threshold',
                domain: [1000, 5000, 10000, 25000],
              },
            },
          },
        ],
        a11y: {
          description: 'World GDP choropleth map',
          tableFallback: {
            enabled: true,
            caption: 'GDP by country',
            columns: ['Country', 'GDP', 'Region'],
            sortDefault: 'GDP',
            sortOrder: 'desc',
          },
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates multiple layers stacked', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [],
        },
        projection: {
          type: 'equalEarth',
          fitToData: true,
        },
        geo: {
          source: 'world.geojson',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'temperature',
                scale: 'linear',
              },
            },
            zIndex: 0,
          },
          {
            type: 'symbol',
            encoding: {
              longitude: { field: 'lon' },
              latitude: { field: 'lat' },
              size: {
                field: 'magnitude',
              },
            },
            zIndex: 10,
          },
        ],
        a11y: {
          description: 'Temperature map with earthquake locations',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates inline GeoJSON source with geo field definitions', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [{ id: 1, city: 'San Francisco', lon: -122.42, lat: 37.77 }],
          format: 'geojson',
          fields: {
            point: { type: 'field.geopoint', value: [37.77, -122.42] },
            geometry: {
              type: 'field.geojson',
              geometry: { type: 'Point', coordinates: [-122.42, 37.77] },
            },
          },
        },
        projection: {
          type: 'mercator',
        },
        geo: {
          source: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { id: 1 },
                geometry: { type: 'Point', coordinates: [-122.42, 37.77] },
              },
            ],
          },
          format: 'geojson',
        },
        layers: [
          {
            type: 'symbol',
            encoding: {
              longitude: { field: 'lon' },
              latitude: { field: 'lat' },
            },
          },
        ],
        a11y: {
          description: 'City point rendered from inline GeoJSON FeatureCollection',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates TopoJSON field definitions on data', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [{ region: 'CA', value: 10 }],
          format: 'topojson',
          fields: {
            topology: {
              type: 'field.topojson',
              topology: 'states',
              feature: 'states',
            },
          },
        },
        projection: {
          type: 'albersUsa',
        },
        geo: {
          source: {
            type: 'Topology',
            objects: {
              states: {
                type: 'GeometryCollection',
                geometries: [],
              },
            },
            arcs: [],
          },
          format: 'topojson',
          topology: 'states',
          feature: 'states',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'value',
                scale: 'quantize',
              },
            },
          },
        ],
        a11y: {
          description: 'TopoJSON choropleth with field.topojson definitions',
        },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it('validates all projection types', () => {
      const projectionTypes = [
        'mercator',
        'albersUsa',
        'equalEarth',
        'orthographic',
        'conicEqualArea',
        'conicConformal',
        'azimuthalEqualArea',
        'azimuthalEquidistant',
        'gnomonic',
        'stereographic',
        'naturalEarth1',
        'equirectangular',
      ];

      for (const projType of projectionTypes) {
        const spec = {
          type: 'spatial',
          data: { values: [] },
          projection: { type: projType },
          layers: [
            {
              type: 'regionFill',
              encoding: { color: { field: 'value' } },
            },
          ],
          a11y: { description: `Map with ${projType} projection` },
        };

        const valid = validate(spec);
        expect(valid).toBe(true);
      }
    });

    it('validates projection with all optional parameters', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: {
          type: 'conicEqualArea',
          center: [-98, 38],
          scale: 1200,
          rotate: [-96, 0, 0],
          parallels: [29.5, 45.5],
          clipAngle: 90,
          clipExtent: [
            [0, 0],
            [960, 500],
          ],
          precision: 0.1,
          fitToData: false,
        },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Custom projection map' },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });
  });

  describe('invalid specifications', () => {
    it('rejects spec without required type field', () => {
      const spec = {
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
      expect(validate.errors?.some((e) => e.message?.includes('type'))).toBe(true);
    });

    it('rejects spec without required a11y description', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: {},
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects spec with empty layers array', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects invalid projection type', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'invalidProjection' },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects symbol layer without required position encodings', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'symbol',
            encoding: {
              size: { field: 'value' },
            },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects route layer without required start/end encodings', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'route',
            encoding: {
              strokeWidth: { value: 2 },
            },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects regionFill layer without required color encoding', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              opacity: { value: 0.5 },
            },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects invalid color scale type', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: {
              color: {
                field: 'value',
                scale: 'invalidScale',
              },
            },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects invalid geo format type', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        geo: {
          source: 'map.json',
          format: 'shapefile',
        },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });

    it('rejects topo field without required topology reference', () => {
      const spec = {
        type: 'spatial',
        data: {
          values: [],
          fields: {
            topology: {
              type: 'field.topojson',
            },
          },
        },
        projection: {},
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
      expect(validate.errors?.some((e) => e.message?.includes('topology'))).toBe(true);
    });

    it('rejects data.geo.join without required join keys', () => {
      const spec = {
        type: 'spatial',
        data: {
          type: 'data.geo.join',
          source: 'data.json',
          geoSource: 'geo.json',
        },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('accepts projection with minimal config', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: {},
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(true);
    });

    it('accepts symbol layer with minimal position encoding', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
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
        a11y: { description: 'Test' },
      };

      const valid = validate(spec);
      expect(valid).toBe(true);
    });

    it('accepts interaction configuration', () => {
      const spec = {
        type: 'spatial',
        data: { values: [] },
        projection: { type: 'mercator' },
        layers: [
          {
            type: 'regionFill',
            encoding: { color: { field: 'value' } },
          },
        ],
        interactions: [
          { type: 'panZoom', enabled: true },
          { type: 'tooltip', enabled: true },
          { type: 'regionSelect', enabled: false },
        ],
        a11y: { description: 'Interactive map' },
      };

      const valid = validate(spec);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });
  });
});
