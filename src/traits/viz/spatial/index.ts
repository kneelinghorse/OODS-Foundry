/**
 * Spatial Traits Module
 *
 * Exports for spatial visualization traits and utilities.
 */

// Geocodable trait
export { default as GeocodableTrait } from '../../../../traits/viz/spatial/geocodable.trait.js';
export {
  detectGeoFields,
  hasGeoFields,
  getDetectionSummary,
  GEO_FIELD_PATTERNS,
  GEO_FIELD_TYPES,
  type DataRecord,
  type FieldSchema,
  type GeoDetectionOptions,
  type GeoFieldDetectionResult,
  type GeoFieldType,
  type GeoResolutionType,
  type DetectedGeoField,
  type GeocodableOutput,
} from './geo-field-detector.js';

// HasProjection trait
export { default as HasProjectionTrait } from './HasProjection.trait.js';
export type { ProjectionType, ProjectionConfig } from './HasProjection.trait.js';

// LayeredOverlay trait
export { default as LayeredOverlayTrait } from './LayeredOverlay.trait.js';
export type {
  BasemapType,
  LayerType,
  LayerConfig,
  OrderedLayerConfig,
} from './LayeredOverlay.trait.js';

// Utilities
export {
  generateProjectionConfig,
  validateProjectionParams,
  type RendererType,
  type RendererProjectionConfig,
  type ProjectionParams,
} from './projection-config-generator.js';

export {
  composeLayers,
  validateLayers,
  getDefaultZIndex,
  VALID_LAYER_TYPES,
} from './layer-compositor.js';
