/**
 * Geo Data Resolver
 *
 * Main utility that fetches, parses, and joins geographic data from various
 * sources (URL, inline GeoJSON, TopoJSON) with tabular data for visualization.
 */

import type { GeoJSONFeature, GeoJSONFeatureCollection } from './geo-format-parser.js';
import {
  detectGeoFormat,
  normalizeToGeoJSON,
  parseGeoSource,
  type ParsedGeoData,
} from './geo-format-parser.js';
import { fetchGeoSource } from './geo-fetch.js';
import {
  joinGeoWithData,
  validateJoinConfig,
  type DataRecord,
  type JoinConfig,
  type JoinedDataValue,
} from './geo-data-joiner.js';

export interface GeoResolverInput {
  geoSource: string | ParsedGeoData; // URL, inline JSON string, or parsed object
  data?: DataRecord[];
  joinConfig?: JoinConfig;
  topoObjectName?: string; // Required if TopoJSON has multiple objects
  fetchOptions?: {
    timeout?: number;
    cache?: boolean;
    forceRefresh?: boolean;
  };
}

export interface GeoResolverOutput {
  features: GeoJSONFeature[]; // Always normalized to GeoJSON
  joinedData?: Map<string, JoinedDataValue>; // Data keyed by feature ID (supports one-to-many)
  metadata: {
    featureCount: number;
    hasJoinedData: boolean;
    unmatchedFeatures: string[];
    unmatchedData: string[];
    format: 'geojson' | 'topojson';
    source: 'url' | 'inline' | 'parsed';
  };
}

/**
 * Resolves geo data from various sources and optionally joins with tabular data.
 */
export async function resolveGeoData(input: GeoResolverInput): Promise<GeoResolverOutput> {
  const { geoSource, data, joinConfig, topoObjectName, fetchOptions } = input;

  let parsedData: ParsedGeoData;
  let sourceType: 'url' | 'inline' | 'parsed' = 'parsed';
  let detectedFormat: 'geojson' | 'topojson' = 'geojson';

  // Handle URL sources
  if (typeof geoSource === 'string' && (geoSource.startsWith('http://') || geoSource.startsWith('https://'))) {
    try {
      parsedData = await fetchGeoSource(geoSource, fetchOptions);
      sourceType = 'url';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Avoid double-prefixing when fetchGeoSource already returns contextual message
      if (message.includes('Failed to fetch geo data from URL')) {
        throw new Error(message);
      }
      throw new Error(`Failed to fetch geo data from URL: ${message}`);
    }
  } else if (typeof geoSource === 'string') {
    // Inline JSON string
    try {
      parsedData = parseGeoSource(geoSource);
      sourceType = 'inline';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse inline geo data: ${message}`);
    }
  } else {
    // Already parsed object
    parsedData = geoSource;
    sourceType = 'parsed';
  }

  // Detect format
  const format = detectGeoFormat(parsedData);
  if (format === 'unknown') {
    throw new Error('Unrecognized geo format. Expected GeoJSON or TopoJSON.');
  }
  detectedFormat = format;

  // Normalize to GeoJSON
  let featureCollection: GeoJSONFeatureCollection;
  try {
    featureCollection = normalizeToGeoJSON(parsedData, topoObjectName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to normalize geo data: ${message}`);
  }

  const features = featureCollection.features;
  const featureCount = features.length;

  // Join with data if provided
  let joinedData: Map<string, JoinedDataValue> | undefined;
  let unmatchedFeatures: string[] = [];
  let unmatchedData: string[] = [];
  let finalFeatures = features;

  if (data && joinConfig) {
    // Validate join configuration
    const validation = validateJoinConfig(features, data, joinConfig);
    if (!validation.valid) {
      // Warn but continue - user might want to see what happens
      console.warn(`Join configuration issues: ${validation.errors.join('; ')}`);
    }

    // Perform join
    const result = joinGeoWithData(features, data, joinConfig);
    finalFeatures = result.features; // Use joined features with merged properties
    joinedData = result.joinedData;
    unmatchedFeatures = result.unmatchedFeatures;
    unmatchedData = result.unmatchedData;

    // Warn if no matches
    if (joinedData.size === 0 && data.length > 0) {
      console.warn(
        `Warning: No data records matched geo features. Check join keys (geo: '${joinConfig.geoKey}', data: '${joinConfig.dataKey}').`
      );
    }
  }

  return {
    features: finalFeatures,
    joinedData,
    metadata: {
      featureCount,
      hasJoinedData: joinedData !== undefined && joinedData.size > 0,
      unmatchedFeatures,
      unmatchedData,
      format: detectedFormat,
      source: sourceType,
    },
  };
}
