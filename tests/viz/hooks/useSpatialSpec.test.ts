/* @vitest-environment jsdom */
/**
 * Tests for useSpatialSpec hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSpatialSpec } from '../../../src/viz/hooks/useSpatialSpec.js';
import type { SpatialSpec } from '../../../src/types/viz/spatial.js';
import type { FeatureCollection, Point } from 'geojson';

const mockResolveGeoData = vi.fn();

vi.mock('../../../src/viz/adapters/spatial/geo-data-resolver.js', () => ({
  resolveGeoData: (...args: unknown[]) => mockResolveGeoData(...args),
}));

describe('useSpatialSpec', () => {
  const baseSpec: SpatialSpec = {
    type: 'spatial',
    name: 'Spec',
    data: { values: [] },
    projection: { type: 'mercator' },
    layers: [
      {
        type: 'regionFill',
        encoding: { color: { field: 'value' } },
      },
    ],
    a11y: { description: 'Map' },
  };

  const geoSource: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: 'Zero' },
        id: '1',
      },
    ],
  };

  beforeEach(() => {
    mockResolveGeoData.mockResolvedValue({
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { name: 'Zero' },
          id: '1',
        },
      ],
      joinedData: new Map(),
      metadata: {
        featureCount: 1,
        hasJoinedData: false,
        unmatchedFeatures: [],
        unmatchedData: [],
        format: 'geojson',
        source: 'parsed',
      },
    });
    mockResolveGeoData.mockClear();
  });

  it('returns loading state initially', async () => {
    const { result } = renderHook(() =>
      useSpatialSpec({
        spec: baseSpec,
        geoSource,
        dimensions: { width: 800, height: 600 },
      })
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns features after resolution', async () => {
    const { result } = renderHook(() =>
      useSpatialSpec({
        spec: baseSpec,
        geoSource,
        dimensions: { width: 800, height: 600 },
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features).toHaveLength(1);
    expect(result.current.projectionConfig.type).toBe('mercator');
  });

  it('joins data correctly', async () => {
    mockResolveGeoData.mockResolvedValueOnce({
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { name: 'Zero' },
          id: '1',
        },
      ],
      joinedData: new Map([['1', [{ value: 10 }]]]),
      metadata: {
        featureCount: 1,
        hasJoinedData: true,
        unmatchedFeatures: [],
        unmatchedData: [],
        format: 'geojson',
        source: 'parsed',
      },
    });

    const { result } = renderHook(() =>
      useSpatialSpec({
        spec: baseSpec,
        geoSource,
        data: [{ value: 10 }],
        dimensions: { width: 800, height: 600 },
      })
    );

    await waitFor(() => expect(result.current.joinedData.size).toBe(1));
    expect(result.current.joinedData.get('1')).toMatchObject({ value: 10 });
  });

  it('handles errors gracefully', async () => {
    mockResolveGeoData.mockRejectedValueOnce(new Error('Resolver failed'));

    const { result } = renderHook(() =>
      useSpatialSpec({
        spec: baseSpec,
        geoSource,
        dimensions: { width: 800, height: 600 },
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.features).toHaveLength(0);
  });

  it('recomputes when spec changes', async () => {
    const { result, rerender } = renderHook(
      ({ spec }) =>
        useSpatialSpec({
          spec,
          geoSource,
          dimensions: { width: 800, height: 600 },
        }),
      { initialProps: { spec: baseSpec } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockResolveGeoData.mockClear();

    const nextSpec: SpatialSpec = {
      ...baseSpec,
      projection: { type: 'equalEarth' },
    };

    rerender({ spec: nextSpec });
    await waitFor(() => expect(mockResolveGeoData).toHaveBeenCalled());
    expect(result.current.projectionConfig.type).toBe('equalEarth');
  });
});
