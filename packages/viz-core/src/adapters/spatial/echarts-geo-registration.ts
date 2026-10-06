// Geo registration → FeatureCollection normalization (sprint-112 m01 port).
//
// MISSION-START AUDIT (Rule 1) — headless registration is PURE + STATELESS:
//   The src/ original (a) called echarts.registerMap as a side-effect via
//   createRequire(import.meta.url) + require('echarts'), and (b) memoised results
//   in a module-level registry Map (returning the cached FeatureCollection on a
//   name collision). Both are dropped in the headless port:
//     - The require('echarts') side-effect is incompatible with the "echarts is a
//       TYPE-ONLY import" + "dual ESM/CJS build clean" success criteria
//       (createRequire(import.meta.url) breaks the CJS output), and is pointless
//       server-side: viz.render returns the FeatureCollection on the option via
//       the __registration escape hatch and the CLIENT re-registers the map by
//       name (geo specs are documented as NOT self-contained — decision #745).
//     - The module-level cache bleeds geoJson across requests that share a derived
//       map name (every choropleth without an explicit geo.feature/source/id/name
//       defaults to 'custom-geo'), which would make the goldened option
//       order-dependent across the suite — a determinism hazard for m03.
//   So registerGeoJson is now a pure function: normalize TopoJSON→GeoJSON (via
//   topojson-client) and return { name, geoJson }. No side effects, no shared
//   state, fully deterministic. getRegisteredGeoJson / isGeoRegistered are dropped
//   (no backing store, no headless consumer); reintroduce a store only if a real
//   consumer needs one.

import type { FeatureCollection } from 'geojson';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export interface GeoRegistration {
  readonly name: string;
  readonly geoJson: FeatureCollection;
}

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

/**
 * Normalize a GeoJSON FeatureCollection or TopoJSON Topology to a
 * FeatureCollection and return it under the given map name. Pure + stateless:
 * the returned geoJson always reflects THIS call's input (see audit header).
 */
export function registerGeoJson(
  name: string,
  geoJson: FeatureCollection | Topology,
  options?: { readonly topoObjectName?: string }
): GeoRegistration {
  const normalized = normalizeGeoJson(geoJson, options?.topoObjectName);
  return { name, geoJson: normalized };
}
