/**
 * Spatial Visualization Types
 *
 * TypeScript interfaces for spatial/geographic visualizations.
 * Generated from: schemas/viz/spatial-spec.schema.json
 */

// =============================================================================
// Field Types
// =============================================================================

/**
 * Geographic point coordinate field.
 */
export interface GeoPointField {
  type: 'field.geopoint';
  value?: [number, number] | { lat: number; lon: number };
}

/**
 * Inline GeoJSON geometry field.
 */
export interface GeoJsonField {
  type: 'field.geojson';
  geometry: GeoJsonGeometry;
}

/**
 * GeoJSON geometry object.
 */
export interface GeoJsonGeometry {
  type:
    | 'Point'
    | 'LineString'
    | 'Polygon'
    | 'MultiPoint'
    | 'MultiLineString'
    | 'MultiPolygon'
    | 'GeometryCollection';
  coordinates: unknown;
}

/**
 * Reference to TopoJSON topology field.
 */
export interface TopoJsonField {
  type: 'field.topojson';
  topology: string;
  feature?: string;
}

/**
 * Geo-enabled field definitions.
 */
export type GeoField = GeoPointField | GeoJsonField | TopoJsonField;

// =============================================================================
// Data Source Types
// =============================================================================

/**
 * Dataset-level type for geo+data joins.
 */
export interface GeoJoinData {
  type: 'data.geo.join';
  source: string;
  geoSource: string;
  joinKey: string;
  geoKey: string;
  format?: 'geojson' | 'topojson';
}

/**
 * Standard data source with optional geo fields.
 */
export interface SpatialDataSource {
  values?: Record<string, unknown>[];
  url?: string;
  format?: 'json' | 'csv' | 'topojson' | 'geojson';
  fields?: {
    geometry?: GeoJsonField;
    topology?: TopoJsonField;
    point?: GeoPointField;
  };
}

// =============================================================================
// Projection Config
// =============================================================================

/**
 * Supported projection types from d3-geo.
 */
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

/**
 * Geographic projection configuration following d3-geo patterns.
 */
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
// Geo Source Config
// =============================================================================

/**
 * Geographic data source configuration.
 */
export interface GeoSourceConfig {
  source: string | object;
  format?: 'geojson' | 'topojson';
  topology?: string;
  feature?: string;
  meshOnly?: boolean;
}

// =============================================================================
// Layer Types
// =============================================================================

/**
 * Color scale types for choropleth encoding.
 */
export type ColorScaleType = 'quantize' | 'quantile' | 'threshold' | 'linear' | 'ordinal';

/**
 * Size scale types for symbol encoding.
 */
export type SizeScaleType = 'linear' | 'sqrt' | 'log';

/**
 * Symbol shape types.
 */
export type SymbolShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';

/**
 * Color encoding for layers.
 */
export interface ColorEncoding {
  field?: string;
  value?: string;
  scale?: ColorScaleType;
  domain?: number[];
  range?: string[];
  nullValue?: string;
}

/**
 * Size encoding for symbol layers.
 */
export interface SizeEncoding {
  field?: string;
  value?: number;
  scale?: SizeScaleType;
  range?: [number, number];
}

/**
 * Opacity encoding for layers.
 */
export interface OpacityEncoding {
  field?: string;
  value?: number;
}

/**
 * Stroke encoding for layers.
 */
export interface StrokeEncoding {
  value?: string;
}

/**
 * Stroke width encoding for layers.
 */
export interface StrokeWidthEncoding {
  field?: string;
  value?: number;
  scale?: SizeScaleType;
  range?: [number, number];
}

/**
 * Choropleth/region fill layer type.
 */
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

/**
 * Position encoding for symbol layer.
 */
export interface PositionEncoding {
  field: string;
}

/**
 * Shape encoding for symbol layer.
 */
export interface ShapeEncoding {
  field?: string;
  value?: SymbolShape;
}

/**
 * Symbol/bubble map layer type.
 */
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
 * Route endpoint encoding.
 */
export interface RouteEndpointEncoding {
  field: string;
  longitude?: string;
  latitude?: string;
}

/**
 * Curvature encoding for route layer.
 */
export interface CurvatureEncoding {
  value?: number;
}

/**
 * Route/flow line layer type.
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
 * Union type for all spatial layer types.
 */
export type SpatialLayer = RegionFillLayer | SymbolLayer | RouteLayer;

// =============================================================================
// Accessibility
// =============================================================================

/**
 * Table fallback configuration for accessibility.
 */
export interface TableFallbackConfig {
  enabled?: boolean;
  caption?: string;
  columns?: string[];
  sortDefault?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Narrative configuration for accessibility.
 */
export interface NarrativeConfig {
  summary?: string;
  keyFindings?: string[];
}

/**
 * Accessibility specification for spatial visualizations.
 */
export interface SpatialA11yConfig {
  description: string;
  ariaLabel?: string;
  narrative?: NarrativeConfig;
  tableFallback?: TableFallbackConfig;
}

// =============================================================================
// Interactions
// =============================================================================

/**
 * Interaction types for spatial visualizations.
 */
export type SpatialInteractionType = 'panZoom' | 'regionSelect' | 'tooltip' | 'layerToggle';

/**
 * Interaction configuration.
 */
export interface SpatialInteraction {
  type: SpatialInteractionType;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

// =============================================================================
// Main Spec
// =============================================================================

/**
 * Layout configuration for spatial spec.
 */
export interface SpatialLayoutConfig {
  width?: number;
  height?: number;
  padding?: number;
}

/**
 * Visualization configuration for spatial spec.
 */
export interface SpatialVizConfig {
  theme?: string;
  tokens?: Record<string, string | number>;
  layout?: SpatialLayoutConfig;
}

/**
 * Complete spatial visualization specification.
 * Extends the normalized-viz-spec pattern for geographic visualizations.
 */
export interface SpatialSpec {
  $schema?: 'https://oods.dev/viz-spec/spatial/v1';
  id?: string;
  name?: string;
  type: 'spatial';
  data: GeoJoinData | SpatialDataSource;
  projection: ProjectionConfig;
  geo?: GeoSourceConfig;
  layers: SpatialLayer[];
  config?: SpatialVizConfig;
  a11y: SpatialA11yConfig;
  interactions?: SpatialInteraction[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for GeoJoinData.
 */
export function isGeoJoinData(data: GeoJoinData | SpatialDataSource): data is GeoJoinData {
  return 'type' in data && data.type === 'data.geo.join';
}

/**
 * Type guard for RegionFillLayer.
 */
export function isRegionFillLayer(layer: SpatialLayer): layer is RegionFillLayer {
  return layer.type === 'regionFill';
}

/**
 * Type guard for SymbolLayer.
 */
export function isSymbolLayer(layer: SpatialLayer): layer is SymbolLayer {
  return layer.type === 'symbol';
}

/**
 * Type guard for RouteLayer.
 */
export function isRouteLayer(layer: SpatialLayer): layer is RouteLayer {
  return layer.type === 'route';
}
