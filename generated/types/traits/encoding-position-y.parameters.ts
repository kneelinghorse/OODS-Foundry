// Auto-generated from traits/encoding-position-y.parameters.schema.json. Do not edit manually.

export interface EncodingPositionYTraitParameters {
  /**
   * Data categories that can map to the Y axis.
   *
   * @minItems 1
   */
  fieldKinds: ['quantitative' | 'temporal' | 'ordinal', ...('quantitative' | 'temporal' | 'ordinal')[]];
  /**
   * Default scale used when not specified explicitly.
   */
  defaultScale: 'linear' | 'temporal';
  /**
   * Whether to enforce zero baseline for quantitative data.
   */
  includeZero?: boolean;
  /**
   * Default title surfaced in UI and fallback descriptions.
   */
  axisTitle?: string;
  /**
   * Default aggregation applied when spec omits one.
   */
  aggregate?: 'sum' | 'mean' | 'median' | 'count';
}
