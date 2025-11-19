import { describe, expect, it } from 'vitest';

import { normalizeRole, RoleSchema } from '@/schemas/authz/role.schema.ts';
import {
  normalizePermission,
  PermissionSchema,
} from '@/schemas/authz/permission.schema.ts';
import {
  normalizeMembership,
  MembershipSchema,
} from '@/schemas/authz/membership.schema.ts';
import {
  normalizeRoleHierarchyEdge,
  RoleHierarchySchema,
} from '@/schemas/authz/role-hierarchy.schema.ts';

const roleId = '550e8400-e29b-41d4-a716-446655440000';
const permissionId = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('Role schema', () => {
  it('normalizes whitespace and validates name constraints', () => {
    const role = normalizeRole({
      id: roleId,
      name: '  Admin  ',
      description: '  Full tenant admin  ',
    });

    expect(role.name).toBe('Admin');
    expect(role.description).toBe('Full tenant admin');
  });

  it('rejects invalid identifiers', () => {
    expect(() => RoleSchema.parse({ id: roleId, name: 'not ok!' })).toThrow(/Role name/);
  });
});

describe('Permission schema', () => {
  it('enforces resource:action format', () => {
    const permission = normalizePermission({
      id: permissionId,
      name: 'document:create',
      description: 'Create documents',
      resource_type: 'document',
    });

    expect(permission.name).toBe('document:create');
    expect(permission.resource_type).toBe('document');
  });

  it('rejects malformed permission names', () => {
    expect(() =>
      PermissionSchema.parse({
        id: permissionId,
        name: 'DocumentCreate',
      })
    ).toThrow(/resource:action/);
  });
});

describe('Membership schema', () => {
  const baseMembership = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    organization_id: '789e0123-e45b-47c8-b901-234567890abc',
    role_id: roleId,
  } as const;

  it('fills timestamps and validates ordering', () => {
    const membership = normalizeMembership({
      ...baseMembership,
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(membership.created_at).toMatch(/T/);
    expect(membership.updated_at >= membership.created_at).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(() =>
      MembershipSchema.parse({
        ...baseMembership,
        id: 'not-a-uuid',
        created_at: '2025-11-19T00:00:00Z',
        updated_at: '2025-11-19T00:00:00Z',
      })
    ).toThrow(/UUID/);
  });
});

describe('Role hierarchy schema', () => {
  it('prevents self-referencing edges', () => {
    expect(() =>
      RoleHierarchySchema.parse({
        parent_role_id: roleId,
        child_role_id: roleId,
      })
    ).toThrow(/self-reference/);
  });

  it('normalizes valid edges', () => {
    const edge = normalizeRoleHierarchyEdge({
      parent_role_id: roleId,
      child_role_id: permissionId,
      depth: 1,
    });

    expect(edge.depth).toBe(1);
  });
});
