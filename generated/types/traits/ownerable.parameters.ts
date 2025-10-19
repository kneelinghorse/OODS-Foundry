// Auto-generated from traits/ownerable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for ownership governance metadata.
 */
export interface OwnerableTraitParameters {
  /**
   * Principal types permitted to own the entity.
   *
   * @minItems 1
   */
  ownerTypes: [string, ...string[]];
  /**
   * Default owner type applied to new records.
   */
  primaryOwnerType?: string;
  /**
   * Indicates whether ownership reassignment is permitted after creation.
   */
  allowTransfer?: boolean;
}
