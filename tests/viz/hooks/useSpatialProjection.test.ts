/* @vitest-environment jsdom */
/**
 * Tests for useSpatialProjection hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpatialProjection } from '../../../src/viz/hooks/useSpatialProjection.js';
import type { FeatureCollection, Point } from 'geojson';

describe('useSpatialProjection', () => {
  const dimensions = { width: 800, height: 600 };
  const features: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-100, 40],
        },
        properties: {},
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-90, 50],
        },
        properties: {},
      },
    ],
  };

  it('should return projection function', () => {
    const { result } = renderHook(() =>
      useSpatialProjection('mercator', {}, dimensions, features)
    );

    expect(result.current.project).toBeDefined();
    expect(typeof result.current.project).toBe('function');
    expect(result.current.projection).toBeDefined();
  });

  it('should project coordinates', () => {
    const { result } = renderHook(() =>
      useSpatialProjection('mercator', {}, dimensions, features)
    );

    const projected = result.current.project(-100, 40);

    expect(projected).not.toBeNull();
    if (projected) {
      expect(Array.isArray(projected)).toBe(true);
      expect(projected.length).toBe(2);
    }
  });

  it('should calculate bounds', () => {
    const { result } = renderHook(() =>
      useSpatialProjection('mercator', {}, dimensions, features)
    );

    const bounds = result.current.bounds;

    expect(bounds).toBeDefined();
    expect(Array.isArray(bounds)).toBe(true);
    expect(bounds.length).toBe(2);
    expect(Array.isArray(bounds[0])).toBe(true);
    expect(Array.isArray(bounds[1])).toBe(true);
  });

  it('should provide fitToFeatures function', () => {
    const { result } = renderHook(() =>
      useSpatialProjection('mercator', {}, dimensions, features)
    );

    expect(result.current.fitToFeatures).toBeDefined();
    expect(typeof result.current.fitToFeatures).toBe('function');

    const fitted = result.current.fitToFeatures();
    expect(fitted).toBeDefined();
    expect(fitted.type).toBe('mercator');
  });

  it('should auto-fit when fitToData is true', () => {
    const { result } = renderHook(() =>
      useSpatialProjection('mercator', { fitToData: true }, dimensions, features)
    );

    // Projection should be configured
    expect(result.current.project).toBeDefined();
  });

  it('should handle empty features', () => {
    const emptyFeatures: FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    const { result } = renderHook(() =>
      useSpatialProjection('mercator', {}, dimensions, emptyFeatures)
    );

    // Should still return valid bounds (default world bounds)
    const bounds = result.current.bounds;
    expect(bounds).toBeDefined();
  });
});
