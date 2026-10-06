/**
 * Spatial Visualization Types (slim headless subset)
 *
 * The SLIM port of src/types/viz/spatial.ts into @oods/viz-core (sprint-112 m01),
 * mirroring the s111 network-flow.ts port. Only the subset the two headless geo
 * adapters (choropleth + bubble_map) actually read travels here — NOT the full
 * 409-line SpatialSpec.
 *
 * MISSION-START AUDIT (Rule 1) — trim decisions (defaults from the s112 design
 * lock, decision #745):
 *   - DROPPED the field-level geo types (GeoPointField / GeoJsonField /
 *     GeoJsonGeometry / TopoJsonField / GeoField) and SpatialDataSource.fields —
 *     the headless adapters take an already-parsed `geoData: FeatureCollection`
 *     and a separate `data: DataRecord[]`, so these inline field descriptors are
 *     never read.
 *   - REVIVED RouteLayer / RouteEndpointEncoding / CurvatureEncoding / isRouteLayer
 *     (sprint-119 m01) — recovered VERBATIM from commit c67edb8 to back the new
 *     flow_map (origin→destination ARC) geo type, the 6th explicit-only geo render.
 *     They were originally trimmed in the s112 port as an unbuilt, out-of-beachhead
 *     feature; flow_map is that beachhead, so SpatialLayer now widens back to
 *     RegionFillLayer | SymbolLayer | RouteLayer.
 *   - MADE `projection` OPTIONAL (it is required in the source contract). Headless
 *     ECharts owns the projection via the client-side registerMap; neither adapter
 *     reads spec.projection. It is carried optional so the m02 handler may pass an
 *     agent-supplied projection through without it being load-bearing.
 *
 * Pure TS, zero runtime imports. Consumed by the per-type spatial ECharts adapters
 * as the spec model (distinct from the NormalizedVizSpec IR — the geo path predates
 * and sits beside the IR, exactly as in src/).
 */

// =============================================================================
// Scale + encoding primitives
// =============================================================================

/** Color scale types for choropleth encoding. */
export type ColorScaleType = 'quantize' | 'quantile' | 'threshold' | 'linear' | 'ordinal' | 'diverging';

/** Size scale types for symbol encoding. */
export type SizeScaleType = 'linear' | 'sqrt' | 'log' | 'area';

/** Symbol shape types. */
export type SymbolShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';

/** Color encoding for layers. */
export interface ColorEncoding {
  field?: string;
  value?: string;
  scale?: ColorScaleType;
  domain?: number[];
  range?: string[];
  nullValue?: string;
}

/** Size encoding for symbol layers. */
export interface SizeEncoding {
  field?: string;
  value?: number;
  scale?: SizeScaleType;
  range?: [number, number];
}

/** Opacity encoding for layers. */
export interface OpacityEncoding {
  field?: string;
  value?: number;
}

/** Stroke encoding for layers. */
export interface StrokeEncoding {
  value?: string;
}

/** Stroke width encoding for layers. */
export interface StrokeWidthEncoding {
  field?: string;
  value?: number;
  scale?: SizeScaleType;
  range?: [number, number];
}

/** Position encoding for symbol layer. */
export interface PositionEncoding {
  field: string;
}

/** Shape encoding for symbol layer. */
export interface ShapeEncoding {
  field?: string;
  value?: SymbolShape;
}

// =============================================================================
// Layers
// =============================================================================

/** Choropleth/region fill layer type. */
export interface RegionFillLayer {
  type: 'regionFill';
  from?: string;
  encoding: {
    color: ColorEncoding & { field: string };
    opacity?: OpacityEncoding;
    stroke?: StrokeEncoding;
    strokeWidth?: StrokeWidthEncoding;
  };
  zIndex?: number;
}

/** Symbol/bubble map layer type. */
export interface SymbolLayer {
  type: 'symbol';
  encoding: {
    longitude: PositionEncoding;
    latitude: PositionEncoding;
    size?: SizeEncoding;
    color?: ColorEncoding;
    shape?: ShapeEncoding;
    opacity?: OpacityEncoding;
  };
  zIndex?: number;
}

/**
 * Route endpoint encoding (flow_map — recovered VERBATIM from c67edb8, sprint-119 m01).
 */
export interface RouteEndpointEncoding {
  field: string;
  longitude?: string;
  latitude?: string;
}

/**
 * Curvature encoding for route layer (flow_map — recovered VERBATIM from c67edb8).
 */
export interface CurvatureEncoding {
  value?: number;
}

/**
 * Route/flow line layer type (the flow_map origin→destination ARC — recovered
 * VERBATIM from c67edb8, sprint-119 m01).
 */
