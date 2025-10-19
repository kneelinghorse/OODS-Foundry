// Auto-generated from traits/billable.parameters.schema.json. Do not edit manually.

/**
 * Configures recurring billing defaults for composed objects.
 */
export interface BillableTraitParameters {
  /**
   * ISO 4217 currency code applied when no currency is provided by data.
   */
  defaultCurrency?: string;
  /**
   * Allowed billing interval identifiers (e.g., monthly, yearly).
   *
   * @minItems 1
   */
  billingIntervals?: [string, ...string[]];
  /**
   * Number of fractional units comprising a single currency unit (typically 100).
   */
  minorUnits?: number;
}
