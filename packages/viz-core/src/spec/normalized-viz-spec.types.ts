// GENERATED into @oods/viz-core by scripts/types/generate.ts (generate:schema-types),
// from schemas/viz/normalized-viz-spec.schema.json. #681 retarget (sprint-112 m04):
// this file IS the live source of truth — do NOT edit by hand. Change the schema and
// re-run `pnpm generate:schema-types`; CI runs it with --check to catch drift.

/**
 * Layout trait that augments the normalized spec with facet/layer/concat metadata.
 */
export type LayoutDefinition = LayoutFacet | LayoutLayer | LayoutConcat;
export type LayoutFacet = LayoutFacet1 & {
  trait: 'LayoutFacet';
  rows?: FacetField;
  columns?: FacetField;
  wrap?: 'row' | 'column' | 'auto';
  maxPanels?: number;
  gap?: number;
  sharedScales?: SharedScaleConfig;
  projection?: LayoutProjection;
};
export type LayoutFacet1 = {
  [k: string]: unknown;
};
/**
 * Sorting definition for layout fields.
 */
export type LayoutSort =
  | ('none' | 'ascending' | 'descending')
  | {
      field: string;
      order: 'ascending' | 'descending';
    };
export type ScaleBindingMode = 'shared' | 'independent';
/**
 * Selection primitive that produces a predicate for downstream rules.
 */
export type InteractionSelection = PointSelection | IntervalSelection;
/**
 * Production rule describing how the predicate manipulates the visualization.
 */
export type InteractionRule =
  | InteractionFilterRule
  | InteractionVisualRule
  | InteractionTooltipRule
  | InteractionZoomRule;

/**
 * Declarative visualization specification generated from trait composition.
 */
export interface NormalizedVizSpecV01 {
  $schema?: 'https://oods-foundry.com/viz-spec/v1';
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
  layout?: LayoutDefinition;
  /**
   * Declarative interaction traits applied to the visualization (e.g., highlight, tooltip).
   */
  interactions?: InteractionTrait[];
  config?: VizConfig;
  a11y: AccessibilitySpec;
  portability?: PortabilitySpec;
  /**
   * Named row-arrays that layered marks reference via Mark.from; resolved into Vega-Lite top-level datasets / ECharts dataset entries at adapt time.
   */
  datasets?: {
    [k: string]: {
      [k: string]: unknown;
    }[];
  };
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
  x2?: TraitBinding;
  y2?: TraitBinding;
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
  channel?: 'x' | 'y' | 'x2' | 'y2' | 'color' | 'size' | 'shape' | 'detail';
  aggregate?: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'distinct';
  bin?: boolean;
  timeUnit?: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
  scale?: 'linear' | 'temporal' | 'log' | 'sqrt' | 'band' | 'point' | 'diverging';
  /**
   * Vega-Lite field type. When set, short-circuits channel-default and scale-derived type inference in the adapters (explicit-mode data-aware typing, sprint-125 m01).
   */
  type?: 'quantitative' | 'temporal' | 'ordinal' | 'nominal';
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
  /**
   * Explicit hex colors for a nominal/ordinal color scale (sprint-147 F5). Overrides the baked OODS categorical palette so an agent can supply its own scale. Applied in array order; consumed only on the color channel by the cartesian adapter.
   */
  range?: string[];
  /**
   * Label format of this channel's axis (x, y) or legend (s223-m01): a d3-format specifier, or a d3-time-format one for a temporal field. "$" prints the currency symbol. A number specifier without a precision takes the precision of the tick step, so neighbouring ticks never print the same text.
   */
  format?: string;
  /**
   * ISO 4217 code of the amounts this channel encodes (s223-m01). The chart's number locale prints the code's en-US symbol where a format has "$" (EUR €, GBP £, USD $); without a format the labels read "$,f". A chart encodes at most one currency.
   */
  currency?: string;
}
/**
 * Declares how a facet dimension is derived.
 */
export interface FacetField {
  /**
   * Data field used for the facet dimension.
   */
  field: string;
  /**
   * Maximum facet count for this dimension.
   */
  limit?: number;
  sort?: LayoutSort;
  title?: string;
}
/**
 * Controls whether encoding channels remain synchronized across layout children.
 */
