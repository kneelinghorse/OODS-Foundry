/**
 * useSpatialProjection Hook
 *
 * React hook that manages geographic projection calculations using d3-geo.
 */

import { useMemo } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import type { ProjectionConfig, ProjectionType } from '../../types/viz/spatial.js';
import { createProjection, fitProjectionToFeatures, projectCoordinates } from '../../components/viz/spatial/utils/projection-utils.js';

/**
 * Result of useSpatialProjection hook.
 */
export interface UseSpatialProjectionResult {
  /**
   * Projection function that converts [lon, lat] to [x, y] screen coordinates.
   */
  project: (lon: number, lat: number) => [number, number] | null;

  /**
   * Fit projection to features and return updated config.
   */
  fitToFeatures: () => ProjectionConfig;

  /**
   * Geographic bounds of the features [[minLon, minLat], [maxLon, maxLat]].
   */
  bounds: [[number, number], [number, number]];
}

/**
 * Hook that manages projection calculations for spatial visualizations.
 *
 * @param projectionType - Type of projection (e.g., 'mercator', 'albersUsa')
 * @param config - Projection configuration
 * @param dimensions - Viewport dimensions { width, height }
 * @param features - GeoJSON feature collection
 * @returns Projection utilities and bounds
 */
export function useSpatialProjection(
  projectionType: ProjectionType,
  config: ProjectionConfig,
  dimensions: { width: number; height: number },
  features: FeatureCollection<Geometry>
): UseSpatialProjectionResult {
  // Create and configure projection
  const projection = useMemo(() => {
    const proj = createProjection(projectionType, config, dimensions);

    // Auto-fit if requested
    if (config.fitToData && features.features.length > 0) {
      fitProjectionToFeatures(proj, features);
    }

    return proj;
  }, [projectionType, config, dimensions, features]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (features.features.length === 0) {
      return [
        [-180, -90],
        [180, 90],
      ] as [[number, number], [number, number]];
    }

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const extractCoordinates = (coords: unknown): void => {
      if (Array.isArray(coords)) {
        if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          // Point
          const [lon, lat] = coords;
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        } else {
          // Nested array (LineString, Polygon, etc.)
          coords.forEach(extractCoordinates);
        }
      }
    };

    features.features.forEach((feature) => {
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates as [number, number];
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiPoint') {
        const coords = feature.geometry.coordinates as Array<[number, number]>;
        coords.forEach(([lon, lat]) => {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      } else {
        // Polygon, MultiLineString, MultiPolygon, etc.
        extractCoordinates(feature.geometry.coordinates);
      }
    });

    return [
      [minLon === Infinity ? -180 : minLon, minLat === Infinity ? -90 : minLat],
      [maxLon === -Infinity ? 180 : maxLon, maxLat === -Infinity ? 90 : maxLat],
    ] as [[number, number], [number, number]];
  }, [features]);

  const project = useMemo(
    () => (lon: number, lat: number) => projectCoordinates(projection, lon, lat),
    [projection]
  );

  const fitToFeatures = useMemo(
    () => (): ProjectionConfig => {
      const fitted = fitProjectionToFeatures(createProjection(projectionType, config, dimensions), features);
      return {
        type: projectionType,
        ...config,
        center: fitted.center() as [number, number],
        scale: fitted.scale(),
      };
    },
    [projectionType, config, dimensions, features]
  );

  return {
    project,
    fitToFeatures,
    bounds,
  };
}

