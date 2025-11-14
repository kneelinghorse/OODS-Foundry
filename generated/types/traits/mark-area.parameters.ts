// Auto-generated from traits/mark-area.parameters.schema.json. Do not edit manually.

export interface MarkAreaTraitParameters {
  /**
   * Curve interpolation strategy applied between samples.
   */
  curve?: 'linear' | 'monotone' | 'step';
  /**
   * Fill opacity used for the area band.
   */
  opacity?: number;
  /**
   * Baseline reference for filling the region.
   */
  baseline?: 'zero' | 'min';
  /**
   * Curve tension applied when smoothing.
   */
  tension?: number;
}
