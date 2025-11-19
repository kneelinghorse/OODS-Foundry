import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import AuthableTraitDefinition, {
  AUTHABLE_TRAIT_VERSION,
} from '../../traits/core/Authable.trait.ts';
import { AuthableTrait } from '@/traits/authz/authz-trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'core');
const yamlPath = join(traitDir, 'Authable.trait.yaml');

const adminRoleId = '550e8400-e29b-41d4-a716-446655440000';
const viewerRoleId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const sharePermissionId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const readPermissionId = '5c60f693-bef5-4d2d-a401-3b1f9f7c8ed8';

describe('Authable trait definition', () => {
  it('parses YAML definition with membership semantics', async () => {
    const result = await parseTrait(yamlPath);
    expect(result.success).toBe(true);
    const def = result.data!;
    expect(def.trait.name).toBe('Authable');
    expect(def.schema.membership_records.description).toContain('UNIQUE');
    expect(def.view_extensions?.detail?.[0]?.component).toBe('MembershipPanel');
  });

  it('exports TypeScript definition with version pin', () => {
    expect(AuthableTraitDefinition.trait.version).toBe(AUTHABLE_TRAIT_VERSION);
    expect(AuthableTraitDefinition.parameters?.length).toBeGreaterThan(0);
    expect(AuthableTraitDefinition.tokens).toHaveProperty('auth.roles.badge.bg');
  });

  it('validates parameters using shared validator', () => {
    const validator = new ParameterValidator();
    const ok = validator.validate('Authable', {
      defaultRoleId: adminRoleId,
      hierarchyDepthLimit: 4,
    });
    expect(ok.valid).toBe(true);

    const invalid = validator.validate('Authable', {
      hierarchyDepthLimit: 0,
    });
    expect(invalid.valid).toBe(false);
  });
});

describe('Authable trait runtime helper', () => {
  const baseState = {
    roleCatalog: [
      { id: adminRoleId, name: 'Admin', description: 'Tenant admin' },
      { id: viewerRoleId, name: 'Viewer', description: 'Read only' },
    ],
    permissionCatalog: [
      { id: sharePermissionId, name: 'document:share', description: 'Share documents' },
      { id: readPermissionId, name: 'document:read', description: 'Read documents' },
    ],
    memberships: [
      {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        user_id: adminUserId,
        organization_id: orgId,
        role_id: adminRoleId,
        created_at: '2025-11-19T00:00:00Z',
        updated_at: '2025-11-19T00:00:00Z',
      },
    ],
    rolePermissions: {
      [adminRoleId]: [sharePermissionId, readPermissionId],
      [viewerRoleId]: [readPermissionId],
    },
  } as const;

  it('manages membership assignment, revocation, and permission checks', () => {
    const trait = new AuthableTrait(baseState);

    expect(trait.getRolesForUser(adminUserId, orgId)[0]?.name).toBe('Admin');
    expect(trait.userHasPermission(adminUserId, orgId, 'document:share')).toBe(true);

    const assigned = trait.assignMembership({
      user_id: viewerUserId,
      organization_id: orgId,
      role_id: viewerRoleId,
    });
    expect(assigned.role_id).toBe(viewerRoleId);
    expect(trait.userHasRole(viewerUserId, orgId, viewerRoleId)).toBe(true);
    expect(trait.userHasPermission(viewerUserId, orgId, 'document:read')).toBe(true);

    trait.linkRolePermission(viewerRoleId, sharePermissionId);
    expect(trait.userHasPermission(viewerUserId, orgId, 'document:share')).toBe(true);

    expect(trait.revokeMembership(viewerUserId, orgId, 'Viewer')).toBe(true);
    expect(trait.userHasRole(viewerUserId, orgId, viewerRoleId)).toBe(false);
  });
});
const orgId = '789e0123-e45b-47c8-b901-234567890abc';
const adminUserId = '123e4567-e89b-12d3-a456-426614174000';
const viewerUserId = '456e1234-e89b-12d3-a456-426614174111';
