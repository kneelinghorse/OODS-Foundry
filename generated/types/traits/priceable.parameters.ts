// Auto-generated from traits/priceable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for pricing, currency, and billing cadence metadata.
 */
export interface PriceableTraitParameters {
  /**
   * ISO 4217 currency codes supported for pricing.
   *
   * @minItems 1
   */
  supportedCurrencies: [string, ...string[]];
  /**
   * Currency preselected when authoring pricing information.
   */
  defaultCurrency?: string;
  /**
   * Supported monetization strategies applied to the entity.
   *
   * @minItems 1
   */
  pricingModels: [string, ...string[]];
  /**
   * Allowed billing cadences when the pricing model recurs.
   */
  billingIntervals?: string[];
  /**
   * Determines whether prices are tax inclusive or exclusive.
   */
  taxBehavior?: 'exclusive' | 'inclusive';
}
