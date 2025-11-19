/**
 * Authz RBAC types generated from data/authz-schemas/registry.json v1.0.0.
 * Source of truth: R21.2 Part 4.2 canonical model.
 */

export interface AuthzRoleDocument {
  id: string;
  name: string;
  description?: string;
}

export interface AuthzPermissionDocument {
  id: string;
  name: string;
  description?: string;
  resource_type?: string;
}

/**
 * UNIQUE(user_id, organization_id, role_id) enforced in persistence layer
 */
export interface AuthzMembershipDocument {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Self-referential edges are rejected in runtime validator
 */
export interface AuthzRoleHierarchyEdge {
  parent_role_id: string;
  child_role_id: string;
  depth?: number;
}
