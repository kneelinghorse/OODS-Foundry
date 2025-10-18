// Auto-generated from traits/timestampable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Timestampable trait's audit timeline settings.
 */
export interface TimestampableTraitParameters {
  /**
   * Canonical lifecycle events captured when tracking timestamp provenance.
   *
   * @minItems 1
   */
  recordedEvents: [string, ...string[]];
  /**
   * Default timezone context applied when presenting timestamps.
   */
  timezone?: 'UTC' | 'LOCAL' | 'OFFSET';
  /**
   * When true, updated_at may be omitted until a mutation occurs.
   */
  allowNullUpdatedAt?: boolean;
}
