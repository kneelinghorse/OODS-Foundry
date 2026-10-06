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
  /**
   * Whether billing charges at period start (prepaid) or end (postpaid).
   */
  paymentTiming?: 'prepaid' | 'postpaid';
  /**
   * Whether mid-cycle plan changes generate prorated charges or credits.
   */
  supportProration?: boolean;
  /**
   * Default policy for billing mid-cycle changes (mirrors Stripe proration_behavior): create_prorations (default), always_invoice, or none. Drives charge timing; only meaningful when supportProration is true.
   */
  prorationBehavior?: 'create_prorations' | 'always_invoice' | 'none';
  /**
   * Day of the month for renewal anchoring. 0 means no anchoring.
   */
  cycleAnchorDay?: number;
}
