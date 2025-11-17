// Auto-generated from traits/addressable.parameters.schema.json. Do not edit manually.

/**
 * Configures the multi-role Addressable trait.
 */
export type AddressableTraitParameters = AddressableTraitParameters1 & AddressableTraitParameters2;
export type AddressableTraitParameters1 = {
  [k: string]: unknown;
};

export interface AddressableTraitParameters2 {
  /**
   * Ordered list of supported address roles.
   *
   * @minItems 1
   * @maxItems 16
   */
  roles:
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
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
  /**
   * Role returned when consumers omit a role argument.
   */
  defaultRole?: string;
  /**
   * Allow runtime addition of roles that are not predeclared.
   */
  allowDynamicRoles?: boolean;
}
