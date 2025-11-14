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
   * Olson/IANA timezone identifier used when formatting ticks.
   */
  timezone?: string;
  /**
   * Interval used when rounding ticks.
   */
  nice?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * Default date format string for axes + fallbacks.
   */
  outputFormat?: string;
}
