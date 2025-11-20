import type { MembershipDocument } from '@/schemas/authz/membership.schema.js';
import type { PermissionDocument } from '@/schemas/authz/permission.schema.js';
import type { RoleHierarchyEdge } from '@/schemas/authz/role-hierarchy.schema.js';
import type { RoleDocument } from '@/schemas/authz/role.schema.js';

export interface AuthzDatasetUser {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly preferredName?: string;
  readonly organizationIds: readonly string[];
  readonly sessionRoles?: readonly string[];
}

export interface AuthzDatasetOrganization {
  readonly id: string;
  readonly name: string;
  readonly label?: string;
  readonly domain?: string;
  readonly region?: string;
}

export interface AuthzDataset {
  readonly roles: readonly RoleDocument[];
  readonly permissions: readonly PermissionDocument[];
  readonly rolePermissions: Readonly<Record<string, readonly string[]>>;
  readonly roleHierarchy?: readonly RoleHierarchyEdge[];
  readonly memberships: readonly MembershipDocument[];
  readonly users: readonly AuthzDatasetUser[];
  readonly organizations: readonly AuthzDatasetOrganization[];
}
