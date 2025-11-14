// Auto-generated from traits/mark-point.parameters.schema.json. Do not edit manually.

export interface MarkPointTraitParameters {
  /**
   * Glyph shape rendered for each data point.
   */
  shape?: 'circle' | 'square' | 'diamond' | 'triangle';
  /**
   * Default glyph area in square pixels.
   */
  size?: number;
  /**
   * Fill strategy for glyph interior.
   */
  fill?: 'solid' | 'hollow';
  /**
   * Outline stroke width for hollow glyphs.
   */
  strokeWidth?: number;
  /**
   * Default opacity applied to each point for overplotting.
   */
  opacity?: number;
}
