import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';
import { PreferenceStore } from '../../src/traits/preferenceable/preference-store.ts';
import { UserWithPreferencesExample } from '../../examples/objects/user-with-preferences';

const OBJECTS_ROOT = path.resolve('objects');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];

describe('Preferenceable User composition', () => {
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

  it('adds Preferenceable fields on top of lifecycle + addressable data', async () => {
    const resolved = await registry.resolve('User', { traitRoots: TRAIT_ROOTS });
    const { schema, metadata } = resolved.composed;

    expect(metadata.traitOrder).toEqual(expect.arrayContaining(['Preferenceable', 'Addressable', 'Stateful']));
    expect(schema.user_id).toBeDefined();
    expect(schema.preference_document, 'preference_document missing').toBeDefined();
    expect(schema.preference_metadata, 'preference_metadata missing').toBeDefined();
    expect(Array.isArray(schema.preference_namespaces.default)).toBe(true);
    expect(schema.preference_namespaces.default).toEqual(
      expect.arrayContaining(['theme', 'notifications'])
    );
    expect(metadata.traitOrder.indexOf('Preferenceable')).toBeGreaterThan(
      metadata.traitOrder.indexOf('Addressable')
    );

    const generated = generateObjectInterface(resolved, { includeJsDoc: false });
    expect(generated.traits).toContain('Preferenceable');
    expect(generated.code).toContain('preference_document: PreferenceDocument;');
    expect(generated.code).toContain('preference_namespaces: string[];');
    expect(generated.code).toContain('address_roles: string[];');
  });

  it('round-trips PreferenceStore snapshots for the example user payload', () => {
    const example = UserWithPreferencesExample;
    const store = new PreferenceStore(
      { document: example.preference_document },
      {
        namespaces: example.preference_namespaces,
        schemaVersion: example.preference_metadata.schemaVersion,
      }
    );

    expect(store.getPreference(['privacy', 'region'])).toBe('apac');
    store.setPreference(['theme', 'mode'], 'dark');
    expect(store.getPreference(['theme', 'mode'])).toBe('dark');

    expect(() => store.setPreference(['unsupported', 'flag'], true)).toThrowError(/Namespace/);

    const snapshot = store.toDocument();
    expect(snapshot.metadata.schemaVersion).toBe(example.preference_metadata.schemaVersion);
    expect(snapshot.preferences.theme).toBeDefined();
  });
});
