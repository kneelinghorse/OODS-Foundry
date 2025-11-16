// Auto-generated from traits/layout-layer.parameters.schema.json. Do not edit manually.

export interface LayoutLayerTraitParameters {
  /**
   * Blend/composite mode applied across stacked marks.
   */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
  /**
   * Whether interaction predicates propagate across layers.
   */
  syncInteractions?: boolean;
  /**
   * Channels that remain synchronized across layers.
   */
  sharedChannels?: ('x' | 'y' | 'color' | 'size' | 'shape' | 'detail')[];
  /**
   * Optional explicit bottom→top ordering for marks.
   */
  orderHint?: string[];
  /**
   * Projection hint for adapters.
   */
  projection?: 'cartesian' | 'polar' | 'radial';
}
