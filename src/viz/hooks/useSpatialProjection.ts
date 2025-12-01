/**
 * useSpatialProjection Hook
 *
 * React hook that manages geographic projection calculations using d3-geo.
 */

import { useMemo } from 'react';
import { geoBounds } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeoProjection } from 'd3-geo';
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
   * Underlying d3 projection instance (fitted when requested).
   */
  projection: GeoProjection;

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
      fitProjectionToFeatures(proj, features, dimensions);
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

    const computedBounds = geoBounds(features);
    const [min, max] = computedBounds;

    if (!min || !max || !Number.isFinite(min[0]) || !Number.isFinite(min[1]) || !Number.isFinite(max[0]) || !Number.isFinite(max[1])) {
      return [
        [-180, -90],
        [180, 90],
      ] as [[number, number], [number, number]];
    }

    return [
      [min[0], min[1]],
      [max[0], max[1]],
    ] as [[number, number], [number, number]];
  }, [features]);

  const project = useMemo(
    () => (lon: number, lat: number) => projectCoordinates(projection, lon, lat),
    [projection]
  );

  const fitToFeatures = useMemo(
    () => (): ProjectionConfig => {
      const fitted = fitProjectionToFeatures(createProjection(projectionType, config, dimensions), features, dimensions);
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
    projection,
    fitToFeatures,
    bounds,
  };
}
