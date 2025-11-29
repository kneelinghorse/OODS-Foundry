/**
 * Layer Compositor
 *
 * Composes layers into ordered structure with deterministic z-ordering.
 * Validates layer types and merges opacity settings.
 */

import type { LayerConfig, LayerType, OrderedLayerConfig } from './LayeredOverlay.trait.js';

/**
 * Valid layer types
 */
export const VALID_LAYER_TYPES: readonly LayerType[] = [
  'regionFill',
  'symbol',
  'route',
  'heatmap',
  'contour',
] as const;

/**
 * Default layer configuration
 */
const DEFAULT_LAYER_CONFIG: Partial<LayerConfig> = {
  opacity: 1.0,
  zIndex: 0,
};

/**
 * Parse layers JSON string safely
 */
function parseLayersJson(value: string | undefined): LayerConfig[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Validate layer type
 */
function validateLayerType(type: unknown): type is LayerType {
  return typeof type === 'string' && VALID_LAYER_TYPES.includes(type as LayerType);
}

/**
 * Validate layer configuration
 */
function validateLayerConfig(layer: unknown, index: number): {
  valid: boolean;
  errors: string[];
  config?: LayerConfig;
} {
  const errors: string[] = [];

  if (!layer || typeof layer !== 'object') {
    errors.push(`Layer ${index}: must be an object`);
    return { valid: false, errors };
  }

  const config = layer as Partial<LayerConfig>;

  // Validate type
  if (!config.type) {
    errors.push(`Layer ${index}: missing required 'type' field`);
  } else if (!validateLayerType(config.type)) {
    errors.push(
      `Layer ${index}: invalid type '${config.type}'. Must be one of: ${VALID_LAYER_TYPES.join(', ')}`
    );
  }

  // Validate zIndex
  if (config.zIndex !== undefined) {
    if (typeof config.zIndex !== 'number' || !Number.isInteger(config.zIndex)) {
      errors.push(`Layer ${index}: zIndex must be an integer`);
    }
  }

  // Validate opacity
  if (config.opacity !== undefined) {
    if (typeof config.opacity !== 'number' || config.opacity < 0 || config.opacity > 1) {
      errors.push(`Layer ${index}: opacity must be a number between 0 and 1`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Create validated config with defaults
  const validatedConfig: LayerConfig = {
    type: config.type as LayerType,
    zIndex: config.zIndex ?? DEFAULT_LAYER_CONFIG.zIndex ?? 0,
    opacity: config.opacity ?? DEFAULT_LAYER_CONFIG.opacity ?? 1.0,
    ...config,
  };

  return { valid: true, errors: [], config: validatedConfig };
}

/**
 * Compose layers into ordered structure
 *
 * @param layersJson - JSON string of layer configurations
 * @param basemap - Basemap type
 * @returns Ordered layer configuration with deterministic z-ordering
 * @throws {Error} If layer configurations are invalid
 */
export function composeLayers(
  layersJson: string | undefined,
  basemap: 'none' | 'tile' | 'boundaries' = 'boundaries'
): OrderedLayerConfig {
  const layers = parseLayersJson(layersJson);

  // Validate all layers
  const validationResults = layers.map((layer, index) => validateLayerConfig(layer, index));
  const allErrors = validationResults.flatMap((result) => result.errors);

  if (allErrors.length > 0) {
    throw new Error(`Invalid layer configurations:\n${allErrors.join('\n')}`);
  }

  // Extract validated configs
  const validatedLayers = validationResults
    .map((result) => result.config!)
    .filter((config): config is LayerConfig => config !== undefined);

  // Sort by zIndex (ascending) - lower zIndex renders first (behind)
  const sortedLayers = [...validatedLayers].sort((a, b) => {
    // Primary sort: zIndex
    if (a.zIndex !== b.zIndex) {
      return a.zIndex - b.zIndex;
    }
    // Secondary sort: preserve original order for same zIndex
    return validatedLayers.indexOf(a) - validatedLayers.indexOf(b);
  });

  return {
    basemap,
    layers: sortedLayers,
  };
}

/**
 * Validate layer configurations
 *
 * @param layersJson - JSON string of layer configurations
 * @returns Validation result with errors if any
 */
export function validateLayers(layersJson: string | undefined): {
  valid: boolean;
  errors: string[];
} {
  const layers = parseLayersJson(layersJson);
  const validationResults = layers.map((layer, index) => validateLayerConfig(layer, index));
  const allErrors = validationResults.flatMap((result) => result.errors);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Get default z-index for layer type
 *
 * @param layerType - Type of layer
 * @returns Default z-index value
 */
export function getDefaultZIndex(layerType: LayerType): number {
  // Default z-index ordering (lower = behind, higher = front):
  // regionFill: 0 (choropleth fills)
  // symbol: 10 (points/bubbles)
  // route: 20 (flow lines)
  // heatmap: 5 (density)
  // contour: 15 (isolines)
  const defaults: Record<LayerType, number> = {
    regionFill: 0,
    symbol: 10,
    route: 20,
    heatmap: 5,
    contour: 15,
  };

  return defaults[layerType] ?? 0;
}

