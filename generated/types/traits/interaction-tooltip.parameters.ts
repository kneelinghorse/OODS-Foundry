// Auto-generated from traits/interaction-tooltip.parameters.schema.json. Do not edit manually.

export interface InteractionTooltipTraitParameters {
  /**
   * Ordered field list rendered inside the tooltip.
   *
   * @minItems 1
   */
  fields: [string, ...string[]];
  /**
   * Event stream that reveals the tooltip.
   */
  trigger?: 'hover' | 'focus';
  /**
   * Preferred tooltip alignment around the data point.
   */
  alignment?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}
