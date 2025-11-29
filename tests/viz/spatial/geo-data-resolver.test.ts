import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveGeoData, type GeoResolverInput } from '@/viz/adapters/spatial/geo-data-resolver.js';
import type { GeoJSONFeatureCollection } from '@/viz/adapters/spatial/geo-format-parser.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock fetch globally
global.fetch = vi.fn();

describe('GeoDataResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveGeoData', () => {
    it('should resolve inline GeoJSON correctly', async () => {
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

      const input: GeoResolverInput = {
        geoSource: JSON.stringify(geojson),
      };

      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(1);
      expect(result.metadata.format).toBe('geojson');
      expect(result.metadata.source).toBe('inline');
      expect(result.metadata.featureCount).toBe(1);
    });

    it('should surface inline JSON parse errors', async () => {
      const input: GeoResolverInput = {
        geoSource: '{invalid json',
      };

      await expect(resolveGeoData(input)).rejects.toThrow(/Failed to parse inline geo data/);
    });

    it('should resolve parsed GeoJSON object', async () => {
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

      const input: GeoResolverInput = {
        geoSource: geojson,
      };

      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(1);
      expect(result.metadata.source).toBe('parsed');
    });

    it('should fetch and resolve GeoJSON from URL', async () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { name: 'Test' },
          },
        ],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const input: GeoResolverInput = {
        geoSource: 'https://example.com/data.geojson',
      };

      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(1);
      expect(result.metadata.source).toBe('url');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should join data with geo features by key', async () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'CA',
            properties: { name: 'California' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          {
            type: 'Feature',
            id: 'TX',
            properties: { name: 'Texas' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      };

      const data = [
        { state: 'California', population: 39538223 },
        { state: 'Texas', population: 29145505 },
      ];

      const input: GeoResolverInput = {
        geoSource: geojson,
        data,
        joinConfig: {
          geoKey: 'name',
          dataKey: 'state',
        },
      };

      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(2);
      expect(result.metadata.hasJoinedData).toBe(true);
      expect(result.joinedData?.size).toBe(2);

      // Check merged properties
      const caFeature = result.features.find((f) => f.properties?.name === 'California');
      expect(caFeature?.properties?.population).toBe(39538223);
    });

    it('should report unmatched features and data', async () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'CA',
            properties: { name: 'California' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          {
            type: 'Feature',
            id: 'NY',
            properties: { name: 'New York' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      };

      const data = [{ state: 'California', population: 39538223 }];

      const input: GeoResolverInput = {
        geoSource: geojson,
        data,
        joinConfig: {
          geoKey: 'name',
          dataKey: 'state',
        },
      };

      const result = await resolveGeoData(input);

      expect(result.metadata.unmatchedFeatures).toContain('NY');
      expect(result.metadata.unmatchedData).toHaveLength(0);
    });

    it('should warn when join produces no matches', async () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'CA',
            properties: { name: 'California' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      };

      const data = [{ region: 'West', value: 10 }];
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const input: GeoResolverInput = {
        geoSource: geojson,
        data,
        joinConfig: {
          geoKey: 'name',
          dataKey: 'region',
        },
      };

      const result = await resolveGeoData(input);
      expect(result.metadata.hasJoinedData).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle TopoJSON input', async () => {
      // Skip if topojson-client not available
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('topojson-client');
      } catch {
        return;
      }

      const fixturePath = join(process.cwd(), 'tests/fixtures/geo/us-states.topojson');
      const topojsonContent = readFileSync(fixturePath, 'utf-8');
      const topojson = JSON.parse(topojsonContent);

      const input: GeoResolverInput = {
        geoSource: topojson,
        topoObjectName: 'states',
      };

      const result = await resolveGeoData(input);

      expect(result.features.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('topojson');
    });

    it('should handle missing join keys gracefully', async () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'California' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      };

      const data = [{ state: 'California', population: 39538223 }];

      const input: GeoResolverInput = {
        geoSource: geojson,
        data,
        joinConfig: {
          geoKey: 'nonexistent',
          dataKey: 'state',
        },
      };

      // Should not throw, but warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty data array', async () => {
      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'California' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      };

      const input: GeoResolverInput = {
        geoSource: geojson,
        data: [],
        joinConfig: {
          geoKey: 'name',
          dataKey: 'state',
        },
      };

      const result = await resolveGeoData(input);

      expect(result.features).toHaveLength(1);
      expect(result.metadata.hasJoinedData).toBe(false);
      expect(result.joinedData?.size).toBe(0);
    });

    it('should handle network errors from URL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const input: GeoResolverInput = {
        geoSource: 'https://example.com/missing.geojson',
      };

      await expect(resolveGeoData(input)).rejects.toThrow(/Failed to fetch geo data from URL/);
    });

    it('should handle invalid geo format', async () => {
      const input: GeoResolverInput = {
        geoSource: { invalid: 'data' },
      };

      await expect(resolveGeoData(input)).rejects.toThrow(/Unrecognized geo format/);
    });

    it('should handle performance for large feature sets', async () => {
      // Create a large feature collection
      const features = Array.from({ length: 200 }, (_, i) => ({
        type: 'Feature' as const,
        id: `feature-${i}`,
        properties: { name: `Feature ${i}` },
        geometry: { type: 'Point' as const, coordinates: [i, i] },
      }));

      const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      const input: GeoResolverInput = {
        geoSource: geojson,
      };

      const start = Date.now();
      const result = await resolveGeoData(input);
      const duration = Date.now() - start;

      expect(result.features).toHaveLength(200);
      expect(duration).toBeLessThan(1000); // Should complete in <1s
    });
  });

  describe('integration with real fixtures', () => {
    it('should resolve world-countries.geojson fixture', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/geo/world-countries.geojson');
      const content = readFileSync(fixturePath, 'utf-8');
      const geojson = JSON.parse(content);

      const input: GeoResolverInput = {
        geoSource: geojson,
      };

      const result = await resolveGeoData(input);

      expect(result.features.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('geojson');
      expect(result.features[0]?.properties?.name).toBe('United States');
    });

    it('should join fixture data with world countries', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/geo/world-countries.geojson');
      const content = readFileSync(fixturePath, 'utf-8');
      const geojson = JSON.parse(content);

      const data = [
        { country: 'United States', gdp: 25.5 },
        { country: 'Canada', gdp: 1.9 },
      ];

      const input: GeoResolverInput = {
        geoSource: geojson,
        data,
        joinConfig: {
          geoKey: 'name',
          dataKey: 'country',
        },
      };

      const result = await resolveGeoData(input);

      expect(result.metadata.hasJoinedData).toBe(true);
      expect(result.joinedData?.size).toBe(2);
    });
  });
});
