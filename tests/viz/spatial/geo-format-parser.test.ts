import { describe, it, expect } from 'vitest';
import {
  detectGeoFormat,
  parseGeoSource,
  convertTopoToGeo,
  normalizeToGeoJSON,
  type GeoJSONFeatureCollection,
  type TopoJSONTopology,
} from '@/viz/adapters/spatial/geo-format-parser.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('GeoFormatParser', () => {
  describe('detectGeoFormat', () => {
    it('should detect GeoJSON FeatureCollection', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [],
      };
      expect(detectGeoFormat(geojson)).toBe('geojson');
    });

    it('should detect GeoJSON Feature', () => {
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
      };
      expect(detectGeoFormat(feature)).toBe('geojson');
    });

    it('should detect GeoJSON Geometry', () => {
      const geometry = {
        type: 'Point',
        coordinates: [0, 0],
      };
      expect(detectGeoFormat(geometry)).toBe('geojson');
    });

    it('should detect GeometryCollection', () => {
      const geometryCollection = {
        type: 'GeometryCollection',
        geometries: [],
      };

      expect(detectGeoFormat(geometryCollection)).toBe('geojson');
    });

    it('should detect TopoJSON', () => {
      const topojson = {
        type: 'Topology',
        arcs: [],
        objects: {},
      };
      expect(detectGeoFormat(topojson)).toBe('topojson');
    });

    it('should return unknown for invalid data', () => {
      expect(detectGeoFormat(null)).toBe('unknown');
      expect(detectGeoFormat({})).toBe('unknown');
      expect(detectGeoFormat('string')).toBe('unknown');
    });
  });

  describe('parseGeoSource', () => {
    it('should parse JSON string', () => {
      const json = '{"type":"FeatureCollection","features":[]}';
      const result = parseGeoSource(json);
      expect(result).toEqual({ type: 'FeatureCollection', features: [] });
    });

    it('should handle already parsed object', () => {
      const obj = { type: 'FeatureCollection', features: [] };
      const result = parseGeoSource(obj);
      expect(result).toBe(obj);
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseGeoSource('invalid json')).toThrow(/Failed to parse geo data/);
    });

    it('should throw on non-string non-object', () => {
      expect(() => parseGeoSource(123 as unknown as string)).toThrow();
    });
  });

  describe('normalizeToGeoJSON', () => {
    it('should normalize GeoJSON FeatureCollection', () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { name: 'Test' },
          },
        ],
      };
      const result = normalizeToGeoJSON(geojson);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
    });

    it('should normalize a single Feature into a FeatureCollection', () => {
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: 'Single' },
      };

      const result = normalizeToGeoJSON(feature);
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.properties?.name).toBe('Single');
    });

    it('should normalize a bare geometry into a FeatureCollection', () => {
      const geometry = {
        type: 'Point',
        coordinates: [1, 2],
      };

      const result = normalizeToGeoJSON(geometry);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.properties).toEqual({});
    });

    it('should throw on invalid GeoJSON structure', () => {
      const invalid = { type: 'FeatureCollection' }; // missing features
      // Format detection happens first, so it throws "Unrecognized geo format"
      expect(() => normalizeToGeoJSON(invalid)).toThrow(/Unrecognized geo format/);
    });

    it('should convert TopoJSON to GeoJSON when objectName provided', () => {
      // Skip if topojson-client not available
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        // Skip test if dependency not available
        return;
      }

      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {
          states: {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'Polygon',
                properties: { name: 'Test' },
                arcs: [[0]],
              },
            ],
          },
        },
        arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      };

      const result = normalizeToGeoJSON(topojson, 'states');
      expect(result.type).toBe('FeatureCollection');
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should auto-detect TopoJSON object when single object exists', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        return;
      }

      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {
          states: {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'Polygon',
                properties: { name: 'Test' },
                arcs: [[0]],
              },
            ],
          },
        },
        arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      };

      const result = normalizeToGeoJSON(topojson);
      expect(result.type).toBe('FeatureCollection');
    });

    it('should throw when TopoJSON has multiple objects without objectName', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        return;
      }

      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {
          states: { type: 'GeometryCollection', geometries: [] },
          counties: { type: 'GeometryCollection', geometries: [] },
        },
        arcs: [],
      };

      expect(() => normalizeToGeoJSON(topojson)).toThrow(/Multiple TopoJSON objects/);
    });

    it('should throw when TopoJSON has no objects', () => {
      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {},
        arcs: [],
      };

      expect(() => normalizeToGeoJSON(topojson)).toThrow(/no objects to convert/);
    });

    it('should throw on unknown format', () => {
      expect(() => normalizeToGeoJSON({} as TopoJSONTopology)).toThrow(/Unrecognized geo format/);
    });
  });

  describe('convertTopoToGeo', () => {
    it('should convert TopoJSON to GeoJSON', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        // Skip if dependency not available
        return;
      }

      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {
          states: {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'Polygon',
                properties: { name: 'California' },
                arcs: [[0]],
              },
            ],
          },
        },
        arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      };

      const result = convertTopoToGeo(topojson, 'states');
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.properties?.name).toBe('California');
    });

    it('should throw when object not found', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        return;
      }

      const topojson: TopoJSONTopology = {
        type: 'Topology',
        objects: {
          states: { type: 'GeometryCollection', geometries: [] },
        },
        arcs: [],
      };

      expect(() => convertTopoToGeo(topojson, 'nonexistent')).toThrow(/not found/);
    });
  });

  describe('integration with real fixtures', () => {
    it('should parse world-countries.geojson fixture', () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/geo/world-countries.geojson');
      const content = readFileSync(fixturePath, 'utf-8');
      const parsed = parseGeoSource(content);
      const normalized = normalizeToGeoJSON(parsed);

      expect(normalized.type).toBe('FeatureCollection');
      expect(normalized.features.length).toBeGreaterThan(0);
      expect(normalized.features[0]?.properties?.name).toBe('United States');
    });
  });
});
