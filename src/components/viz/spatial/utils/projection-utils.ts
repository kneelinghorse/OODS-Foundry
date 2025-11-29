/**
 * Projection Utilities
 *
 * Utility functions for creating and managing d3-geo projections.
 */

import * as d3Geo from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import type { ProjectionConfig, ProjectionType } from '../../../../types/viz/spatial.js';

/**
 * Creates a d3-geo projection from type and configuration.
 *
 * @param type - Projection type (e.g., 'mercator', 'albersUsa')
 * @param config - Projection configuration parameters
 * @param dimensions - Canvas/viewport dimensions { width, height }
 * @returns Configured d3-geo projection
 */
export function createProjection(
  type: ProjectionType,
  config: ProjectionConfig,
  dimensions: { width: number; height: number }
): GeoProjection {
  let projection: GeoProjection;

  // Create projection based on type
  switch (type) {
    case 'mercator':
      projection = d3Geo.geoMercator();
      break;
    case 'albersUsa':
      projection = d3Geo.geoAlbersUsa();
      break;
    case 'equalEarth':
      projection = d3Geo.geoEqualEarth();
      break;
    case 'orthographic':
      projection = d3Geo.geoOrthographic();
      break;
    case 'conicEqualArea':
      projection = d3Geo.geoConicEqualArea();
      break;
    case 'conicConformal':
      projection = d3Geo.geoConicConformal();
      break;
    case 'azimuthalEqualArea':
      projection = d3Geo.geoAzimuthalEqualArea();
      break;
    case 'azimuthalEquidistant':
      projection = d3Geo.geoAzimuthalEquidistant();
      break;
    case 'gnomonic':
      projection = d3Geo.geoGnomonic();
      break;
    case 'stereographic':
      projection = d3Geo.geoStereographic();
      break;
    case 'naturalEarth1':
      projection = d3Geo.geoNaturalEarth1();
      break;
    case 'equirectangular':
      projection = d3Geo.geoEquirectangular();
      break;
    default:
      // Fallback to mercator
      projection = d3Geo.geoMercator();
  }

  // Apply configuration
  if (config.center !== undefined) {
    projection.center(config.center);
  }

  if (config.scale !== undefined) {
    projection.scale(config.scale);
  } else {
    // Default scale based on dimensions
    const defaultScale = Math.min(dimensions.width, dimensions.height) / 2;
    projection.scale(defaultScale);
  }

  if (config.rotate !== undefined) {
    if (config.rotate.length === 2) {
      projection.rotate([config.rotate[0], config.rotate[1]]);
    } else if (config.rotate.length === 3) {
      projection.rotate(config.rotate);
    }
  }

  if (config.parallels !== undefined && 'parallels' in projection) {
    (projection as d3Geo.GeoConicProjection).parallels(config.parallels);
  }

  if (config.clipAngle !== undefined) {
    projection.clipAngle(config.clipAngle);
  }

  if (config.clipExtent !== undefined) {
    projection.clipExtent(config.clipExtent);
  }

  if (config.precision !== undefined) {
    projection.precision(config.precision);
  }

  // Set translate to center of viewport
  projection.translate([dimensions.width / 2, dimensions.height / 2]);

  return projection;
}

/**
 * Fits a projection to a collection of GeoJSON features.
 *
 * @param projection - The projection to fit
 * @param features - GeoJSON feature collection
 * @returns The fitted projection (same instance, modified in place)
 */
export function fitProjectionToFeatures(
  projection: GeoProjection,
  features: FeatureCollection<Geometry>,
  dimensions?: { width: number; height: number }
): GeoProjection {
  if (features.features.length === 0) {
    return projection;
  }

  const width = dimensions?.width ?? projection.translate()[0] * 2;
  const height = dimensions?.height ?? projection.translate()[1] * 2;

  projection.fitSize([width, height], features);

  return projection;
}

/**
 * Projects geographic coordinates (longitude, latitude) to screen coordinates.
 *
 * @param projection - The projection to use
 * @param lon - Longitude
 * @param lat - Latitude
 * @returns Screen coordinates [x, y] or null if point is outside clip area
 */
export function projectCoordinates(
  projection: GeoProjection,
  lon: number,
  lat: number
): [number, number] | null {
  const result = projection([lon, lat]);
  return result ? [result[0], result[1]] : null;
}
