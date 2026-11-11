// Auto-generated from traits/decision.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Decision trait: the levels of yes a record of one ask and its answer can be asked at.
 */
export interface DecisionTraitParameters {
  /**
   * The levels of yes the product declares, in order, each named for the kind of yes asked for. A record's level is one of them.
   *
   * @minItems 1
   */
  levels: [string, ...string[]];
}
