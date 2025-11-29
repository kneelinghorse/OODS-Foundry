/**
 * Spatial Traits Module
 *
 * Exports for spatial visualization traits and utilities.
 */

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
