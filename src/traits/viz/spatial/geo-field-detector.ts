/**
 * Geo Field Detector
 *
 * Utility for automatically detecting geographic fields in datasets.
 * Scans field names and values to identify coordinates, identifiers, and geometry fields.
 */

/**
 * Geo field type indicating how the field represents geographic data.
 */
export type GeoFieldType = 'coordinate' | 'identifier' | 'geometry';

/**
 * Resolution type indicating what kind of geographic output can be produced.
 */
export type GeoResolutionType = 'point' | 'boundary' | 'both';

/**
 * Detection result for a single geo field.
 */
export interface DetectedGeoField {
  readonly field: string;
  readonly type: GeoFieldType;
  readonly confidence: number;
  readonly pattern?: string;
}

/**
 * Complete output from the Geocodable trait detection.
 */
export interface GeocodableOutput {
  readonly geoResolution: GeoResolutionType;
  readonly requiresLookup: boolean;
  readonly detectedFields: readonly DetectedGeoField[];
}

/**
 * Field patterns used for auto-detection of geographic fields.
 */
export const GEO_FIELD_PATTERNS = {
  /** Geographic identifiers that resolve to boundaries */
  identifiers: [
    /^(country|nation)(_?(code|id|name))?$/i,
    /^(state|province|region)(_?(code|id|name))?$/i,
    /^(city|town|municipality)(_?(name|id))?$/i,
    /^(zip|postal)(_?code)?$/i,
    /^(county|district|prefecture)(_?(name|id))?$/i,
  ],
  /** Coordinate fields that represent point locations */
  coordinates: [
    /^lat(itude)?$/i,
    /^lon(gitude)?$/i,
    /^lng$/i,
    /^geo_?x$/i,
    /^geo_?y$/i,
  ],
  /** Standard geographic code systems */
  codes: [
    /^fips(_?code)?$/i,
    /^iso(_?(2|3|code))?$/i,
    /^geo_?id$/i,
    /^admin_?code$/i,
    /^place_?id$/i,
  ],
} as const;

/**
 * Field types that explicitly indicate geographic content.
 */
export const GEO_FIELD_TYPES = ['field.geopoint', 'field.geojson', 'field.topojson'] as const;

/**
 * Data record type for generic dataset entries.
 */
export type DataRecord = Record<string, unknown>;

/**
 * Field schema information used for type-based detection.
 */
export interface FieldSchema {
  readonly name: string;
  readonly type?: string;
  readonly format?: string;
}

/**
 * Options for geo field detection.
 */
export interface GeoDetectionOptions {
  /** Minimum confidence threshold for including detected fields (0-1). */
  readonly minConfidence?: number;
  /** Field schemas to use for type-based detection. */
  readonly fieldSchemas?: readonly FieldSchema[];
  /** Whether to analyze sample values for coordinate detection. */
  readonly analyzeValues?: boolean;
  /** Maximum number of sample rows to analyze. */
  readonly maxSampleSize?: number;
}

/**
 * Result of geo field detection including all detected fields and derived outputs.
 */
export interface GeoFieldDetectionResult extends GeocodableOutput {
  /** Primary latitude field if detected. */
  readonly latitudeField?: string;
  /** Primary longitude field if detected. */
  readonly longitudeField?: string;
  /** Primary identifier field if detected. */
  readonly identifierField?: string;
  /** Type of primary identifier (e.g., 'country', 'state', 'fips'). */
  readonly identifierType?: string;
}

/** Latitude value range for coordinate detection. */
const LAT_RANGE = { min: -90, max: 90 };
/** Longitude value range for coordinate detection. */
const LON_RANGE = { min: -180, max: 180 };

/**
 * Check if a field name matches any pattern in a pattern group.
 */
