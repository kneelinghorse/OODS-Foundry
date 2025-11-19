// Auto-generated from traits/authable.parameters.schema.json. Do not edit manually.

/**
 * Configures default roles and hierarchy traversal guardrails for the Authable RBAC trait (R21.2 Part 2.2 & 3.1).
 */
export interface AuthableTraitParameters {
  /**
   * Role identifier applied when inviting members without an explicit role (R21.2 §2.3).
   */
  defaultRoleId?: string;
  /**
   * Maximum recursion depth when walking role hierarchies to bubble permissions (Part 3.1).
   */
  hierarchyDepthLimit?: number;
}
