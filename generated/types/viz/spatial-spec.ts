// Auto-generated from viz/spatial-spec.schema.json. Do not edit manually.

/**
 * Spatial extensions for normalized-viz-spec to support geographic visualizations.
 */
export type SpatialVizSpecExtensionV01 = SpatialSpec;
/**
 * Layer definition for spatial visualizations.
 */
export type SpatialLayer = RegionFillLayer | SymbolLayer | RouteLayer;

/**
 * Complete spatial visualization specification extending normalized-viz-spec.
 */
export interface SpatialSpec {
  $schema?: 'https://oods.dev/viz-spec/spatial/v1';
  /**
   * Stable identifier for the spec instance.
   */
  id?: string;
  /**
   * Human friendly label surfaced in UI + narration.
   */
  name?: string;
  type: 'spatial';
  data:
    | GeoJoinDataSource
    | {
        values?: unknown[];
        url?: string;
        format?: 'json' | 'csv' | 'topojson' | 'geojson';
        /**
         * Geo field definitions for inline data sources.
         */
        fields?: {
          geometry?: GeoJsonField;
          topology?: TopoJsonField;
          point?: GeoPointField;
        };
      };
  projection: ProjectionConfig;
  geo?: GeoSourceConfig;
  /**
   * Ordered list of spatial layers to render.
   *
   * @minItems 1
   */
  layers: [SpatialLayer, ...SpatialLayer[]];
  config?: {
    theme?: string;
    tokens?: {
      [k: string]: string | number;
    };
    layout?: {
      width?: number;
      height?: number;
      padding?: number;
    };
  };
  /**
   * Accessibility contract for spatial visualizations.
   */
  a11y: {
    /**
     * Long-form description surfaced via screen readers.
     */
    description: string;
    /**
     * Short ARIA label applied to map container.
     */
    ariaLabel?: string;
    narrative?: {
      summary?: string;
      keyFindings?: string[];
    };
    tableFallback?: {
      enabled?: boolean;
      caption?: string;
      columns?: string[];
      sortDefault?: string;
      sortOrder?: 'asc' | 'desc';
    };
  };
  interactions?: {
    type: 'panZoom' | 'regionSelect' | 'tooltip' | 'layerToggle';
    enabled?: boolean;
    config?: {};
  }[];
}
/**
 * Dataset-level type for geo+data joins.
 */
export interface GeoJoinDataSource {
  type: 'data.geo.join';
  /**
   * URL or reference to the data source.
   */
  source: string;
  /**
   * URL or reference to the GeoJSON/TopoJSON geography.
   */
  geoSource: string;
  /**
   * Field in data source used for joining.
   */
  joinKey: string;
  /**
   * Property path in geo features for joining (e.g., 'properties.FIPS').
   */
  geoKey: string;
  format?: 'geojson' | 'topojson';
}
/**
 * Field type for inline GeoJSON geometry.
 */
export interface GeoJsonField {
  type: 'field.geojson';
  geometry: GeoJsonGeometry;
}
/**
 * GeoJSON geometry object.
 */
export interface GeoJsonGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
  /**
   * GeoJSON coordinates array.
   */
  coordinates: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
/**
 * Field type for reference to TopoJSON topology.
 */
export interface TopoJsonField {
  type: 'field.topojson';
  /**
   * Object name within the TopoJSON file (e.g., 'objects.states').
   */
  topology: string;
  /**
   * Feature type within the topology.
   */
  feature?: string;
}
/**
 * Field type for lat/lon coordinate pairs.
 */
export interface GeoPointField {
  type: 'field.geopoint';
  value?:
    | [number, number]
    | {
        lat: number;
        lon: number;
      };
}
/**
 * Geographic projection configuration following d3-geo patterns.
 */
export interface ProjectionConfig {
  /**
   * Projection type from d3-geo projection library.
   */
  type?:
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
   * Projection center as [longitude, latitude].
   *
   * @minItems 2
   * @maxItems 2
   */
  center?: [number, number];
  /**
   * Projection scale factor.
   */
  scale?: number;
  /**
   * Rotation as [lambda, phi] or [lambda, phi, gamma] in degrees.
   *
   * @minItems 2
   * @maxItems 3
   */
  rotate?: [number, number] | [number, number, number];
  /**
   * Standard parallels for conic projections.
   *
   * @minItems 2
   * @maxItems 2
   */
  parallels?: [number, number];
  /**
   * Clip angle for azimuthal projections.
   */
  clipAngle?: number;
  /**
   * Clip extent as [[x0, y0], [x1, y1]].
   *
   * @minItems 2
   * @maxItems 2
   */
  clipExtent?: [[number, number], [number, number]];
  /**
   * Projection precision for adaptive sampling.
   */
  precision?: number;
  /**
   * Automatically fit projection to data bounds.
   */
  fitToData?: boolean;
}
/**
 * Geographic data source configuration.
 */
export interface GeoSourceConfig {
  source: string | {};
  format?: 'geojson' | 'topojson';
  /**
   * For TopoJSON: object name within the topology (e.g., 'states').
   */
  topology?: string;
  /**
   * Feature type to extract from the source.
   */
  feature?: string;
  /**
   * For TopoJSON: extract mesh (boundaries only) instead of features.
   */
  meshOnly?: boolean;
}
/**
 * Choropleth/region fill layer type.
 */
export interface RegionFillLayer {
  type: 'regionFill';
  /**
   * Reference to geo source for this layer.
   */
  from?: string;
  encoding: {
    color: {
      field: string;
      scale?: 'quantize' | 'quantile' | 'threshold' | 'linear' | 'ordinal';
      domain?: number[];
      /**
       * Color token references.
       */
      range?: string[];
      /**
       * Color for null/missing values.
       */
      nullValue?: string;
    };
    opacity?: {
      field?: string;
      value?: number;
    };
    stroke?: {
      value?: string;
    };
    strokeWidth?: {
      value?: number;
    };
  };
  zIndex?: number;
}
/**
 * Symbol/bubble map layer type.
 */
export interface SymbolLayer {
  type: 'symbol';
  encoding: {
    longitude: {
      field: string;
    };
    latitude: {
      field: string;
    };
    size?: {
      field?: string;
      value?: number;
      scale?: 'linear' | 'sqrt' | 'log';
      /**
       * Size range as [min, max] in pixels.
       *
       * @minItems 2
       * @maxItems 2
       */
      range?: [number, number];
    };
    color?: {
      field?: string;
      value?: string;
      scale?: 'ordinal' | 'linear' | 'quantize';
    };
    shape?: {
      field?: string;
      value?: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';
    };
    opacity?: {
      field?: string;
      value?: number;
    };
  };
  zIndex?: number;
}
/**
 * Route/flow line layer type.
 */
export interface RouteLayer {
  type: 'route';
  encoding: {
    start: {
      field: string;
      longitude?: string;
      latitude?: string;
    };
    end: {
      field: string;
      longitude?: string;
      latitude?: string;
    };
    strokeWidth?: {
      field?: string;
      value?: number;
      scale?: 'linear' | 'sqrt' | 'log';
      /**
       * @minItems 2
       * @maxItems 2
       */
      range?: [number, number];
    };
    color?: {
      field?: string;
      value?: string;
    };
    opacity?: {
      value?: number;
    };
    /**
     * Arc curvature for route lines (0 = straight, 1 = max arc).
     */
    curvature?: {
      value?: number;
    };
  };
  zIndex?: number;
}
