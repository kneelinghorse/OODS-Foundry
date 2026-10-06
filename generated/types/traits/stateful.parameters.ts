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
  /**
   * Allowed state transition map. Keys are source states; values are arrays of permitted target states. Null means open model (all transitions allowed).
   */
  transitionRules?: {
    /**
     * @minItems 1
     */
    [k: string]: [string, ...string[]];
  } | null;
  /**
   * When true, every state transition must include a human-readable reason.
   */
  requireTransitionReason?: boolean;
}
