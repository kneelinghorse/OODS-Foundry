/**
 * Geo Data Joiner
 *
 * Handles joining tabular data with geo features by key matching.
 */

import type { GeoJSONFeature } from './geo-format-parser.js';

export type DataRecord = Record<string, unknown>;

export interface JoinConfig {
  geoKey: string; // Key in geo feature properties
  dataKey: string; // Key in data records
  caseSensitive?: boolean; // Default: false
}

export type JoinedDataValue = DataRecord | DataRecord[];

export interface JoinedFeatures {
  features: GeoJSONFeature[];
  joinedData: Map<string, JoinedDataValue>;
  unmatchedFeatures: string[];
  unmatchedData: string[];
}

/**
 * Normalizes a key value for comparison.
 */
function normalizeKey(value: unknown, caseSensitive: boolean): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value).trim();
  return caseSensitive ? str : str.toLowerCase();
}

/**
 * Joins geo features with tabular data by matching keys.
 */
export function joinGeoWithData(
  features: GeoJSONFeature[],
  data: DataRecord[],
  config: JoinConfig
): JoinedFeatures {
  const { geoKey, dataKey, caseSensitive = false } = config;

  const joinedData = new Map<string, JoinedDataValue>();
  const unmatchedFeatures: string[] = [];
  const unmatchedData: string[] = [];

  // Build lookup map from data records (supports one-to-many)
  const dataMap = new Map<string, DataRecord[]>();

  for (const record of data) {
    const keyValue = record[dataKey];
    if (keyValue === null || keyValue === undefined) {
      continue;
    }
    const normalizedKey = normalizeKey(keyValue, caseSensitive);
    if (normalizedKey) {
      const existing = dataMap.get(normalizedKey);
      if (existing) {
        existing.push(record);
      } else {
        dataMap.set(normalizedKey, [record]);
      }
    }
  }

  // Join features with data
  const joinedFeatures: GeoJSONFeature[] = [];

  for (const feature of features) {
    const featureId = feature.id !== undefined ? String(feature.id) : undefined;
    const properties = feature.properties || {};
    const geoKeyValue = properties[geoKey];

    if (geoKeyValue === null || geoKeyValue === undefined) {
      const id = featureId || 'unknown';
      unmatchedFeatures.push(id);
      joinedFeatures.push(feature);
      continue;
    }

    const normalizedGeoKey = normalizeKey(geoKeyValue, caseSensitive);

    if (!normalizedGeoKey) {
      const id = featureId || 'unknown';
      unmatchedFeatures.push(id);
      joinedFeatures.push(feature);
      continue;
    }

    const matchedRecords = dataMap.get(normalizedGeoKey);

    if (matchedRecords && matchedRecords.length > 0) {
      // Merge data into feature properties; keep full record array to support one-to-many joins
      const mergedProperties = matchedRecords.reduce<Record<string, unknown>>(
        (acc, record) => ({ ...acc, ...record }),
        { ...properties }
      );

      const enrichedProperties =
        matchedRecords.length > 1
          ? { ...mergedProperties, __joinedRecords: matchedRecords }
          : mergedProperties;

      joinedFeatures.push({
        ...feature,
        properties: enrichedProperties,
      });
      joinedData.set(normalizedGeoKey, matchedRecords.length === 1 ? matchedRecords[0] : matchedRecords);
    } else {
      const id = featureId || normalizedGeoKey;
      unmatchedFeatures.push(id);
      joinedFeatures.push(feature);
    }
  }

  // Find unmatched data records
  for (const [key, records] of dataMap.entries()) {
    if (joinedData.has(key)) {
      continue;
    }

    for (const record of records) {
      const recordKey = String(record[dataKey] || key);
      unmatchedData.push(recordKey);
    }
  }

  return {
    features: joinedFeatures,
    joinedData,
    unmatchedFeatures,
    unmatchedData,
  };
}

/**
 * Validates join configuration and provides helpful error messages.
 */
export function validateJoinConfig(
  features: GeoJSONFeature[],
  data: DataRecord[],
  config: JoinConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { geoKey, dataKey } = config;

  // Check geo key exists
  if (features.length > 0) {
    const sampleFeature = features[0];
    const properties = sampleFeature.properties || {};
    if (!(geoKey in properties)) {
      const available = Object.keys(properties).slice(0, 10).join(', ');
      errors.push(
        `Join key '${geoKey}' not found in geo feature properties. Available: [${available}${Object.keys(properties).length > 10 ? '...' : ''}]`
      );
    }
  }

  // Check data key exists
  if (data.length > 0) {
    const sampleRecord = data[0];
    if (!(dataKey in sampleRecord)) {
      const available = Object.keys(sampleRecord).slice(0, 10).join(', ');
      errors.push(
        `Join key '${dataKey}' not found in data records. Available: [${available}${Object.keys(sampleRecord).length > 10 ? '...' : ''}]`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
