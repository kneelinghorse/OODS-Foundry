/**
 * Projection Configuration Generator
 *
 * Generates renderer-specific projection configurations from trait parameters.
 * Handles differences between Vega-Lite and ECharts projection APIs.
 */

import { PROJECTION_TYPES } from './HasProjection.trait.js';
import type { ProjectionType } from './HasProjection.trait.js';

/**
 * Renderer type for projection config generation
 */
export type RendererType = 'vega-lite' | 'echarts';

/**
 * Renderer-specific projection configuration
 */
export interface RendererProjectionConfig {
  type: string;
  [key: string]: unknown;
}

/**
 * Projection parameters from trait schema
 */
export interface ProjectionParams {
  projection_type?: string;
  projection_center?: string;
  projection_scale?: number;
  projection_rotate?: string;
  projection_clip_extent?: string;
}

/**
 * Parse JSON array string safely
 */
function parseJsonArray<T>(value: string | undefined, defaultValue: T): T {
  if (!value) {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Validate and assert projection type (throws on invalid)
 */
function assertProjectionType(type: string | undefined): ProjectionType {
  if (!type) {
    return 'mercator';
  }

  if (!PROJECTION_TYPES.includes(type as ProjectionType)) {
    throw new Error(
      `Invalid projection type: ${type}. Supported types: ${PROJECTION_TYPES.join(', ')}`
    );
  }

  return type as ProjectionType;
}

/**
 * Generate Vega-Lite projection configuration
 */
function generateVegaLiteConfig(
  params: ProjectionParams,
  projectionType: ProjectionType
): RendererProjectionConfig {
  const config: RendererProjectionConfig = {
    type: projectionType,
  };

  // Vega-Lite uses "center" for [lon, lat]
  if (params.projection_center) {
    const center = parseJsonArray<[number, number]>(params.projection_center, [0, 0]);
    config.center = center;
  }

  // Vega-Lite uses "scale"
  if (params.projection_scale !== undefined) {
    config.scale = params.projection_scale;
  }

  // Vega-Lite uses "rotate" for [lambda, phi, gamma]
  if (params.projection_rotate) {
    const rotate = parseJsonArray<[number, number, number]>(params.projection_rotate, [0, 0, 0]);
    config.rotate = rotate;
  }

  // Vega-Lite uses "clipExtent" for clipping
  if (params.projection_clip_extent) {
    const clipExtent = parseJsonArray<[[number, number], [number, number]]>(
      params.projection_clip_extent,
      [
        [0, 0],
        [0, 0],
      ]
    );
    config.clipExtent = clipExtent;
  }

  return config;
}

/**
 * Generate ECharts projection configuration
 */
function generateEChartsConfig(
  params: ProjectionParams,
  projectionType: ProjectionType
): RendererProjectionConfig {
  const config: RendererProjectionConfig = {
    type: projectionType,
    projection: projectionType,
  };

  // ECharts uses "center" for [lon, lat]
  if (params.projection_center) {
    const center = parseJsonArray<[number, number]>(params.projection_center, [0, 0]);
    config.center = center;
  }

  // ECharts uses "zoom" which is roughly 1/scale
  if (params.projection_scale !== undefined) {
    // Approximate conversion: zoom ≈ log2(scale / 100)
    config.zoom = Math.log2(Math.max(1, params.projection_scale / 100));
  }

  // ECharts uses "roam" for pan/zoom, but rotation is in projection config
  if (params.projection_rotate) {
    const rotate = parseJsonArray<[number, number, number]>(params.projection_rotate, [0, 0, 0]);
    config.rotate = rotate;
  }

  // ECharts uses "boundingCoords" for extent
  if (params.projection_clip_extent) {
    const clipExtent = parseJsonArray<[[number, number], [number, number]]>(
      params.projection_clip_extent,
      [
        [0, 0],
        [0, 0],
      ]
    );
    // Convert clip extent to bounding coordinates [minLon, minLat, maxLon, maxLat]
    config.boundingCoords = [clipExtent[0][0], clipExtent[0][1], clipExtent[1][0], clipExtent[1][1]];
  }

  return config;
}

/**
 * Generate renderer-specific projection configuration
 *
 * @param params - Projection parameters from trait schema
 * @param renderer - Target renderer ('vega-lite' or 'echarts')
 * @returns Renderer-specific projection configuration
 * @throws {Error} If projection type is invalid or parameters are malformed
 */
export function generateProjectionConfig(
  params: ProjectionParams,
  renderer: RendererType = 'vega-lite'
): RendererProjectionConfig {
  const projectionType = assertProjectionType(params.projection_type);

  // Generate renderer-specific config
  switch (renderer) {
    case 'vega-lite':
      return generateVegaLiteConfig(params, projectionType);
    case 'echarts':
      return generateEChartsConfig(params, projectionType);
    default:
      throw new Error(`Unsupported renderer: ${renderer}`);
  }
}

/**
 * Validate projection parameters
 *
 * @param params - Projection parameters to validate
 * @returns Validation result with errors if any
 */
export function validateProjectionParams(params: ProjectionParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate projection type
  if (params.projection_type) {
    if (!PROJECTION_TYPES.includes(params.projection_type as ProjectionType)) {
      errors.push(
        `Invalid projection type: ${params.projection_type}. Supported types: ${PROJECTION_TYPES.join(', ')}`
      );
    }
  }

  // Validate center format
  if (params.projection_center) {
    try {
      const center = JSON.parse(params.projection_center);
      if (!Array.isArray(center) || center.length !== 2) {
        errors.push('projection_center must be a [lon, lat] array');
      }
    } catch {
      errors.push('projection_center must be valid JSON array');
    }
  }

  // Validate scale
  if (params.projection_scale !== undefined) {
    if (typeof params.projection_scale !== 'number' || params.projection_scale < 1) {
      errors.push('projection_scale must be a number >= 1');
    }
  }

  // Validate rotate format
  if (params.projection_rotate) {
    try {
      const rotate = JSON.parse(params.projection_rotate);
      if (!Array.isArray(rotate) || rotate.length !== 3) {
        errors.push('projection_rotate must be a [lambda, phi, gamma] array');
      }
    } catch {
      errors.push('projection_rotate must be valid JSON array');
    }
  }

  // Validate clip extent format
  if (params.projection_clip_extent) {
    try {
      const clipExtent = JSON.parse(params.projection_clip_extent);
      if (
        !Array.isArray(clipExtent) ||
        clipExtent.length !== 2 ||
        !Array.isArray(clipExtent[0]) ||
        !Array.isArray(clipExtent[1])
      ) {
        errors.push('projection_clip_extent must be a [[x0, y0], [x1, y1]] array');
      }
    } catch {
      errors.push('projection_clip_extent must be valid JSON array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