export interface SharedScaleConfig {
  x?: ScaleBindingMode;
  y?: ScaleBindingMode;
  color?: ScaleBindingMode;
  size?: ScaleBindingMode;
  shape?: ScaleBindingMode;
  detail?: ScaleBindingMode;
}
/**
 * Projection hints forwarded to adapters.
 */
export interface LayoutProjection {
  type?: 'cartesian' | 'polar' | 'radial';
  preserveAspectRatio?: boolean;
  /**
   * Rotation (degrees) applied to the projection center.
   */
  rotate?: number;
}
export interface LayoutLayer {
  trait: 'LayoutLayer';
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
  syncInteractions?: boolean;
  sharedScales?: SharedScaleConfig;
  /**
   * Explicit bottom→top paint order for layered marks. Each entry names a layer key: the mark's options.id when set (preferred — give repeated same-trait marks distinct ids so each layer is addressable), else the mark's trait name. Matched layers paint first in list order; marks not named keep declaration order and render after (on top of) the listed layers; entries matching no layer are ignored. Duplicates are rejected (uniqueItems) because keys address layers by identity — a repeated key can never address a distinct layer.
   *
   * @minItems 1
   */
  order?: [string, ...string[]];
  projection?: LayoutProjection;
}
export interface LayoutConcat {
  trait: 'LayoutConcat';
  direction?: 'horizontal' | 'vertical' | 'grid';
  gap?: number;
  /**
   * Dashboard sections that reference filtered variants of the normalized spec.
   *
   * @minItems 2
   */
  sections: [ConcatSection, ConcatSection, ...ConcatSection[]];
  sharedScales?: SharedScaleConfig;
  projection?: LayoutProjection;
}
export interface ConcatSection {
  /**
   * Stable identifier for the section.
   */
  id: string;
  title?: string;
  description?: string;
  filters?: SectionFilter[];
  sharedScales?: SharedScaleConfig;
  projection?: LayoutProjection;
}
export interface SectionFilter {
  field: string;
  operator: '==' | '!=' | 'in' | 'not_in' | '>' | '>=' | '<' | '<=';
  value: string | number | boolean | [string | number | boolean, ...(string | number | boolean)[]];
}
/**
 * Declarative interaction trait composed of a selection primitive and production rule.
 */
export interface InteractionTrait {
  /**
   * Unique identifier for referencing this interaction predicate.
   */
  id: string;
  select: InteractionSelection;
  rule: InteractionRule;
}
export interface PointSelection {
  type: 'point';
  /**
   * Event stream that triggers the selection (e.g., hover, click).
   */
  on: string;
  /**
   * Data fields that participate in the predicate.
   *
   * @minItems 1
   */
  fields: [string, ...string[]];
}
export interface IntervalSelection {
  type: 'interval';
  /**
   * Event stream that triggers the interval (e.g., drag).
   */
  on: string;
  /**
   * Encoding channels that define the brush interval.
   *
   * @minItems 1
   */
  encodings: ['x' | 'y', ...('x' | 'y')[]];
  /**
   * Binding target for the selection (e.g., 'scales' for zoom).
   */
  bind?:
    | 'scales'
    | {
        [k: string]: unknown;
      };
}
export interface InteractionFilterRule {
  bindTo: 'filter';
}
export interface InteractionVisualRule {
  bindTo: 'visual';
  /**
   * Visual property to conditionally modify (e.g., fillOpacity).
   */
  property: string;
  condition: InteractionValueConfig;
  else: InteractionValueConfig;
}
export interface InteractionValueConfig {
  /**
   * Value applied when the predicate condition is met or not met.
   */
  value: string | number | boolean;
}
export interface InteractionTooltipRule {
  bindTo: 'tooltip';
  /**
   * Ordered list of fields rendered inside the tooltip.
   *
   * @minItems 1
   */
  fields: [string, ...string[]];
}
export interface InteractionZoomRule {
  bindTo: 'zoom';
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
   * Where the chart's name is painted. chart (the default) paints it inside the SVG as the renderer's title; figure leaves the SVG without a painted title so the figure that places the chart shows the name as its heading. The accessible name is unaffected.
   */
  title?: {
    placement?: 'chart' | 'figure';
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
