// Auto-generated from traits/supersedable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Supersedable trait: which supersession states a store can write, and which direction it records the lineage pointer in.
 */
export interface SupersedableTraitParameters {
  /**
   * The supersession states the source of truth can actually write.
   *
   * @minItems 2
   */
  states: [string, string, ...string[]];
  /**
   * The state a newly recorded entry holds before anything replaces it. Must be a member of states.
   */
  initialState: string;
  /**
   * Which pointer the source of truth writes: forward stores superseded_by on the replaced record, backward stores supersedes on the replacing record, both stores each.
   */
  recordedDirection: 'forward' | 'backward' | 'both';
  /**
   * Visible wording for a record that has been replaced, so the state never rests on colour alone.
   */
  supersededLabel?: string;
}
