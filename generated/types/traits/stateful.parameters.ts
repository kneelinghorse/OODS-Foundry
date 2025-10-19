// Auto-generated from traits/stateful.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Stateful trait's status machine.
 */
export interface StatefulTraitParameters {
  /**
   * Ordered list of lifecycle states available to consumers.
   *
   * @minItems 1
   */
  states: [string, ...string[]];
  /**
   * State assigned when an entity is created.
   */
  initialState: string;
}