export interface RouteLayer {
  type: 'route';
  encoding: {
    start: RouteEndpointEncoding;
    end: RouteEndpointEncoding;
    strokeWidth?: StrokeWidthEncoding;
    color?: ColorEncoding;
    opacity?: OpacityEncoding;
    curvature?: CurvatureEncoding;
  };
  zIndex?: number;
}

/**
 * Union of the spatial layer types the headless adapters build. RouteLayer (the
 * flow_map ARC) rejoined the subset in sprint-119 m01 alongside the s112 choropleth
 * (regionFill) + bubble_map (symbol) types.
 */
export type SpatialLayer = RegionFillLayer | SymbolLayer | RouteLayer;

// =============================================================================
// Data + geo source
// =============================================================================

/** Dataset-level type for geo+data joins. */
export interface GeoJoinData {
  type: 'data.geo.join';
  source: string;
  geoSource: string;
  joinKey: string;
  geoKey: string;
  format?: 'geojson' | 'topojson';
}

/** Standard tabular data source (the bubble path reads `values`). */
export interface SpatialDataSource {
  values?: Record<string, unknown>[];
  url?: string;
  format?: 'json' | 'csv' | 'topojson' | 'geojson';
}

/** Geographic data source configuration (adapters read `source` + `feature`). */
export interface GeoSourceConfig {
  source: string | object;
  format?: 'geojson' | 'topojson';
  topology?: string;
  feature?: string;
  meshOnly?: boolean;
}

// =============================================================================
// Projection (optional — carried, never read headlessly; see audit header)
// =============================================================================

/** Supported projection types from d3-geo. */
export type ProjectionType =
  | 'mercator'
  | 'albersUsa'
  | 'equalEarth'
  | 'orthographic'
  | 'conicEqualArea'
  | 'conicConformal'
  | 'azimuthalEqualArea'
  | 'azimuthalEquidistant'
  | 'gnomonic'
  | 'stereographic'
  | 'naturalEarth1'
  | 'equirectangular';

/** Geographic projection configuration following d3-geo patterns. */
export interface ProjectionConfig {
  type?: ProjectionType;
  center?: [number, number];
  scale?: number;
  rotate?: [number, number] | [number, number, number];
  parallels?: [number, number];
  clipAngle?: number;
  clipExtent?: [[number, number], [number, number]];
  precision?: number;
  fitToData?: boolean;
}

// =============================================================================
// Accessibility / interactions / config
// =============================================================================

/** Table fallback configuration for accessibility. */
export interface TableFallbackConfig {
  enabled?: boolean;
  caption?: string;
  columns?: string[];
  sortDefault?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Narrative configuration for accessibility. */
export interface NarrativeConfig {
  summary?: string;
  keyFindings?: string[];
}

/** Accessibility specification for spatial visualizations. */
export interface SpatialA11yConfig {
  description: string;
  ariaLabel?: string;
  narrative?: NarrativeConfig;
  tableFallback?: TableFallbackConfig;
}

/** Interaction types for spatial visualizations. */
export type SpatialInteractionType = 'panZoom' | 'regionSelect' | 'tooltip' | 'layerToggle';

/** Interaction configuration. */
export interface SpatialInteraction {
  type: SpatialInteractionType;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/** Layout configuration for spatial spec. */
export interface SpatialLayoutConfig {
  width?: number;
  height?: number;
  padding?: number;
}

/** Visualization configuration for spatial spec. */
export interface SpatialVizConfig {
  theme?: string;
  tokens?: Record<string, string | number>;
  layout?: SpatialLayoutConfig;
}

// =============================================================================
// Main spec
// =============================================================================

/**
 * Complete spatial visualization specification (slim headless subset).
 */
export interface SpatialSpec {
  $schema?: 'https://oods-foundry.com/viz-spec/spatial/v1';
  id?: string;
  name?: string;
  type: 'spatial';
  data: GeoJoinData | SpatialDataSource;
  projection?: ProjectionConfig;
  geo?: GeoSourceConfig;
  layers: SpatialLayer[];
  config?: SpatialVizConfig;
  a11y: SpatialA11yConfig;
  interactions?: SpatialInteraction[];
}

// =============================================================================
// Type guards
// =============================================================================

/** Type guard for GeoJoinData. */
export function isGeoJoinData(data: GeoJoinData | SpatialDataSource): data is GeoJoinData {
  return 'type' in data && data.type === 'data.geo.join';
}

/** Type guard for RegionFillLayer. */
export function isRegionFillLayer(layer: SpatialLayer): layer is RegionFillLayer {
  return layer.type === 'regionFill';
}

/** Type guard for SymbolLayer. */
export function isSymbolLayer(layer: SpatialLayer): layer is SymbolLayer {
  return layer.type === 'symbol';
}

/** Type guard for RouteLayer (flow_map — recovered VERBATIM from c67edb8, sprint-119 m01). */
export function isRouteLayer(layer: SpatialLayer): layer is RouteLayer {
  return layer.type === 'route';
}
