// Auto-generated from traits/statusable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Statusable visual presentation trait.
 */
export interface StatusableTraitParameters {
  /**
   * Domain identifiers whose statuses this object participates in.
   *
   * @minItems 1
   */
  domains: [string, ...string[]];
  /**
   * Custom alias map for inferring tones from token path segments.
   */
  toneAliases?: {
    [k: string]: 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';
  } | null;
  /**
   * Fallback tone when a status cannot be resolved in the registry.
   */
  defaultTone?: 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';
}
