/**
 * Layer Utilities
 *
 * Utility functions for managing and ordering spatial visualization layers.
 */

import type { SpatialLayer } from '../../../../types/viz/spatial.js';

/**
 * Layer configuration with z-index ordering.
 */
export interface LayerConfig {
  type: SpatialLayer['type'];
  zIndex?: number;
  opacity?: number;
  [key: string]: unknown;
}

/**
 * Ordered layer configuration with deterministic z-ordering.
 */
export interface OrderedLayerConfig {
  layer: SpatialLayer;
  zIndex: number;
  order: number; // Stable sort order
}

/**
 * Validation result for layer configuration.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Orders layers by z-index with stable sorting for deterministic output.
 *
 * @param layers - Array of layer configurations
 * @returns Ordered array of layers with z-index and stable order
 */
export function orderLayers(layers: SpatialLayer[]): OrderedLayerConfig[] {
  const ordered: OrderedLayerConfig[] = layers.map((layer, index) => {
    const zIndex = layer.zIndex ?? 0;
    return {
      layer,
      zIndex,
      order: index, // Preserve original order for stable sort
    };
  });

  // Stable sort: first by z-index (ascending), then by original order
  ordered.sort((a, b) => {
    if (a.zIndex !== b.zIndex) {
      return a.zIndex - b.zIndex;
    }
    return a.order - b.order;
  });

  return ordered;
}

/**
 * Validates a layer configuration.
 *
 * @param layer - Layer configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateLayerConfig(layer: SpatialLayer): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate layer type
  const validTypes = ['regionFill', 'symbol', 'route'];
  if (!validTypes.includes(layer.type)) {
    errors.push(`Invalid layer type: ${layer.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate z-index if present
  if (layer.zIndex !== undefined) {
    if (typeof layer.zIndex !== 'number' || !Number.isFinite(layer.zIndex)) {
      errors.push(`Invalid zIndex: must be a finite number`);
    }
  }

  // Type-specific validation
  if (layer.type === 'regionFill') {
    if (!('encoding' in layer) || !('color' in layer.encoding)) {
      errors.push('regionFill layer must have encoding.color with field');
    }
  } else if (layer.type === 'symbol') {
    if (!('encoding' in layer) || !('longitude' in layer.encoding) || !('latitude' in layer.encoding)) {
      errors.push('symbol layer must have encoding.longitude and encoding.latitude');
    }
  } else if (layer.type === 'route') {
    if (!('encoding' in layer) || !('start' in layer.encoding) || !('end' in layer.encoding)) {
      errors.push('route layer must have encoding.start and encoding.end');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merges layer configuration with defaults.
 *
 * @param layer - Layer configuration
 * @returns Layer with defaults applied
 */
export function mergeLayerDefaults(layer: SpatialLayer): SpatialLayer {
  const defaults: Partial<SpatialLayer> = {
    zIndex: 0,
  };

  return {
    ...defaults,
    ...layer,
  } as SpatialLayer;
}

