// Auto-generated from traits/interaction-highlight.parameters.schema.json. Do not edit manually.

export interface InteractionHighlightTraitParameters {
  /**
   * Data fields that define the highlight predicate.
   *
   * @minItems 1
   */
  fields: [string, ...string[]];
  /**
   * Event stream that activates the highlight.
   */
  trigger?: 'hover' | 'click' | 'focus';
  /**
   * Visual property to adjust when the predicate is active.
   */
  property?: string;
  /**
   * Value applied to highlighted marks.
   */
  activeValue?: number;
  /**
   * Value applied to non-highlighted marks.
   */
  inactiveValue?: number;
}
