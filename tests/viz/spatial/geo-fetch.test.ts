import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchGeoSource, clearGeoCache, isCached } from '@/viz/adapters/spatial/geo-fetch.js';
import type { GeoJSONFeatureCollection } from '@/viz/adapters/spatial/geo-format-parser.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('GeoFetch', () => {
  beforeEach(() => {
    clearGeoCache();
    vi.clearAllMocks();
  });

  describe('fetchGeoSource', () => {
    it('should fetch and parse GeoJSON from URL', async () => {
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
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const result = await fetchGeoSource('https://example.com/data.geojson');

      expect(result).toEqual(mockGeoJSON);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/data.geojson',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          headers: expect.objectContaining({
            Accept: expect.stringContaining('json'),
          }),
        })
      );
    });

    it('should cache fetched data', async () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const url = 'https://example.com/data.geojson';

      // First fetch
      await fetchGeoSource(url);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second fetch should use cache
      const cached = await fetchGeoSource(url);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(cached).toEqual(mockGeoJSON);
      expect(isCached(url)).toBe(true);
    });

    it('should respect forceRefresh option', async () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const url = 'https://example.com/data.geojson';

      // First fetch
      await fetchGeoSource(url);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Force refresh
      await fetchGeoSource(url, { forceRefresh: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should respect cache: false option', async () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const url = 'https://example.com/data.geojson';

      await fetchGeoSource(url, { cache: false });
      expect(isCached(url)).toBe(false);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () => 'Not Found',
      });

      await expect(fetchGeoSource('https://example.com/missing.geojson')).rejects.toThrow(
        /Failed to fetch geo data from URL/
      );
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchGeoSource('https://example.com/data.geojson')).rejects.toThrow(
        /Failed to fetch geo data from URL/
      );
    });

    it('should handle timeout', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(abortError), 100);
          })
      );

      await expect(
        fetchGeoSource('https://example.com/slow.geojson', { timeout: 50 })
      ).rejects.toThrow(/timeout/);
    });

    it('should handle invalid JSON response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => 'invalid json',
      });

      await expect(fetchGeoSource('https://example.com/invalid.geojson')).rejects.toThrow();
    });
  });

  describe('clearGeoCache', () => {
    it('should clear the cache', async () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(mockGeoJSON),
      });

      const url = 'https://example.com/data.geojson';
      await fetchGeoSource(url);
      expect(isCached(url)).toBe(true);

      clearGeoCache();
      expect(isCached(url)).toBe(false);
    });
  });
});

