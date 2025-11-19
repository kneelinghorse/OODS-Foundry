// Auto-generated from traits/preferenceable.parameters.schema.json. Do not edit manually.

/**
 * Configures namespaces and registry bindings for the Preferenceable trait.
 */
export interface PreferenceableTraitParameters {
  /**
   * Allowed top-level namespaces for preference keys (theme, notifications, display, etc.).
   *
   * @minItems 1
   * @maxItems 12
   */
  namespaces:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string];
  /**
   * Current JSON Schema version served by the registry for validation and UI generation.
   */
  schemaVersion: string;
  /**
   * Escape hatch allowing writes outside the declared namespace allow list.
   */
  allowUnknownNamespaces?: boolean;
  /**
   * Registry identifier used to fetch JSON Schema and uiSchema bundles.
   */
  registryNamespace?: string;
}