function matchesPatternGroup(fieldName: string, patterns: readonly RegExp[]): RegExp | undefined {
  const normalized = fieldName.toLowerCase().trim();
  const tokenized = normalized
    // Break camelCase into tokens before splitting on delimiters
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  // Exact/whole-field match
  const direct = patterns.find((pattern) => pattern.test(normalized));
  if (direct) {
    return direct;
  }

  // Token-level match (supports prefixes/suffixes like shipping_country, userLatitude)
  for (const token of tokenized) {
    const match = patterns.find((pattern) => pattern.test(token));
    if (match) {
      return match;
    }
  }

  return undefined;
}

/**
 * Determine the geo field type based on pattern matching.
 */
function detectFieldTypeByPattern(fieldName: string): { type: GeoFieldType; pattern: string } | null {
  // Check coordinate patterns first (highest specificity)
  const coordPattern = matchesPatternGroup(fieldName, GEO_FIELD_PATTERNS.coordinates);
  if (coordPattern) {
    return { type: 'coordinate', pattern: coordPattern.source };
  }

  // Check code patterns (fips, iso, geo_id)
  const codePattern = matchesPatternGroup(fieldName, GEO_FIELD_PATTERNS.codes);
  if (codePattern) {
    return { type: 'identifier', pattern: codePattern.source };
  }

  // Check identifier patterns (country, state, city, etc.)
  const identifierPattern = matchesPatternGroup(fieldName, GEO_FIELD_PATTERNS.identifiers);
  if (identifierPattern) {
    return { type: 'identifier', pattern: identifierPattern.source };
  }

  return null;
}

/**
 * Check if a field type explicitly indicates geographic data.
 */
function isExplicitGeoType(fieldType: string | undefined): boolean {
  if (!fieldType) return false;
  return GEO_FIELD_TYPES.includes(fieldType as (typeof GEO_FIELD_TYPES)[number]);
}

/**
 * Analyze sample values to detect if a field contains coordinate-like numbers.
 *
 * Value-only detection (without field name hints) requires:
 * - Values must be floats with decimal places (not integers)
 * - Values must have precision typical of coordinates (multiple decimal places)
 */
function analyzeValuesForCoordinates(
  values: unknown[],
  fieldName: string
): { isLat: boolean; isLon: boolean; confidence: number } {
  const numericValues: number[] = [];

  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      numericValues.push(value);
    } else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        numericValues.push(parsed);
      }
    }
  }

  if (numericValues.length === 0) {
    return { isLat: false, isLon: false, confidence: 0 };
  }

  // Check if values fall within coordinate ranges
  const inLatRange = numericValues.every((v) => v >= LAT_RANGE.min && v <= LAT_RANGE.max);
  const inLonRange = numericValues.every((v) => v >= LON_RANGE.min && v <= LON_RANGE.max);

  // Calculate confidence based on value distribution and field name hints
  const normalizedName = fieldName.toLowerCase();
  const hasLatHint = /lat/.test(normalizedName);
  const hasLonHint = /lon|lng/.test(normalizedName);
  const hasGeoHint = hasLatHint || hasLonHint || /geo|coord|pos/.test(normalizedName);

  // Check if values look like real coordinates (have decimal precision)
  // Integer values like 50, 100 are unlikely to be coordinates
  const hasDecimalPrecision = numericValues.some((v) => {
    const str = v.toString();
    return str.includes('.') && str.split('.')[1]?.length >= 2;
  });

  let latConfidence = 0;
  let lonConfidence = 0;

  // Only consider as coordinate if:
  // 1. Has a geo-related field name hint, OR
  // 2. Has decimal precision typical of coordinates
  if (!hasGeoHint && !hasDecimalPrecision) {
    return { isLat: false, isLon: false, confidence: 0 };
  }

  if (inLatRange) {
    // Base confidence is low without field name hint
    latConfidence = hasDecimalPrecision ? 0.5 : 0.3;
    if (hasLatHint) latConfidence = 0.95;
  }

  if (inLonRange) {
    lonConfidence = hasDecimalPrecision ? 0.5 : 0.3;
    if (hasLonHint) lonConfidence = 0.95;
    // If not in lat range but in lon range (lon has wider range), boost lon confidence
    if (!inLatRange && hasDecimalPrecision) lonConfidence = Math.min(lonConfidence + 0.1, 0.95);
  }

  // If values are in lat range but not lon range (small values), more likely lat
  if (inLatRange && !inLonRange && hasDecimalPrecision) {
    latConfidence = Math.min(latConfidence + 0.1, 0.95);
  }

  // Without field name hints, require higher threshold
  if (!hasGeoHint) {
    // Pure value analysis needs decimal precision and reasonable confidence
    if (latConfidence < 0.6) latConfidence = 0;
    if (lonConfidence < 0.6) lonConfidence = 0;
  }

  return {
    isLat: latConfidence >= 0.5,
    isLon: lonConfidence >= 0.5,
    confidence: Math.max(latConfidence, lonConfidence),
  };
}

