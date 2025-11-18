import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';

interface AddressableCase {
  readonly name: string;
  readonly identityField: string;
  readonly addressRoles: readonly string[];
}

const OBJECTS_ROOT = path.resolve('objects', 'core');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];

describe('Addressable trait composition', () => {
  let registry: ObjectRegistry;

  const cases: AddressableCase[] = [
    {
      name: 'User',
      identityField: 'user_id',
      addressRoles: ['home', 'billing', 'shipping'],
    },
    {
      name: 'Organization',
      identityField: 'organization_id',
      addressRoles: ['headquarters', 'office', 'warehouse', 'branch'],
    },
  ];

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

  for (const testCase of cases) {
    it(`composes Addressable with lifecycle + identity traits for ${testCase.name}`, async () => {
      const resolved = await registry.resolve(testCase.name, {
        traitRoots: TRAIT_ROOTS,
      });

      const { schema, metadata } = resolved.composed;

      expect(metadata.traitOrder).toContain('Addressable');
      expect(schema.addresses, 'Addressable addresses field missing').toBeDefined();
      expect(schema.address_roles, 'Address roles field missing').toBeDefined();
      expect(schema.default_address_role, 'Default role field missing').toBeDefined();

      expect(schema[testCase.identityField], 'Identity field should remain available').toBeDefined();
      expect(schema.status, 'Status field should still be exposed').toBeDefined();
      expect(schema.created_at, 'Timestamp fields should still compose').toBeDefined();

      const generated = generateObjectInterface(resolved, { includeJsDoc: false });
      expect(generated.traits).toContain('Addressable');
      expect(generated.code).toContain('addresses?: AddressableEntry[];');
      expect(generated.code).toContain('address_roles: string[];');

      for (const role of testCase.addressRoles) {
        expect(generated.code).toMatch(new RegExp(role));
      }
    });
  }
});
