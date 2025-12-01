import { createRequire } from 'node:module';
import type { FeatureCollection } from 'geojson';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

const require = createRequire(import.meta.url);

export interface GeoRegistration {
  readonly name: string;
  readonly geoJson: FeatureCollection;
}

const registry = new Map<string, FeatureCollection>();

function isTopology(input: FeatureCollection | Topology): input is Topology {
  return (input as Topology).type === 'Topology';
}

function normalizeGeoJson(input: FeatureCollection | Topology, topoObjectName?: string): FeatureCollection {
  if (!isTopology(input)) {
    return input;
  }

  const objectName = topoObjectName ?? Object.keys(input.objects ?? {})[0];
  if (!objectName) {
    throw new Error('TopoJSON object name is required to register a map.');
  }

  const object = input.objects[objectName];
  if (!object) {
    throw new Error(`TopoJSON object "${objectName}" not found in topology.`);
  }

  const collection = topojsonFeature(input, object);
  if (collection.type !== 'FeatureCollection') {
    throw new Error('Failed to convert TopoJSON to GeoJSON FeatureCollection.');
  }

  return collection as FeatureCollection;
}

export function registerGeoJson(
  name: string,
  geoJson: FeatureCollection | Topology,
  options?: { readonly topoObjectName?: string; readonly replace?: boolean }
): GeoRegistration {
  const normalized = normalizeGeoJson(geoJson, options?.topoObjectName);
  const existing = registry.get(name);

  if (existing && !options?.replace) {
    return { name, geoJson: existing };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const echarts = require('echarts');
    const registerMap: ((mapName: string, data: FeatureCollection) => void) | undefined = echarts?.registerMap;
    if (typeof registerMap === 'function') {
      registerMap(name, normalized);
    }
  } catch (error) {
    console.warn(`ECharts not available for geo registration (${name}): ${error instanceof Error ? error.message : String(error)}`);
  }

  registry.set(name, normalized);
  return { name, geoJson: normalized };
}

export function getRegisteredGeoJson(name: string): FeatureCollection | undefined {
  return registry.get(name);
}

export function isGeoRegistered(name: string): boolean {
  return registry.has(name);
}