/**
 * Extract the identifier type from a matched pattern.
 */
function extractIdentifierType(pattern: string): string | undefined {
  // Extract the primary identifier type from the pattern
  const typeMatches: Record<string, string> = {
    country: 'country',
    nation: 'country',
    state: 'state',
    province: 'state',
    region: 'region',
    city: 'city',
    town: 'city',
    municipality: 'city',
    zip: 'postal',
    postal: 'postal',
    county: 'county',
    district: 'district',
    fips: 'fips',
    iso: 'iso',
    geo_id: 'geo_id',
  };

  for (const [key, value] of Object.entries(typeMatches)) {
    if (pattern.toLowerCase().includes(key)) {
      return value;
    }
  }

  return undefined;
}

/**
 * Sample values from a dataset for a specific field.
 */
function sampleFieldValues(data: readonly DataRecord[], fieldName: string, maxSamples: number): unknown[] {
  const values: unknown[] = [];
  const step = Math.max(1, Math.floor(data.length / maxSamples));

  for (let i = 0; i < data.length && values.length < maxSamples; i += step) {
    const record = data[i];
    if (record && fieldName in record) {
      values.push(record[fieldName]);
    }
  }

  return values;
}

/**
 * Detect geographic fields in a dataset.
 *
 * @param data - Array of data records to analyze
 * @param options - Detection options
 * @returns Detection result with all identified geo fields
 */
