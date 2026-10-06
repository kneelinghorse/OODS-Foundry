// Auto-generated from traits/encoding-size.parameters.schema.json. Do not edit manually.

export interface EncodingSizeTraitParameters {
  /**
   * Minimum rendered size in device-independent pixels.
   */
  rangeMin: number;
  /**
   * Maximum rendered size in device-independent pixels.
   */
  rangeMax: number;
  /**
   * Interprets values as area or radius for perceptual scaling.
   */
  strategy: 'area' | 'radius';
  /**
   * Minimum accessible area to avoid disappearing glyphs.
   */
  minPixelArea?: number;
  /**
   * Maximum accessible area to avoid dominating layout.
   */
  maxPixelArea?: number;
  /**
   * JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand.
   */
  renderIntent?: string;
}
