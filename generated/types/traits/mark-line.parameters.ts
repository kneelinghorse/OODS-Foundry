// Auto-generated from traits/mark-line.parameters.schema.json. Do not edit manually.

export interface MarkLineTraitParameters {
  /**
   * Curve interpolation strategy applied between data points.
   */
  curve?: 'linear' | 'monotone' | 'step';
  /**
   * Stroke width in device-independent pixels.
   */
  strokeWidth?: number;
  /**
   * Join style applied when segments meet.
   */
  join?: 'miter' | 'round' | 'bevel';
  /**
   * Adds optional point markers on line vertices.
   */
  enableMarkers?: boolean;
}
