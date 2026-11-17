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
   * The time zone your product reads the record's times in. Screens show times in UTC, and a shown date-time says so, as a date-time input's label does.
   */
  timezone?: 'UTC' | 'LOCAL' | 'OFFSET';
  /**
   * When true, updated_at may be omitted until a mutation occurs.
   */
  allowNullUpdatedAt?: boolean;
}
