/**
 * Authz RBAC types generated from data/authz-schemas/registry.json v1.1.0.
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
 * UNIQUE(user_id or actor_id, organization_id, role_id) enforced in persistence layer; exactly one of user_id or actor_id names the member
 */
export type AuthzMembershipDocument = {
  id: string;
  user_id?: string;
  /**
   * The member when it is not a user: any object that composes the Actor trait, such as an Agent.
   */
  actor_id?: string;
  /**
   * What kind of actor actor_id names, as the Actor trait names them.
   */
  actor_kind?: 'person' | 'agent' | 'system';
  organization_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
} & (
  | {
      user_id: string;
      actor_id?: never;
      actor_kind?: never;
    }
  | {
      actor_id: string;
      actor_kind: 'person' | 'agent' | 'system';
      user_id?: never;
    }
);

/**
 * Self-referential edges are rejected in runtime validator
 */
export interface AuthzRoleHierarchyEdge {
  parent_role_id: string;
  child_role_id: string;
  depth?: number;
}
