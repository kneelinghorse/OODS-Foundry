/**
 * RBAC Domain Model
 * 
 * Canonical five-table RBAC schema with optional role hierarchy
 * and separation-of-duty constraints.
 * 
 * @module domain/compliance/rbac
 */

/**
 * Role definition with hierarchical support
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  /** Optional parent role for inheritance */
  parentRoleId?: string;
}

/**
 * Permission definition
 */
export interface Permission {
  id: string;
  /** Resource type (e.g., "subscription", "overlay", "token") */
  resource: string;
  /** Action (e.g., "read", "write", "approve", "delete") */
  action: string;
  /** Optional constraint JSON (e.g., {"owner": true, "status": ["active"]}) */
  constraints?: Record<string, unknown>;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User-to-role assignment
 */
export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  /** Optional tenant/organization scope */
  tenantId?: string;
  grantedAt: Date;
  grantedBy: string;
  /** Optional expiration */
  expiresAt?: Date;
}

/**
 * Role-to-permission mapping
 */
export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: Date;
}

/**
 * Role hierarchy for inheritance
 * Used to traverse parent → child chains
 */
export interface RoleHierarchy {
  parentRoleId: string;
  childRoleId: string;
  /** Depth in hierarchy tree (0 = direct parent) */
  depth: number;
}

/**
 * Separation-of-duty constraint
 * Prevents a single user from holding conflicting roles
 */
export interface SeparationOfDutyConstraint {
  id: string;
  name: string;
  /** Role IDs that are mutually exclusive */
  conflictingRoleIds: string[];
  description: string;
  createdAt: Date;
}

/**
 * Seed baseline roles for system initialization
 */
export const BASELINE_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'viewer',
    description: 'Read-only access to resources',
    metadata: { system: true, level: 1 },
  },
  {
    name: 'contributor',
    description: 'Create and edit resources',
    metadata: { system: true, level: 2 },
    parentRoleId: 'viewer',
  },
  {
    name: 'approver',
    description: 'Review and approve changes',
    metadata: { system: true, level: 3 },
    parentRoleId: 'contributor',
  },
  {
    name: 'compliance-admin',
    description: 'Manage roles, permissions, and audit logs',
    metadata: { system: true, level: 4, privileged: true },
  },
];

/**
 * Seed baseline permissions
 */
export const BASELINE_PERMISSIONS: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Subscription permissions
  { resource: 'subscription', action: 'read', description: 'View subscription details' },
  { resource: 'subscription', action: 'write', description: 'Edit subscription data' },
  { resource: 'subscription', action: 'pause', description: 'Pause active subscription' },
  { resource: 'subscription', action: 'cancel', description: 'Cancel subscription' },
  
  // Overlay permissions
  { resource: 'overlay', action: 'read', description: 'View overlay configurations' },
  { resource: 'overlay', action: 'write', description: 'Edit overlay configurations' },
  { resource: 'overlay', action: 'publish', description: 'Publish overlay to production' },
  
  // Token permissions
  { resource: 'token', action: 'read', description: 'View design tokens' },
  { resource: 'token', action: 'write', description: 'Edit design tokens' },
  { resource: 'token', action: 'approve', description: 'Approve token changes' },
  
  // Compliance permissions
  { resource: 'compliance', action: 'manage-roles', description: 'Create/edit/delete roles' },
  { resource: 'compliance', action: 'assign-permissions', description: 'Grant permissions to roles' },
  { resource: 'compliance', action: 'view-audit-log', description: 'Read audit log entries' },
];

/**
 * Type guard to check if a role has system flag
 */
export function isSystemRole(role: Role): boolean {
  return role.metadata?.system === true;
}

/**
 * Type guard to check if a role is privileged
 */
export function isPrivilegedRole(role: Role): boolean {
  return role.metadata?.privileged === true;
}

/**
 * Membership state derived from Relationship.object lifecycle (Sprint 13 billing objects)
 */
export type MembershipState =
  | 'proposed'
  | 'active'
  | 'paused'
  | 'completed'
  | 'terminated';

/**
 * Canonical user ↔ organization membership record
 * Mirrors Relationship.object.yaml (`relationship_type: membership`)
 */
export interface UserOrganizationMembership {
  relationshipId: string;
  userId: string;
  organizationId: string;
  state: MembershipState;
  role: string;
  joinedAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Active membership helper
 */
export function isActiveMembership(membership: UserOrganizationMembership): boolean {
  return membership.state === 'active';
}
