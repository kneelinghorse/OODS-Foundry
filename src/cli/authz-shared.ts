import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { AUTHZ_SAMPLE_DATASET } from '@/data/authz/sample-entitlements.js';
import type { AuthzDataset, AuthzDatasetOrganization, AuthzDatasetUser } from '@/data/authz/types.js';
import { RoleHierarchySchema } from '@/schemas/authz/role-hierarchy.schema.js';
import { MembershipSchema, type MembershipDocument } from '@/schemas/authz/membership.schema.js';
import { PermissionSchema } from '@/schemas/authz/permission.schema.js';
import { RoleSchema } from '@/schemas/authz/role.schema.js';
import { AuthableTrait } from '@/traits/authz/authz-trait.js';

const DatasetUserSchema = z.object({
  id: z.string().uuid('Dataset users must include valid UUID identifiers.'),
  name: z.string().min(1, 'User name required.'),
  email: z.string().email().optional(),
  preferredName: z.string().optional(),
  organizationIds: z.array(z.string().uuid()).min(1, 'organizationIds must include at least one value.'),
  sessionRoles: z.array(z.string().min(1)).optional(),
});

const DatasetOrganizationSchema = z.object({
  id: z.string().uuid('Organization id must be a UUID.'),
  name: z.string().min(1, 'Organization name required.'),
  label: z.string().optional(),
  domain: z.string().optional(),
  region: z.string().optional(),
});

const DatasetSchema: z.ZodType<AuthzDataset> = z
  .object({
    roles: RoleSchema.array().nonempty('Provide at least one role entry.'),
    permissions: PermissionSchema.array().nonempty('Provide at least one permission entry.'),
    rolePermissions: z.record(z.string(), z.array(z.string().uuid())),
    roleHierarchy: RoleHierarchySchema.array().optional(),
    memberships: MembershipSchema.array(),
    users: DatasetUserSchema.array(),
    organizations: DatasetOrganizationSchema.array(),
  }) as z.ZodType<AuthzDataset>;

export async function loadDataset(datasetPath?: string): Promise<AuthzDataset> {
  if (!datasetPath) {
    return AUTHZ_SAMPLE_DATASET;
  }
  const resolved = path.resolve(datasetPath);
  const raw = await readFile(resolved, 'utf-8');
  const parsed = JSON.parse(raw);
  return DatasetSchema.parse(parsed);
}

export function createTrait(dataset: AuthzDataset): AuthableTrait {
  return new AuthableTrait({
    roleCatalog: dataset.roles,
    permissionCatalog: dataset.permissions,
    rolePermissions: dataset.rolePermissions,
    roleHierarchyEdges: dataset.roleHierarchy,
    memberships: dataset.memberships,
  });
}

export function findUser(dataset: AuthzDataset, userId: string): AuthzDatasetUser | undefined {
  return dataset.users.find((user) => user.id === userId);
}

export function findOrganization(dataset: AuthzDataset, organizationId: string): AuthzDatasetOrganization | undefined {
  return dataset.organizations.find((org) => org.id === organizationId);
}

export function listMembershipsForUser(
  dataset: AuthzDataset,
  userId: string,
  organizationId?: string
): MembershipDocument[] {
  return dataset.memberships.filter((membership) => {
    if (membership.user_id !== userId) {
      return false;
    }
    if (organizationId) {
      return membership.organization_id === organizationId;
    }
    return true;
  });
}

export function listMembershipsForOrganization(dataset: AuthzDataset, organizationId: string): MembershipDocument[] {
  return dataset.memberships.filter((membership) => membership.organization_id === organizationId);
}

export function ensureUser(user: AuthzDatasetUser | undefined, userId: string): AuthzDatasetUser {
  if (!user) {
    throw new Error(`User ${userId} was not found in the dataset.`);
  }
  return user;
}

export function ensureOrganization(org: AuthzDatasetOrganization | undefined, organizationId: string): AuthzDatasetOrganization {
  if (!org) {
    throw new Error(`Organization ${organizationId} was not found in the dataset.`);
  }
  return org;
}

export function buildOrgContext(org: AuthzDatasetOrganization, membershipCount: number) {
  return {
    id: org.id,
    name: org.name,
    label: org.label,
    domain: org.domain,
    region: org.region,
    membershipCount,
  } as const;
}
