// Auto-generated from traits/labelled.parameters.schema.json. Do not edit manually.

/**
 * Configures label, description, and copy variant constraints for authored objects.
 */
export interface LabelledTraitParameters {
  /**
   * Maximum character length for the label field.
   */
  maxLabelLength?: number;
  /**
   * Maximum character length for the description field.
   */
  maxDescriptionLength?: number;
  /**
   * When true, description becomes a required field.
   */
  requireDescription?: boolean;
  /**
   * Named copy variants for context-sensitive rendering.
   *
   * @minItems 1
   */
  copyVariants?: [string, ...string[]];
}
