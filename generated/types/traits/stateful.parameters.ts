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
   * Allowed state transition map. Keys are source states; values are arrays of permitted target states, and an empty array marks a final state. Null means open model (all transitions allowed).
   */
  transitionRules?: {
    /**
     * @minItems 0
     */
    [k: string]: string[];
  } | null;
  /**
   * Named moves a person makes on a record, each to one state of the declared order: a generated screen offers each only from the states it moves from, and a generated app writes it as one change. Each needs transitionRules.
   */
  actions?:
    | {
        /**
         * The action's id, unique on the object ("revoke").
         */
        id: string;
        /**
         * The state the action moves the record to.
         */
        to: string;
        /**
         * The states it is offered from; by default every state whose declared targets include `to`.
         *
         * @minItems 1
         */
        from?: [string, ...string[]];
        /**
         * The verb a person reads on its button ("Revoke").
         */
        verb: string;
        /**
         * The event Timestampable records for it, one of its recordedEvents.
         */
        event: string;
        /**
         * The field its optional note is written to.
         */
        reasonField?: string;
        /**
         * The seat whose _id, _name and _kind fields name who acted, when the app is told.
         */
        bySeat?: string;
        /**
         * When true, the action asks once, stating what it ends and what goes on, before it is written.
         */
        confirm?: boolean;
        /**
         * Records of the same object whose `via` names this one make the same move with it, each with its own line.
         */
        alsoEnds?: {
          via: string;
        };
      }[]
    | null;
  /**
   * When true, your product requires a reason for each change of state. Your product checks the reason.
   */
  requireTransitionReason?: boolean;
}
