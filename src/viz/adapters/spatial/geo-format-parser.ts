/**
 * Geo Format Parser
 *
 * Handles format detection and conversion between GeoJSON and TopoJSON formats.
 */

import type { Feature as GeoJSONFeature, FeatureCollection as GeoJSONFeatureCollection, Geometry as GeoJSONGeometry } from 'geojson';
import type { GeometryObject as TopoJSONGeometry, Objects as TopoJSONObjects, Topology as TopoJSONTopology } from 'topojson-specification';
export type { GeoJSONFeature, GeoJSONFeatureCollection, GeoJSONGeometry };

export type ParsedGeoData = GeoJSONFeatureCollection | GeoJSONFeature | GeoJSONGeometry | TopoJSONTopology<TopoJSONObjects<TopoJSONGeometry>>;

export type GeoFormat = 'geojson' | 'topojson' | 'unknown';

/**
 * Detects the format of geo data.
 */
export function detectGeoFormat(data: unknown): GeoFormat {
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  const obj = data as Record<string, unknown>;

  // Check for TopoJSON (has 'type: "Topology"' and 'arcs' array)
  if (obj.type === 'Topology' && Array.isArray(obj.arcs)) {
    return 'topojson';
  }

  // Check for GeoJSON FeatureCollection
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return 'geojson';
  }

  // Check for GeoJSON Feature
  if (obj.type === 'Feature' && obj.geometry) {
    return 'geojson';
  }

  // Check for GeoJSON Geometry
  if (
    obj.type &&
    typeof obj.type === 'string' &&
    ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(obj.type) &&
    obj.coordinates !== undefined
  ) {
    return 'geojson';
  }

  // GeometryCollection has geometries array instead of coordinates
  if (obj.type === 'GeometryCollection' && Array.isArray(obj.geometries)) {
    return 'geojson';
  }

  return 'unknown';
}

/**
 * Parses a geo source (string URL, inline JSON, or already parsed object).
 */
export function parseGeoSource(source: string | object): ParsedGeoData {
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      return parsed as ParsedGeoData;
    } catch (error) {
      const position = error instanceof SyntaxError && error.message.match(/position (\d+)/);
      const pos = position ? position[1] : 'unknown';
      throw new Error(`Failed to parse geo data: invalid JSON at position ${pos}`);
    }
  }

  if (typeof source === 'object' && source !== null) {
    return source as ParsedGeoData;
  }

  throw new Error('Geo source must be a JSON string or parsed object');
}

/**
 * Converts TopoJSON to GeoJSON FeatureCollection.
 * Requires topojson-client package.
 */
export function convertTopoToGeo(
  topo: TopoJSONTopology<TopoJSONObjects<TopoJSONGeometry>>,
  objectName: string
): GeoJSONFeatureCollection {
  // Dynamic import to handle optional dependency
  let topojsonClient: typeof import('topojson-client');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    topojsonClient = require('topojson-client');
  } catch {
    throw new Error(
      'topojson-client package is required for TopoJSON conversion. Install with: pnpm add -D topojson-client'
    );
  }

  const topologyObject = topo.objects[objectName];
  if (!topologyObject) {
    const available = Object.keys(topo.objects).join(', ');
    throw new Error(
      `TopoJSON object '${objectName}' not found. Available objects: [${available}]`
    );
  }

  try {
    const featureCollection = topojsonClient.feature(topo, topologyObject);
    return featureCollection as GeoJSONFeatureCollection;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert TopoJSON to GeoJSON: ${message}`);
  }
}

/**
 * Normalizes geo data to GeoJSON FeatureCollection format.
 */
export function normalizeToGeoJSON(
  data: ParsedGeoData,
  topoObjectName?: string
): GeoJSONFeatureCollection {
  const format = detectGeoFormat(data);

  if (format === 'geojson') {
    // Accept FeatureCollection directly
    if ((data as GeoJSONFeatureCollection).type === 'FeatureCollection') {
      const geojson = data as GeoJSONFeatureCollection;
      if (!Array.isArray(geojson.features)) {
        throw new Error('Invalid GeoJSON FeatureCollection structure');
      }
      return geojson;
    }

    // Normalize a single Feature to a FeatureCollection
    if ((data as GeoJSONFeature).type === 'Feature') {
      return {
        type: 'FeatureCollection',
        features: [data as GeoJSONFeature],
      };
    }

    // Normalize a Geometry to a FeatureCollection with a single Feature
    const geometry = data as GeoJSONGeometry;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry,
          properties: {},
        },
      ],
    };
  }

  if (format === 'topojson') {
    const topo = data as TopoJSONTopology<TopoJSONObjects<TopoJSONGeometry>>;
    if (!topoObjectName) {
      // Try to find the first object
      const objectNames = Object.keys(topo.objects);
      if (objectNames.length === 0) {
        throw new Error('TopoJSON has no objects to convert');
      }
      if (objectNames.length > 1) {
        throw new Error(
          `Multiple TopoJSON objects found: [${objectNames.join(', ')}]. Specify objectName parameter.`
        );
      }
      return convertTopoToGeo(topo, objectNames[0]);
    }
    return convertTopoToGeo(topo, topoObjectName);
  }

  throw new Error('Unrecognized geo format. Expected GeoJSON or TopoJSON.');
}
