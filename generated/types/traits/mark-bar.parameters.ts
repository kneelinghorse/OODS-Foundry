// Auto-generated from traits/mark-bar.parameters.schema.json. Do not edit manually.

export interface MarkBarTraitParameters {
  /**
   * Axis orientation used for laying out bar rectangles.
   */
  orientation: 'vertical' | 'horizontal';
  /**
   * Fractional padding between category bands (0-0.5).
   */
  bandPadding?: number;
  /**
   * Pixel radius applied to bar corners.
   */
  cornerRadius?: number;
  /**
   * Aggregation strategy when multiple series share the mark.
   */
  stacking?: 'auto' | 'normalize' | 'none';
}
