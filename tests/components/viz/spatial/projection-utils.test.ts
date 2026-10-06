/* @vitest-environment jsdom */

/**
 * Tests for projection utilities.
 */

import { describe, it, expect } from 'vitest';
import { createProjection, fitProjectionToFeatures, projectCoordinates } from '../../../../src/components/viz/spatial/utils/projection-utils.js';
import type { FeatureCollection, Point } from 'geojson';

describe('projection-utils', () => {
  const dimensions = { width: 800, height: 600 };

  describe('createProjection', () => {
    it('should create a mercator projection with default scale', () => {
      const projection = createProjection('mercator', {}, dimensions);

      expect(projection).toBeDefined();
      expect(projection.scale()).toBeGreaterThan(0);
      expect(projection.translate()).toEqual([400, 300]); // width/2, height/2
    });

    it('should apply custom center', () => {
      const projection = createProjection(
        'mercator',
        { center: [-100, 40] },
        dimensions
      );

      const center = projection.center();
      expect(center).toEqual([-100, 40]);
    });

    it('should apply custom scale', () => {
      const projection = createProjection('mercator', { scale: 1000 }, dimensions);

      expect(projection.scale()).toBe(1000);
    });

    it('should apply rotation', () => {
      const projection = createProjection(
        'mercator',
        { rotate: [10, 20, 30] },
        dimensions
      );

      const rotate = projection.rotate();
      expect(rotate[0]).toBeCloseTo(10, 5);
      expect(rotate[1]).toBeCloseTo(20, 5);
      expect(rotate[2]).toBeCloseTo(30, 5);
    });

    it('should support all projection types', () => {
      const types = [
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
      ] as const;

      types.forEach((type) => {
        const projection = createProjection(type, {}, dimensions);
        expect(projection).toBeDefined();
        expect(projection.scale()).toBeGreaterThan(0);
      });
    });
  });

  describe('fitProjectionToFeatures', () => {
    it('should fit projection to feature bounds', () => {
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

      const projection = createProjection('mercator', {}, dimensions);
      const fitted = fitProjectionToFeatures(projection, features);

      expect(fitted).toBe(projection); // Returns same instance
      expect(fitted.scale()).toBeGreaterThan(0);
    });

    it('should handle empty feature collection', () => {
      const features: FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const projection = createProjection('mercator', {}, dimensions);
      const fitted = fitProjectionToFeatures(projection, features);

      expect(fitted).toBe(projection);
    });
  });

  describe('projectCoordinates', () => {
    it('should project valid coordinates', () => {
      const projection = createProjection('mercator', {}, dimensions);
      const result = projectCoordinates(projection, -100, 40);

      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(2);
        expect(typeof result[0]).toBe('number');
        expect(typeof result[1]).toBe('number');
      }
    });

    it('should return null for coordinates outside clip area', () => {
      const projection = createProjection('mercator', {}, dimensions);
      // Coordinates that are likely outside the clip area
      const result = projectCoordinates(projection, 200, 100);

      // Result may be null or valid depending on projection
      // Just verify it doesn't throw
      expect(result === null || Array.isArray(result)).toBe(true);
    });
  });
});

