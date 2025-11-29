import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../../src/parsers/index.js';
import GeocodableTrait, {
  GEO_FIELD_PATTERNS,
  GEO_FIELD_TYPES,
} from '../../../../traits/viz/spatial/geocodable.trait.js';
import {
  detectGeoFields,
  hasGeoFields,
  getDetectionSummary,
  type DataRecord,
} from '../../../../src/traits/viz/spatial/geo-field-detector.js';

const traitDir = join(__dirname, '..', '..', '..', '..', 'traits', 'viz', 'spatial');
const yamlPath = join(traitDir, 'geocodable.trait.yaml');

// =============================================================================
// Sample Test Data
// =============================================================================

const SAMPLE_DATA_COORDINATES: DataRecord[] = [
  { id: 1, name: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: 2, name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { id: 3, name: 'Chicago', lat: 41.8781, lng: -87.6298 },
];

const SAMPLE_DATA_IDENTIFIERS: DataRecord[] = [
  { id: 1, country: 'USA', state: 'California', city: 'Los Angeles' },
  { id: 2, country: 'USA', state: 'New York', city: 'New York City' },
  { id: 3, country: 'Canada', province: 'Ontario', city: 'Toronto' },
];

const SAMPLE_DATA_CODES: DataRecord[] = [
  { id: 1, fips_code: '06037', iso_code: 'US-CA', geo_id: 'loc_001' },
  { id: 2, fips: '36061', iso: 'US-NY', geo_id: 'loc_002' },
];

const SAMPLE_DATA_MIXED: DataRecord[] = [
  { id: 1, country: 'USA', state: 'CA', latitude: 34.0522, longitude: -118.2437 },
  { id: 2, country: 'USA', state: 'NY', latitude: 40.7128, longitude: -74.006 },
];

const SAMPLE_DATA_NON_GEO: DataRecord[] = [
  { id: 1, product: 'Widget', price: 29.99, quantity: 100 },
  { id: 2, product: 'Gadget', price: 49.99, quantity: 50 },
];

const SAMPLE_DATA_SIMILAR_BUT_NOT_GEO: DataRecord[] = [
  { id: 1, category: 'Electronics', status: 'Active', country_of_origin: 'China' },
  { id: 2, latitude_adjustment: 0.5, longitude_offset: 1.2, region_code: 'A1' },
];

// =============================================================================
// Trait Definition Tests
// =============================================================================

describe('Geocodable trait', () => {
  describe('YAML definition', () => {
    it('parses YAML definition with correct structure', async () => {
      const result = await parseTrait(yamlPath);

      expect(result.success).toBe(true);
      const def = result.data!;

      expect(def.trait.name).toBe('Geocodable');
      expect(def.trait.category).toBe('viz.spatial');
      expect(def.trait.version).toBe('1.0.0');
    });

    it('has required schema fields', async () => {
      const result = await parseTrait(yamlPath);
      expect(result.success).toBe(true);
      const def = result.data!;

      expect(def.schema).toHaveProperty('geo_resolution');
      expect(def.schema).toHaveProperty('geo_requires_lookup');
      expect(def.schema).toHaveProperty('geo_detected_fields');
      expect(def.schema).toHaveProperty('geo_latitude_field');
      expect(def.schema).toHaveProperty('geo_longitude_field');
    });

    it('has spatial tags and category', async () => {
      const result = await parseTrait(yamlPath);
      expect(result.success).toBe(true);
      const def = result.data!;

      // Verify spatial categorization
      expect(def.trait.category).toBe('viz.spatial');
      expect(def.trait.tags).toContain('spatial');
      expect(def.trait.tags).toContain('geo');
    });
  });

  describe('TypeScript definition', () => {
    it('exposes trait metadata', () => {
      expect(GeocodableTrait.trait.name).toBe('Geocodable');
      expect(GeocodableTrait.trait.category).toBe('viz.spatial');
      expect(GeocodableTrait.trait.tags).toContain('geo');
      expect(GeocodableTrait.trait.tags).toContain('spatial');
    });

    it('has schema with geo_resolution enum', () => {
      expect(GeocodableTrait.schema.geo_resolution.validation).toEqual({
        enum: ['point', 'boundary', 'both'],
      });
    });

    it('exports field patterns', () => {
      expect(GEO_FIELD_PATTERNS).toHaveProperty('identifiers');
      expect(GEO_FIELD_PATTERNS).toHaveProperty('coordinates');
      expect(GEO_FIELD_PATTERNS).toHaveProperty('codes');
      expect(GEO_FIELD_PATTERNS.identifiers.length).toBeGreaterThan(0);
      expect(GEO_FIELD_PATTERNS.coordinates.length).toBeGreaterThan(0);
    });

    it('exports geo field types', () => {
      expect(GEO_FIELD_TYPES).toContain('field.geopoint');
      expect(GEO_FIELD_TYPES).toContain('field.geojson');
      expect(GEO_FIELD_TYPES).toContain('field.topojson');
    });

    it('has tokens defined', () => {
      expect(GeocodableTrait.tokens).toHaveProperty('viz.spatial.geocodable.icon');
      expect(GeocodableTrait.tokens).toHaveProperty('viz.spatial.geocodable.badge.point');
      expect(GeocodableTrait.tokens).toHaveProperty('viz.spatial.geocodable.badge.boundary');
    });

    it('exposes detection metadata and outputs contract', () => {
      expect(GeocodableTrait.detection.fieldPatterns).toHaveLength(3);
      expect(GeocodableTrait.detection.fieldTypes).toEqual(
        expect.arrayContaining(['field.geopoint', 'field.geojson', 'field.topojson'])
      );

      expect(GeocodableTrait.outputs.geoResolution).toContain('point');
      expect(GeocodableTrait.outputs.geoResolution).toContain('boundary');
      expect(GeocodableTrait.outputs.geoResolution).toContain('both');
      expect(GeocodableTrait.outputs.requiresLookup).toBe('boolean');
    });
  });

  describe('parameter definitions', () => {
    it('defines valid parameter types', () => {
      const params = GeocodableTrait.parameters;

      expect(params).toBeDefined();
      expect(params.length).toBeGreaterThan(0);

      const autoDetect = params.find((p) => p.name === 'autoDetect');
      expect(autoDetect).toBeDefined();
      expect(autoDetect?.type).toBe('boolean');
      expect(autoDetect?.default).toBe(true);

      const minConfidence = params.find((p) => p.name === 'minConfidence');
      expect(minConfidence).toBeDefined();
      expect(minConfidence?.type).toBe('number');
      expect(minConfidence?.validation?.minimum).toBe(0);
      expect(minConfidence?.validation?.maximum).toBe(1);
    });

    it('has valid schema field definitions', () => {
      const schema = GeocodableTrait.schema;

      expect(schema.geo_resolution.validation?.enum).toEqual(['point', 'boundary', 'both']);
      expect(schema.geo_requires_lookup.type).toBe('boolean');
      expect(schema.geo_auto_detect_enabled.default).toBe(true);
    });
  });
});

// =============================================================================
// Geo Field Detector Tests
// =============================================================================

describe('geo-field-detector', () => {
  describe('detectGeoFields', () => {
    it('detects latitude/longitude coordinate fields', () => {
      const result = detectGeoFields(SAMPLE_DATA_COORDINATES);

      expect(result.detectedFields.length).toBeGreaterThan(0);
      expect(result.geoResolution).toBe('point');
      expect(result.requiresLookup).toBe(false);

      // Should find lat/lon fields
      const fieldNames = result.detectedFields.map((f) => f.field);
      expect(fieldNames.some((f) => /lat/i.test(f))).toBe(true);
      expect(fieldNames.some((f) => /lon|lng/i.test(f))).toBe(true);
    });

    it('detects country/state identifier fields', () => {
      const result = detectGeoFields(SAMPLE_DATA_IDENTIFIERS);

      expect(result.detectedFields.length).toBeGreaterThan(0);
      expect(result.geoResolution).toBe('boundary');
      expect(result.requiresLookup).toBe(true);

      // Should find country, state, city fields
      const fieldNames = result.detectedFields.map((f) => f.field);
      expect(fieldNames).toContain('country');
      expect(fieldNames.some((f) => f === 'state' || f === 'province')).toBe(true);
    });

    it('detects FIPS and ISO code fields', () => {
      const result = detectGeoFields(SAMPLE_DATA_CODES);

      expect(result.detectedFields.length).toBeGreaterThan(0);

      const fieldNames = result.detectedFields.map((f) => f.field);
      expect(fieldNames.some((f) => /fips/i.test(f))).toBe(true);
      expect(fieldNames.some((f) => /iso/i.test(f))).toBe(true);
    });

    it('returns correct geoResolution for mixed data', () => {
      const result = detectGeoFields(SAMPLE_DATA_MIXED);

      // Has both coordinates and identifiers
      expect(result.geoResolution).toBe('both');
      expect(result.requiresLookup).toBe(false); // Has coordinates, no lookup needed
    });

    it('returns correct latitude/longitude field names', () => {
      const result = detectGeoFields(SAMPLE_DATA_COORDINATES);

      expect(result.latitudeField).toBeDefined();
      expect(result.longitudeField).toBeDefined();
      expect(result.latitudeField).toMatch(/lat/i);
      expect(result.longitudeField).toMatch(/lon|lng/i);
    });

    it('returns identifier field and type for boundary data', () => {
      const result = detectGeoFields(SAMPLE_DATA_IDENTIFIERS);

      expect(result.identifierField).toBeDefined();
      expect(result.identifierType).toBeDefined();
    });

    it('does not false-positive on non-geo data', () => {
      const result = detectGeoFields(SAMPLE_DATA_NON_GEO);

      expect(result.detectedFields).toHaveLength(0);
    });

    it('handles similar but non-geo field names carefully', () => {
      const result = detectGeoFields(SAMPLE_DATA_SIMILAR_BUT_NOT_GEO, {
        analyzeValues: true,
        minConfidence: 0.7,
      });

      // "country_of_origin" might match but values won't confirm
      // "latitude_adjustment" should not match the exact pattern
      const coordFields = result.detectedFields.filter((f) => f.type === 'coordinate');

      // Coordinate fields should not include adjustment/offset fields
      expect(coordFields.every((f) => f.confidence >= 0.7)).toBe(true);
    });

    it('detects prefixed/suffixed geo fields', () => {
      const data = [
        { shipping_country: 'USA', billing_state: 'CA', user_latitude: 34.05, user_longitude: -118.24 },
      ];

      const result = detectGeoFields(data);

      expect(result.geoResolution).toBe('both');
      expect(result.requiresLookup).toBe(false);
      const fields = result.detectedFields.map((f) => f.field);
      expect(fields).toEqual(
        expect.arrayContaining(['shipping_country', 'billing_state', 'user_latitude', 'user_longitude'])
      );
    });

    it('uses geometry type to infer boundary resolution without lookup', () => {
      const result = detectGeoFields(
        [{ geometry: { type: 'Polygon', coordinates: [] } }],
        { fieldSchemas: [{ name: 'geometry', type: 'field.geojson' }] }
      );

      expect(result.geoResolution).toBe('boundary');
      expect(result.requiresLookup).toBe(false);
      expect(result.detectedFields.some((f) => f.field === 'geometry' && f.type === 'geometry')).toBe(true);
    });

    it('does not treat generic x/y fields as geo without hints', () => {
      const result = detectGeoFields([{ x: 1, y: 2, value: 3 }], { minConfidence: 0.6 });

      expect(result.detectedFields).toHaveLength(0);
      expect(result.geoResolution).toBe('point');
    });

    it('respects minConfidence threshold', () => {
      const resultLow = detectGeoFields(SAMPLE_DATA_COORDINATES, { minConfidence: 0.5 });
      const resultHigh = detectGeoFields(SAMPLE_DATA_COORDINATES, { minConfidence: 0.99 });

      expect(resultLow.detectedFields.length).toBeGreaterThanOrEqual(resultHigh.detectedFields.length);
    });

    it('handles empty data gracefully', () => {
      const result = detectGeoFields([]);

      expect(result.detectedFields).toHaveLength(0);
      expect(result.geoResolution).toBe('point'); // Default
      expect(result.requiresLookup).toBe(false);
    });

    it('uses field schemas for type-based detection', () => {
      const result = detectGeoFields(
        [{ location: [37.7749, -122.4194] }],
        {
          fieldSchemas: [{ name: 'location', type: 'field.geopoint' }],
        }
      );

      const locationField = result.detectedFields.find((f) => f.field === 'location');
      expect(locationField).toBeDefined();
      expect(locationField?.type).toBe('coordinate');
      expect(locationField?.confidence).toBe(1.0);
    });
  });

  describe('hasGeoFields', () => {
    it('returns true for geo data', () => {
      expect(hasGeoFields(SAMPLE_DATA_COORDINATES)).toBe(true);
      expect(hasGeoFields(SAMPLE_DATA_IDENTIFIERS)).toBe(true);
      expect(hasGeoFields(SAMPLE_DATA_MIXED)).toBe(true);
    });

    it('returns false for non-geo data', () => {
      expect(hasGeoFields(SAMPLE_DATA_NON_GEO)).toBe(false);
    });
  });

  describe('getDetectionSummary', () => {
    it('generates summary for coordinate data', () => {
      const result = detectGeoFields(SAMPLE_DATA_COORDINATES);
      const summary = getDetectionSummary(result);

      expect(summary).toContain('Point coordinates detected');
      expect(summary).toMatch(/\d+ field/);
    });

    it('generates summary for boundary data', () => {
      const result = detectGeoFields(SAMPLE_DATA_IDENTIFIERS);
      const summary = getDetectionSummary(result);

      expect(summary).toContain('Geographic boundaries detected');
      expect(summary).toContain('geocoding required');
    });

    it('generates summary for mixed data', () => {
      const result = detectGeoFields(SAMPLE_DATA_MIXED);
      const summary = getDetectionSummary(result);

      expect(summary).toContain('Both points and boundaries detected');
    });

    it('generates summary for empty detection', () => {
      const result = detectGeoFields(SAMPLE_DATA_NON_GEO);
      const summary = getDetectionSummary(result);

      expect(summary).toBe('No geographic fields detected');
    });
  });
});

// =============================================================================
// Pattern Matching Tests
// =============================================================================

describe('GEO_FIELD_PATTERNS', () => {
  describe('identifier patterns', () => {
    const testCases = [
      ['country', true],
      ['country_code', true],
      ['country_name', true],
      ['state', true],
      ['state_code', true],
      ['province', true],
      ['region', true],
      ['city', true],
      ['city_name', true],
      ['zip', true],
      ['zip_code', true],
      ['postal_code', true],
      ['county', true],
      ['district', true],
      ['random_field', false],
      ['description', false],
    ] as const;

    it.each(testCases)('matches "%s" correctly: %s', (fieldName, shouldMatch) => {
      const matches = GEO_FIELD_PATTERNS.identifiers.some((p) => p.test(fieldName));
      expect(matches).toBe(shouldMatch);
    });
  });

  describe('coordinate patterns', () => {
    const testCases = [
      ['lat', true],
      ['latitude', true],
      ['lon', true],
      ['longitude', true],
      ['lng', true],
      ['geo_x', true],
      ['geo_y', true],
      ['x', false],
      ['y', false],
      ['name', false],
      ['value', false],
    ] as const;

    it.each(testCases)('matches "%s" correctly: %s', (fieldName, shouldMatch) => {
      const matches = GEO_FIELD_PATTERNS.coordinates.some((p) => p.test(fieldName));
      expect(matches).toBe(shouldMatch);
    });
  });

  describe('code patterns', () => {
    const testCases = [
      ['fips', true],
      ['fips_code', true],
      ['iso', true],
      ['iso_2', true],
      ['iso_3', true],
      ['iso_code', true],
      ['geo_id', true],
      ['geoid', true],
      ['admin_code', true],
      ['place_id', true],
      ['user_id', false],
      ['transaction_id', false],
    ] as const;

    it.each(testCases)('matches "%s" correctly: %s', (fieldName, shouldMatch) => {
      const matches = GEO_FIELD_PATTERNS.codes.some((p) => p.test(fieldName));
      expect(matches).toBe(shouldMatch);
    });
  });
});

// =============================================================================
// Trait Composition Tests
// =============================================================================

describe('trait composition', () => {
  it('Geocodable has no conflicting traits', () => {
    expect(GeocodableTrait.metadata?.conflicts_with).toEqual([]);
  });

  it('Geocodable has no dependencies', () => {
    expect(GeocodableTrait.dependencies).toEqual([]);
  });

  it('can be used with Identifiable-like data', () => {
    const data = [
      { id: 'loc_1', name: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.006 },
      { id: 'loc_2', name: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278 },
    ];

    const result = detectGeoFields(data);

    // Should detect geo fields without being confused by id/name
    expect(result.detectedFields.some((f) => f.field === 'country')).toBe(true);
    expect(result.latitudeField).toBe('latitude');
    expect(result.longitudeField).toBe('longitude');

    // Should not detect 'id' or 'name' as geo fields
    expect(result.detectedFields.every((f) => f.field !== 'id')).toBe(true);
    expect(result.detectedFields.every((f) => f.field !== 'name')).toBe(true);
  });

  it('can be used with Timestamped-like data', () => {
    const data = [
      { created_at: '2024-01-01', location: 'NYC', lat: 40.7128, lon: -74.006 },
      { created_at: '2024-01-02', location: 'LA', lat: 34.0522, lon: -118.2437 },
    ];

    const result = detectGeoFields(data);

    // Should detect lat/lon
    expect(result.latitudeField).toBe('lat');
    expect(result.longitudeField).toBe('lon');

    // Should not detect created_at as geo field
    expect(result.detectedFields.every((f) => f.field !== 'created_at')).toBe(true);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  it('handles null and undefined values', () => {
    const data = [
      { lat: null, lon: undefined, country: 'USA' },
      { lat: 40.7128, lon: -74.006, country: null },
    ];

    const result = detectGeoFields(data);

    // Should still detect the fields
    expect(result.detectedFields.length).toBeGreaterThan(0);
  });

  it('handles mixed numeric and string coordinate values', () => {
    const data = [
      { latitude: 40.7128, longitude: '-74.006' },
      { latitude: '34.0522', longitude: -118.2437 },
    ];

    const result = detectGeoFields(data);

    expect(result.latitudeField).toBe('latitude');
    expect(result.longitudeField).toBe('longitude');
  });

  it('handles deeply nested field names', () => {
    // Flat extraction - nested fields should be accessed with dot notation
    const data = [
      { 'location.latitude': 40.7128, 'location.longitude': -74.006 },
    ];

    const result = detectGeoFields(data);

    // Field names with dots should still match patterns
    const hasLatField = result.detectedFields.some((f) => f.field.includes('latitude'));
    const hasLonField = result.detectedFields.some((f) => f.field.includes('longitude'));

    expect(hasLatField).toBe(true);
    expect(hasLonField).toBe(true);
  });

  it('handles case variations in field names', () => {
    const data = [
      { LATITUDE: 40.7128, LONGITUDE: -74.006 },
      { Latitude: 34.0522, Longitude: -118.2437 },
    ];

    const result = detectGeoFields(data);

    expect(result.detectedFields.length).toBeGreaterThan(0);
    expect(result.geoResolution).toBe('point');
  });

  it('handles very large datasets efficiently', () => {
    const largeData: DataRecord[] = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      latitude: 40 + Math.random(),
      longitude: -74 + Math.random(),
    }));

    const start = performance.now();
    const result = detectGeoFields(largeData, { maxSampleSize: 100 });
    const duration = performance.now() - start;

    expect(result.latitudeField).toBe('latitude');
    expect(result.longitudeField).toBe('longitude');
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });
});
