// Auto-generated from traits/colorized.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for Colorized trait semantics.
 */
export interface ColorizedTraitParameters {
  /**
   * Semantic color keys applied to statuses.
   *
   * @minItems 1
   * @maxItems 8
   */
  colorStates:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
}
