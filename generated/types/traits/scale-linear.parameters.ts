// Auto-generated from traits/scale-linear.parameters.schema.json. Do not edit manually.

export interface ScaleLinearTraitParameters {
  /**
   * Default lower domain bound applied when unspecified.
   */
  domainMin: number;
  /**
   * Default upper domain bound applied when unspecified.
   */
  domainMax: number;
  /**
   * Default lower range bound (normalized 0-1).
   */
  rangeMin: number;
  /**
   * Default upper range bound (normalized 0-1).
   */
  rangeMax: number;
  /**
   * Whether values outside the domain should clamp to edges.
   */
  clamp?: boolean;
  /**
   * Forces zero to be included in the domain.
   */
  zeroBaseline?: boolean;
  /**
   * Distinguishes continuous vs band heuristics.
   */
  mode?: 'continuous' | 'band';
}
