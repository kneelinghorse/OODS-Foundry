// Auto-generated from traits/scale-temporal.parameters.schema.json. Do not edit manually.

export interface ScaleTemporalTraitParameters {
  /**
   * ISO-8601 timestamp representing the lower bound.
   */
  domainStart: string;
  /**
   * ISO-8601 timestamp representing the upper bound.
   */
  domainEnd: string;
  /**
   * Normalized lower range bound (0-1).
   */
  rangeMin: number;
  /**
   * Normalized upper range bound (0-1).
   */
  rangeMax: number;
  /**
   * Interval used when rounding ticks.
   */
  nice?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * Default date format string for axes + fallbacks.
   */
  outputFormat?: string;
  /**
   * JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand.
   */
  renderIntent?: string;
}
