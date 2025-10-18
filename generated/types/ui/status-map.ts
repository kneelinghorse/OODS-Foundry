// Auto-generated from ui/status-map.schema.json. Do not edit manually.

/**
 * Defines how UI contexts consume canonical enum→token mappings.
 */
export interface UIStatusMapConfiguration {
  /**
   * Optional reference to the schema used to validate this configuration.
   */
  $schema?: string;
  /**
   * Semantic version for the configuration document.
   */
  version: string;
  /**
   * ISO-8601 timestamp recording when the mapping was produced.
   */
  generated_at: string;
  /**
   * Human-readable context for the current mapping version.
   */
  notes?: string;
  /**
   * Status domains that are backed by canonical token manifests.
   */
  domains: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z0-9_\-]+$".
     */
    [k: string]: {
      /**
       * Relative path to the token manifest providing status token payloads.
       */
      source: string;
      /**
       * JSON Pointer into the source manifest for this domain.
       */
      path: string;
      /**
       * Ordered canonical statuses served by the mapping.
       *
       * @minItems 1
       */
      statuses: [string, ...string[]];
    };
  };
  /**
   * UI contexts and the domains they render via the mapping.
   */
  contexts: {
    /**
     * @minItems 1
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z0-9_\-]+$".
     */
    [k: string]: [string, ...string[]];
  };
}
