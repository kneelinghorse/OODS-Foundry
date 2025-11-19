import { z } from 'zod';

import { RoleSchema } from '@/schemas/authz/role.schema.js';
import { PermissionSchema } from '@/schemas/authz/permission.schema.js';

const RoleSeedSchema = RoleSchema.omit({ id: true });
const PermissionSeedSchema = PermissionSchema.omit({ id: true });

export type RoleSeed = z.infer<typeof RoleSeedSchema>;
export type PermissionSeed = z.infer<typeof PermissionSeedSchema>;

export interface RolePermissionMatrixEntry {
  readonly role: string;
  readonly permissions: readonly string[];
}

export const DEFAULT_ROLE_SEEDS: readonly RoleSeed[] = RoleSeedSchema.array()
  .parse([
    {
      name: 'Admin',
      description: 'Full-access tenant administrator (global scope per R21.2 TABLE 1).',
    },
    {
      name: 'Editor',
      description: 'Tenant operator. May create/update but cannot perform destructive actions.',
    },
    {
      name: 'Viewer',
      description: 'Read-only persona for reporting and SoD-safe contexts.',
    },
  ])
  .map((entry) => ({ ...entry }));

export const DEFAULT_PERMISSION_SEEDS: readonly PermissionSeed[] = PermissionSeedSchema.array()
  .parse([
    {
      name: 'user:create',
      description: 'Create tenant-scoped users',
      resource_type: 'user',
    },
    {
      name: 'user:read',
      description: 'View tenant-scoped user profile data',
      resource_type: 'user',
    },
    {
      name: 'user:update',
      description: 'Update tenant-scoped user attributes',
      resource_type: 'user',
    },
    {
      name: 'user:delete',
      description: 'Remove tenant-scoped users',
      resource_type: 'user',
    },
    {
      name: 'document:create',
      description: 'Create documents owned by the tenant',
      resource_type: 'document',
    },
    {
      name: 'document:read',
      description: 'Read documents owned by the tenant',
      resource_type: 'document',
    },
    {
      name: 'document:update',
      description: 'Modify documents owned by the tenant',
      resource_type: 'document',
    },
    {
      name: 'document:delete',
      description: 'Delete documents owned by the tenant',
      resource_type: 'document',
    },
    {
      name: 'org:view',
      description: 'View organization metadata',
      resource_type: 'organization',
    },
    {
      name: 'org:update',
      description: 'Update organization metadata/settings',
      resource_type: 'organization',
    },
    {
      name: 'org:configure',
      description: 'Manage advanced organization configuration',
      resource_type: 'organization',
    },
    {
      name: 'org:invite',
      description: 'Invite new members into the organization',
      resource_type: 'organization',
    },
  ])
  .map((entry) => ({ ...entry }));

export const ROLE_PERMISSION_MATRIX: readonly RolePermissionMatrixEntry[] = [
  {
    role: 'Admin',
    permissions: DEFAULT_PERMISSION_SEEDS.map((permission) => permission.name),
  },
  {
    role: 'Editor',
    permissions: [
      'user:create',
      'user:read',
      'user:update',
      'document:create',
      'document:read',
      'document:update',
      'org:view',
      'org:update',
    ],
  },
  {
    role: 'Viewer',
    permissions: ['user:read', 'document:read', 'org:view'],
  },
] as const;

export function flattenRolePermissionMatrix(
  matrix: readonly RolePermissionMatrixEntry[] = ROLE_PERMISSION_MATRIX
): Map<string, Set<string>> {
  const assignments = new Map<string, Set<string>>();
  for (const entry of matrix) {
    const permissionSet = assignments.get(entry.role) ?? new Set<string>();
    entry.permissions.forEach((permission) => permissionSet.add(permission));
    assignments.set(entry.role, permissionSet);
  }
  return assignments;
}
