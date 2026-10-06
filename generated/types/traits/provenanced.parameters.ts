// Auto-generated from traits/provenanced.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Provenanced trait: the producing system every record of the object comes from, and the wording shown beside the method.
 */
export interface ProvenancedTraitParameters {
  /**
   * The producing system, shown as recorded (e.g. Stage1).
   */
  source: string;
  /**
   * Visible wording beside the method, so the screen says how rather than showing a bare token.
   */
  methodLabel?: string;
}