export function detectGeoFields(
  data: readonly DataRecord[],
  options: GeoDetectionOptions = {}
): GeoFieldDetectionResult {
  const {
    minConfidence = 0.7,
    fieldSchemas = [],
    analyzeValues = true,
    maxSampleSize = 100,
  } = options;

  const detectedFields: DetectedGeoField[] = [];
  const fieldNames = new Set<string>();

  // Collect all unique field names from data
  for (const record of data.slice(0, maxSampleSize)) {
    if (record && typeof record === 'object') {
      for (const key of Object.keys(record)) {
        fieldNames.add(key);
      }
    }
  }

  // Add field names from schemas
  for (const schema of fieldSchemas) {
    fieldNames.add(schema.name);
  }

  // Analyze each field
  for (const fieldName of fieldNames) {
    let fieldType: GeoFieldType | null = null;
    let confidence = 0;
    let pattern: string | undefined;

    // Check for explicit geo type in schema
    const schema = fieldSchemas.find((s) => s.name === fieldName);
    if (schema && isExplicitGeoType(schema.type)) {
      fieldType = schema.type === 'field.geopoint' ? 'coordinate' : 'geometry';
      confidence = 1.0;
      pattern = schema.type;
    }

    // Check field name patterns
    if (!fieldType) {
      const patternResult = detectFieldTypeByPattern(fieldName);
      if (patternResult) {
        fieldType = patternResult.type;
        pattern = patternResult.pattern;
        confidence = 0.85; // High confidence for pattern match
      }
    }

    // Analyze values if enabled and field type not yet determined or is coordinate
    if (analyzeValues && data.length > 0) {
      const sampleValues = sampleFieldValues(data, fieldName, maxSampleSize);

      if (sampleValues.length > 0) {
        if (!fieldType) {
          // Check if values look like coordinates
          const coordAnalysis = analyzeValuesForCoordinates(sampleValues, fieldName);
          if (coordAnalysis.isLat || coordAnalysis.isLon) {
            fieldType = 'coordinate';
            confidence = coordAnalysis.confidence;
            pattern = coordAnalysis.isLat ? 'value_analysis:latitude' : 'value_analysis:longitude';
          }
        } else if (fieldType === 'coordinate') {
          // Boost confidence if value analysis confirms coordinate pattern
          const coordAnalysis = analyzeValuesForCoordinates(sampleValues, fieldName);
          if (coordAnalysis.isLat || coordAnalysis.isLon) {
            confidence = Math.min(confidence + 0.1, 1.0);
          }
        }
      }
    }

    // Add to detected fields if confidence meets threshold
    if (fieldType && confidence >= minConfidence) {
      detectedFields.push({
        field: fieldName,
        type: fieldType,
        confidence,
        pattern,
      });
    }
  }

  // Sort by confidence (descending)
  detectedFields.sort((a, b) => b.confidence - a.confidence);

  // Determine resolution type and other derived values
  const hasCoordinates = detectedFields.some((f) => f.type === 'coordinate');
  const hasIdentifiers = detectedFields.some((f) => f.type === 'identifier');
  const hasGeometry = detectedFields.some((f) => f.type === 'geometry');

  let geoResolution: GeoResolutionType;
  if ((hasCoordinates || hasGeometry) && hasIdentifiers) {
    geoResolution = 'both';
  } else if (hasCoordinates) {
    geoResolution = 'point';
  } else if (hasGeometry) {
    geoResolution = 'boundary';
  } else if (hasIdentifiers) {
    geoResolution = 'boundary';
  } else {
    geoResolution = 'point'; // Default
  }

  // Requires lookup if only identifiers are present (no direct coordinates/geometry)
  const requiresLookup = hasIdentifiers && !hasCoordinates && !hasGeometry;

  // Find primary latitude and longitude fields
  const latitudeField = detectedFields.find(
    (f) => f.type === 'coordinate' && /lat/i.test(f.field)
  )?.field;
  const longitudeField = detectedFields.find(
    (f) => f.type === 'coordinate' && /lon|lng/i.test(f.field)
  )?.field;

  // Find primary identifier field
  const primaryIdentifier = detectedFields.find((f) => f.type === 'identifier');
  const identifierField = primaryIdentifier?.field;
  const identifierType = primaryIdentifier?.pattern
    ? extractIdentifierType(primaryIdentifier.pattern)
    : undefined;

  return {
    geoResolution,
    requiresLookup,
    detectedFields,
    latitudeField,
    longitudeField,
    identifierField,
    identifierType,
  };
}

/**
 * Check if a dataset likely contains geographic data.
 *
 * @param data - Array of data records to check
 * @param options - Detection options
 * @returns True if geographic fields are detected
 */
export function hasGeoFields(data: readonly DataRecord[], options: GeoDetectionOptions = {}): boolean {
  const result = detectGeoFields(data, options);
  return result.detectedFields.length > 0;
}

/**
 * Get a summary of detected geo fields suitable for display.
 *
 * @param result - Detection result from detectGeoFields
 * @returns Human-readable summary string
 */
export function getDetectionSummary(result: GeoFieldDetectionResult): string {
  const { detectedFields, geoResolution, requiresLookup } = result;

  if (detectedFields.length === 0) {
    return 'No geographic fields detected';
  }

  const parts: string[] = [];

  // Resolution type
  switch (geoResolution) {
    case 'point':
      parts.push('Point coordinates detected');
      break;
    case 'boundary':
      parts.push('Geographic boundaries detected');
      break;
    case 'both':
      parts.push('Both points and boundaries detected');
      break;
  }

  // Field count
  parts.push(`(${detectedFields.length} field${detectedFields.length === 1 ? '' : 's'})`);

  // Lookup requirement
  if (requiresLookup) {
    parts.push('- geocoding required');
  }

  return parts.join(' ');
}
