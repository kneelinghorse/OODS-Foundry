import { describe, it, expect } from 'vitest';
import {
  joinGeoWithData,
  validateJoinConfig,
  type DataRecord,
  type JoinConfig,
} from '@/viz/adapters/spatial/geo-data-joiner.js';
import type { GeoJSONFeature } from '@/viz/adapters/spatial/geo-format-parser.js';

describe('GeoDataJoiner', () => {
  const sampleFeatures: GeoJSONFeature[] = [
    {
      type: 'Feature',
      id: 'CA',
      properties: { name: 'California', abbrev: 'CA' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      type: 'Feature',
      id: 'TX',
      properties: { name: 'Texas', abbrev: 'TX' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      type: 'Feature',
      id: 'FL',
      properties: { name: 'Florida', abbrev: 'FL' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      type: 'Feature',
      id: 'NY',
      properties: { name: 'New York', abbrev: 'NY' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  ];

  const sampleData: DataRecord[] = [
    { state: 'California', population: 39538223 },
    { state: 'Texas', population: 29145505 },
    { state: 'Florida', population: 21538187 },
    { state: 'Arizona', population: 7151502 }, // Unmatched
  ];

  describe('joinGeoWithData', () => {
    it('should join features with data by string key', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const result = joinGeoWithData(sampleFeatures, sampleData, config);

      expect(result.features).toHaveLength(4);
      expect(result.joinedData.size).toBe(3); // CA, TX, FL matched
      expect(result.unmatchedFeatures).toContain('NY');
      expect(result.unmatchedData).toContain('Arizona');

      // Check merged properties
      const caFeature = result.features.find((f) => f.id === 'CA');
      expect(caFeature?.properties?.population).toBe(39538223);
    });

    it('should support one-to-many joins without dropping data', () => {
      const features: GeoJSONFeature[] = [
        {
          type: 'Feature',
          properties: { name: 'California' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ];

      const data: DataRecord[] = [
        { state: 'California', metric: 1 },
        { state: 'California', metric: 2 },
      ];

      const result = joinGeoWithData(features, data, {
        geoKey: 'name',
        dataKey: 'state',
      });

      expect(result.joinedData.size).toBe(1);
      const joinedValue = result.joinedData.get('california');
      expect(Array.isArray(joinedValue)).toBe(true);
      expect((joinedValue as DataRecord[])).toHaveLength(2);

      const joinedFeature = result.features[0];
      const joinedRecords = (joinedFeature?.properties as Record<string, unknown>).__joinedRecords as DataRecord[] | undefined;
      expect(joinedRecords).toBeDefined();
      expect(joinedRecords?.length).toBe(2);
    });

    it('should handle case-insensitive matching', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
        caseSensitive: false,
      };

      const features: GeoJSONFeature[] = [
        {
          type: 'Feature',
          properties: { name: 'CALIFORNIA' }, // Uppercase
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ];

      const data: DataRecord[] = [{ state: 'california' }]; // Lowercase

      const result = joinGeoWithData(features, data, config);
      expect(result.joinedData.size).toBe(1);
    });

    it('should handle case-sensitive matching', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
        caseSensitive: true,
      };

      const features: GeoJSONFeature[] = [
        {
          type: 'Feature',
          properties: { name: 'California' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ];

      const data: DataRecord[] = [{ state: 'california' }]; // Different case

      const result = joinGeoWithData(features, data, config);
      expect(result.joinedData.size).toBe(0); // No match due to case sensitivity
    });

    it('should handle numeric keys', () => {
      const features: GeoJSONFeature[] = [
        {
          type: 'Feature',
          properties: { id: 1 },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ];

      const data: DataRecord[] = [{ recordId: 1 }];

      const config: JoinConfig = {
        geoKey: 'id',
        dataKey: 'recordId',
      };

      const result = joinGeoWithData(features, data, config);
      expect(result.joinedData.size).toBe(1);
    });

    it('should handle empty data array', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const result = joinGeoWithData(sampleFeatures, [], config);

      expect(result.features).toHaveLength(4);
      expect(result.joinedData.size).toBe(0);
      expect(result.unmatchedFeatures).toHaveLength(4);
      expect(result.unmatchedData).toHaveLength(0);
    });

    it('should handle features with missing join keys', () => {
      const features: GeoJSONFeature[] = [
        {
          type: 'Feature',
          properties: { name: 'California' },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
        {
          type: 'Feature',
          properties: {}, // Missing name
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ];

      const data: DataRecord[] = [{ state: 'California' }];

      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const result = joinGeoWithData(features, data, config);
      expect(result.joinedData.size).toBe(1);
      expect(result.unmatchedFeatures.length).toBeGreaterThan(0);
    });

    it('should report all unmatched items', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const result = joinGeoWithData(sampleFeatures, sampleData, config);

      // NY has no match in data
      expect(result.unmatchedFeatures).toContain('NY');
      // Arizona has no match in features
      expect(result.unmatchedData).toContain('Arizona');
    });
  });

  describe('validateJoinConfig', () => {
    it('should validate correct join configuration', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const validation = validateJoinConfig(sampleFeatures, sampleData, config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing geo key', () => {
      const config: JoinConfig = {
        geoKey: 'nonexistent',
        dataKey: 'state',
      };

      const validation = validateJoinConfig(sampleFeatures, sampleData, config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('not found in geo feature properties');
    });

    it('should detect missing data key', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'nonexistent',
      };

      const validation = validateJoinConfig(sampleFeatures, sampleData, config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('not found in data records');
    });

    it('should handle empty features array', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const validation = validateJoinConfig([], sampleData, config);
      expect(validation.valid).toBe(true); // No features to check
    });

    it('should handle empty data array', () => {
      const config: JoinConfig = {
        geoKey: 'name',
        dataKey: 'state',
      };

      const validation = validateJoinConfig(sampleFeatures, [], config);
      expect(validation.valid).toBe(true); // No data to check
    });
  });
});
