// Auto-generated from viz/normalized-viz-spec.schema.json. Do not edit manually.

/**
 * Declarative visualization specification generated from trait composition.
 */
export interface NormalizedVizSpecV01 {
  $schema?: 'https://oods.dev/viz-spec/v1';
  /**
   * Stable identifier for the spec instance.
   */
  id?: string;
  /**
   * Human friendly label surfaced in UI + narration.
   */
  name?: string;
  data: DataSource;
  /**
   * Declarative data transforms applied prior to rendering.
   */
  transforms?: Transform[];
  /**
   * List of mark definitions (layers).
   *
   * @minItems 1
   */
  marks: [Mark, ...Mark[]];
  encoding: EncodingMap;
  config?: VizConfig;
  a11y: AccessibilitySpec;
  portability?: PortabilitySpec;
}
/**
 * Inline values or reference to an external dataset.
 */
export interface DataSource {
  values?: {
    [k: string]: unknown;
  }[];
  url?: string;
  format?: 'json' | 'csv' | 'tsv' | 'topojson' | 'auto';
  name?: string;
}
export interface Transform {
  type: 'aggregate' | 'calculate' | 'filter' | 'sort' | 'window' | 'stack' | 'bin';
  params?: {
    [k: string]: unknown;
  };
}
export interface Mark {
  /**
   * ID of Mark trait (e.g., MarkBar).
   */
  trait: string;
  /**
   * Optional dataset reference for layered specs.
   */
  from?: string;
  encodings?: EncodingMap;
  /**
   * Trait-specific configuration applied post-normalization.
   */
  options?: {
    [k: string]: unknown;
  };
}
/**
 * Mapping of encoding channels to trait bindings.
 */
export interface EncodingMap {
  x?: TraitBinding;
  y?: TraitBinding;
  color?: TraitBinding;
  size?: TraitBinding;
  shape?: TraitBinding;
  detail?: TraitBinding;
}
/**
 * Links a data field to a trait-backed encoding channel.
 */
export interface TraitBinding {
  /**
   * Field name in the data source.
   */
  field: string;
  /**
   * Trait ID (e.g., EncodingColor).
   */
  trait: string;
  channel?: 'x' | 'y' | 'color' | 'size' | 'shape' | 'detail';
  aggregate?: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'distinct';
  bin?: boolean;
  timeUnit?: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
  scale?: 'linear' | 'temporal' | 'log' | 'sqrt' | 'band' | 'point';
  sort?:
    | ('none' | 'ascending' | 'descending')
    | {
        field: string;
        order: 'ascending' | 'descending';
      };
  title?: string;
  legend?: {
    [k: string]: unknown;
  };
}
export interface VizConfig {
  /**
   * Theme identifier.
   */
  theme?: string;
  /**
   * Token overrides scoped to this spec.
   */
  tokens?: {
    [k: string]: string | number;
  };
  layout?: {
    width?: number;
    height?: number;
    padding?: number;
  };
  /**
   * Mark-level defaults applied before traits.
   */
  mark?: {};
}
/**
 * Accessibility contract mandated by RDV.4.
 */
export interface AccessibilitySpec {
  /**
   * Long-form description surfaced via screen readers.
   */
  description: string;
  /**
   * Short ARIA label applied to chart container.
   */
  ariaLabel?: string;
  narrative?: {
    summary?: string;
    keyFindings?: string[];
  };
  tableFallback?: {
    enabled?: boolean;
    caption?: string;
  };
}
/**
 * Portability hints for low-fi translations (dv-5).
 */
export interface PortabilitySpec {
  fallbackType?: 'table' | 'text';
  tableColumnOrder?: string[];
  preferredRenderer?: 'vega-lite' | 'echarts' | 'native';
}
