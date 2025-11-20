import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OrganizationWithAuthableExample } from '../../examples/objects/organization-with-authable';
import { UserWithAuthableExample } from '../../examples/objects/user-with-authable';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';
import { ObjectRegistry } from '../../src/registry/registry.ts';
import { AUTHZ_SAMPLE_IDS, createSampleAuthableTrait } from '../../src/data/authz/sample-entitlements';

const OBJECTS_ROOT = path.resolve('objects');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];

describe('Authable composition', () => {
  let registry: ObjectRegistry;

  beforeAll(async () => {
    registry = new ObjectRegistry({
      roots: [OBJECTS_ROOT],
      watch: false,
    });
    await registry.waitUntilReady();
  });

  afterAll(() => {
    registry.close();
  });

  it('composes Authable trait for User object definitions', async () => {
    const resolved = await registry.resolve('User', { traitRoots: TRAIT_ROOTS });
    expect(resolved.composed.metadata.traitOrder).toContain('Authable');
    const { schema } = resolved.composed;
    expect(schema.membership_records).toBeDefined();
    expect(schema.role_permissions).toBeDefined();
    const generated = generateObjectInterface(resolved, { includeJsDoc: false });
    expect(generated.code).toContain('getRolesInOrg?(organizationId: string)');
    expect(generated.code).toContain('hasPermission?(organizationId: string, permission: string)');
  });

  it('composes Authable trait for Organization object definitions', async () => {
    const resolved = await registry.resolve('Organization', { traitRoots: TRAIT_ROOTS });
    expect(resolved.composed.metadata.traitOrder).toContain('Authable');
    const { schema } = resolved.composed;
    expect(schema.membership_records).toBeDefined();
    expect(schema.role_catalog).toBeDefined();
  });

  it('supports multi-trait operations for the sample user', () => {
    const trait = createSampleAuthableTrait();
    const userId = AUTHZ_SAMPLE_IDS.USERS.anika;
    const atlasOrgId = AUTHZ_SAMPLE_IDS.ORGS.atlas;

    const roles = trait.getRolesForUser(userId, atlasOrgId);
    expect(roles.map((role) => role.name)).toContain('Owner');
    expect(trait.userHasPermission(userId, atlasOrgId, 'document:approve')).toBe(true);
    expect(UserWithAuthableExample.membership_records.length).toBeGreaterThanOrEqual(1);
    expect(UserWithAuthableExample.session_roles?.length).toBeGreaterThan(0);
    expect(UserWithAuthableExample.preference_document.preferences.theme).toBeDefined();
  });

  it('exposes membership inventory for the sample organization', () => {
    const membershipCount = OrganizationWithAuthableExample.membership_records?.length ?? 0;
    expect(membershipCount).toBeGreaterThan(0);
    expect(OrganizationWithAuthableExample.role_catalog.length).toBeGreaterThan(0);
  });
});
