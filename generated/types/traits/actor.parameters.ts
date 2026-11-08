// Auto-generated from traits/actor.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Actor trait: what every record of the object is when it acts.
 */
export interface ActorTraitParameters {
  /**
   * person (someone's own account), agent (software that acts, on its own behalf or for someone) or system (the product itself). An agent is marked "Agent" beside its name.
   */
  kind: 'person' | 'agent' | 'system';
}
