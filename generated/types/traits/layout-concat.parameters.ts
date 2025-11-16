// Auto-generated from traits/layout-concat.parameters.schema.json. Do not edit manually.

export interface LayoutConcatTraitParameters {
  /**
   * Primary axis used to arrange concatenated sections.
   */
  direction?: 'horizontal' | 'vertical' | 'grid';
  /**
   * Gap (px) between concatenated sections.
   */
  gap?: number;
  /**
   * Channels propagated across concatenated children.
   */
  sharedChannels?: ('x' | 'y' | 'color' | 'size' | 'shape' | 'detail')[];
  /**
   * Maximum number of child sections governed by this layout.
   */
  maxSections?: number;
  /**
   * Projection hint consumed by adapters.
   */
  projection?: 'cartesian' | 'polar' | 'radial';
}
