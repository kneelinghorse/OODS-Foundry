// Shared geo option builder for the 3 geo ECharts-primary types (sprint-172 m01).
//
// Lifted VERBATIM out of viz.render.ts (sprint-112 m02 / sprint-119 m01 code) so the
// two consumers share ONE definition and can never drift:
//   - viz.render builds the served option from its own tool input.
//   - artifact.certify re-emits the SAME option from the IR + the optional `data.geo`
//     branch (s172), so its determinism proof and its input rejections are the render
//     path's, not a transcription of them.
//
// The ONLY change made during the lift is the signature: renderGeoOption no longer
// takes a whole VizRenderInput (certify has no such object) — it takes the identity
// fields it actually read (`id`, `name`) as a small record. Every guard, message,
// SpatialSpec shape and adapter call is byte-for-byte the pre-lift code, so
// viz.render's geo goldens are the proof that the lift changed nothing.
//
// The 'geo' branch carries inline geometry + per-type encoding; here we shape it
// into a slim SpatialSpec and a parsed FeatureCollection and hand both to the
// ported spatial adapter. The adapters validate layers/data themselves; we add
// per-type input guards (typed GeoInputError -> OODS-V126) so a missing
// valueField / lng-lat / geometry yields a clean bad-input error, not a crash.

import {
  adaptBubbleToECharts,
  adaptChoroplethToECharts,
  adaptFlowLineToECharts,
  registerGeoJson,
  type SpatialSpec,
  type TokenScope,
} from '@oods/viz-core';
import type { VizRenderInput } from '../schemas/generated.js';

/** The tool-input geo data branch. Typed off viz.render's schema so the shape has ONE home. */
export type GeoBranch = NonNullable<VizRenderInput['geo']>;
export type GeoChartType = 'choropleth' | 'bubble_map' | 'flow_map';

/**
 * The identity fields renderGeoOption reads. This is the whole of what it used to take
 * VizRenderInput for — naming them explicitly is what lets certify drive the same
 * builder from an IR (s172 m01).
 */
export interface GeoOptionIdentity {
  readonly id?: string;
  readonly name?: string;
}

export class GeoInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoInputError';
  }
}

// Provenance-only dimensions (carried in usermeta.oods.dimensions; not load-bearing
// for the headless option — the client sizes the canvas).
export const DEFAULT_GEO_DIMENSIONS = { width: 860, height: 520 } as const;

// Resolve the inline geometry to a GeoJSON FeatureCollection (converting TopoJSON
// via the ported registration normalizer). Returns undefined when no geometry was
// supplied (allowed for bubble_map — the client may register a base map).
export function resolveFeatureCollection(
  geo: GeoBranch,
): ReturnType<typeof registerGeoJson>['geoJson'] | undefined {
  const source = geo.geojson ?? geo.topojson;
  if (!source) {
    return undefined;
  }
  return registerGeoJson('geo', source as Parameters<typeof registerGeoJson>[1], {
    topoObjectName: geo.topoObjectName,
  }).geoJson;
}

export function renderGeoOption(
  identity: GeoOptionIdentity,
  chartType: GeoChartType,
  geo: GeoBranch,
  description: string,
  scope: TokenScope = {},
): { option: ReturnType<typeof adaptChoroplethToECharts>; count: number } {
  const rows = (geo.rows ?? []) as Array<Record<string, unknown>>;
  const id = identity.id ?? `viz:${chartType}`;
  const name = identity.name;

  if (chartType === 'choropleth') {
    const geoData = resolveFeatureCollection(geo);
    if (!geoData) {
      throw new GeoInputError("choropleth requires inline geometry ('geo.geojson' or 'geo.topojson').");
    }
    if (!geo.valueField) {
      throw new GeoInputError("choropleth requires 'geo.valueField' (the metric that colours each region).");
    }
    const spec: SpatialSpec = {
      id,
      ...(name ? { name } : {}),
      type: 'spatial',
      data: geo.join
        ? {
            type: 'data.geo.join',
            source: 'inline',
            geoSource: 'inline',
            joinKey: geo.join.dataKey,
            geoKey: geo.join.featureProperty,
          }
        : { values: rows },
      layers: [
        {
          type: 'regionFill',
          encoding: { color: { field: geo.valueField, ...(geo.colorScale ? { scale: geo.colorScale } : {}) } },
        },
      ],
      a11y: { description },
    };
    const option = adaptChoroplethToECharts(spec, geoData, rows, DEFAULT_GEO_DIMENSIONS, scope);
    return { option, count: geoData.features.length };
  }

  if (chartType === 'flow_map') {
    // flow_map: origin→destination ARC lines on the geo coordinate system. The geo
    // coordinateSystem needs a registered base map, so inline geometry is required
    // (it rides back on echartsSpec.__registration, exactly like choropleth).
    const geoData = resolveFeatureCollection(geo);
    if (!geoData) {
      throw new GeoInputError("flow_map requires inline base geometry ('geo.geojson' or 'geo.topojson') for the geo coordinate system.");
    }
    if (
      !geo.originLongitudeField ||
      !geo.originLatitudeField ||
      !geo.destinationLongitudeField ||
      !geo.destinationLatitudeField
    ) {
      throw new GeoInputError(
        "flow_map requires 'geo.originLongitudeField', 'geo.originLatitudeField', 'geo.destinationLongitudeField', and 'geo.destinationLatitudeField'.",
      );
    }
    if (rows.length === 0) {
      throw new GeoInputError("flow_map requires 'geo.rows' (the origin→destination flows).");
    }
    const spec: SpatialSpec = {
      id,
      ...(name ? { name } : {}),
      type: 'spatial',
      data: { values: [] },
      layers: [
        {
          type: 'route',
          encoding: {
            start: { field: geo.originLongitudeField, longitude: geo.originLongitudeField, latitude: geo.originLatitudeField },
            end: { field: geo.destinationLongitudeField, longitude: geo.destinationLongitudeField, latitude: geo.destinationLatitudeField },
            ...(geo.strengthField ? { strokeWidth: { field: geo.strengthField } } : {}),
            ...(geo.curvature !== undefined ? { curvature: { value: geo.curvature } } : {}),
          },
        },
      ],
      a11y: { description },
    };
    const option = adaptFlowLineToECharts(spec, geoData, rows, DEFAULT_GEO_DIMENSIONS, scope);
    return { option, count: rows.length };
  }

  // bubble_map
  if (!geo.longitudeField || !geo.latitudeField) {
    throw new GeoInputError("bubble_map requires 'geo.longitudeField' and 'geo.latitudeField'.");
  }
  if (rows.length === 0) {
    throw new GeoInputError("bubble_map requires 'geo.rows' (the points to plot).");
  }
  const geoData = resolveFeatureCollection(geo);
  const spec: SpatialSpec = {
    id,
    ...(name ? { name } : {}),
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: geo.longitudeField },
          latitude: { field: geo.latitudeField },
          ...(geo.sizeField ? { size: { field: geo.sizeField, scale: 'area' } } : {}),
          ...(geo.colorField
            ? { color: { field: geo.colorField, ...(geo.colorScale ? { scale: geo.colorScale } : {}) } }
            : {}),
        },
      },
    ],
    a11y: { description },
  };
  const option = adaptBubbleToECharts(spec, geoData, rows, DEFAULT_GEO_DIMENSIONS, scope);
  return { option, count: rows.length };
}
