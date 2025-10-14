import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { TraitResolver } from '../../src/registry/resolver.ts';
import { TraitLoader } from '../../src/registry/trait-loader.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';

const OBJECTS_ROOT = path.resolve('objects', 'core');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];
const CANONICAL_OBJECTS = [
  'Organization',
  'Product',
  'Relationship',
  'Subscription',
  'Transaction',
  'User',
] as const;

describe('Object registry pipeline integration', () => {
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

  it('indexes and resolves the Universal Quintet within performance targets', async () => {
    const listedNames = registry.list().map((record) => record.name).sort();
    expect(listedNames).toEqual([...CANONICAL_OBJECTS].sort());

    const traitResolver = new TraitResolver({
      loader: new TraitLoader({ roots: TRAIT_ROOTS }),
      validator: new ParameterValidator(),
      validateParameters: true,
    });

    for (const name of CANONICAL_OBJECTS) {
      await registry.resolve(name, {
        traitResolver,
        validateParameters: true,
      });
    }

    for (const name of CANONICAL_OBJECTS) {
      const record = registry.getByName(name);
      expect(record, `Registry missing ${name}`).toBeDefined();

      const resolved = await registry.resolve(name, {
        traitResolver,
        validateParameters: true,
      });

      expect(resolved.resolvedTraits.length).toBeGreaterThan(0);
      expect(resolved.composed.metadata.traitCount).toBe(resolved.resolvedTraits.length);
      expect(resolved.composed.metadata.provenance.size).toBeGreaterThan(0);
      expect(resolved.composed.metadata.performance?.durationMs).toBeLessThan(100);
      expect(resolved.metadata.totalMs).toBeLessThanOrEqual(100);

      const schemaKeys = Object.keys(resolved.composed.schema);
      expect(schemaKeys.length).toBeGreaterThan(5);
      for (const key of schemaKeys) {
        const provenance = resolved.composed.metadata.provenance.get(key);
        expect(provenance, `Missing provenance for ${name}.${key}`).toBeDefined();
      }
    }
  });

  it('surfaces diagnostics when invalid object definitions are encountered', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'registry-invalid-'));
    const objectsDir = path.join(workspaceRoot, 'objects');
    mkdirSync(objectsDir, { recursive: true });

    writeFileSync(
      path.join(objectsDir, 'Invalid.object.yaml'),
      'object:\n  name: Invalid\nschema:\n  description: string\n',
      'utf8'
    );

    const tempRegistry = new ObjectRegistry({
      roots: [objectsDir],
      watch: false,
    });

    try {
      await tempRegistry.waitUntilReady();
      const diagnostics = Array.from(tempRegistry.getDiagnostics().values()).flat();
      expect(diagnostics.some((entry) => entry.type === 'parse_error')).toBe(true);
    } finally {
      tempRegistry.close();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('emits descriptive errors when trait resolution fails', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'registry-missing-trait-'));
    const objectsDir = path.join(workspaceRoot, 'objects');
    const traitRoot = path.join(workspaceRoot, 'traits');
    mkdirSync(objectsDir, { recursive: true });
    mkdirSync(traitRoot, { recursive: true });

    writeFileSync(
      path.join(objectsDir, 'Example.object.yaml'),
      `object:\n  name: Example\ntraits:\n  - name: missing/DoesNotExist\nschema:\n  placeholder:\n    type: string\n    required: true\n`,
      'utf8'
    );

    const tempRegistry = new ObjectRegistry({
      roots: [objectsDir],
      watch: false,
    });

    try {
      await tempRegistry.waitUntilReady();
      await expect(
        tempRegistry.resolve('Example', {
          traitRoots: [traitRoot],
          validateParameters: true,
        })
      ).rejects.toThrow(/Failed to resolve trait "missing\/DoesNotExist"/);
    } finally {
      tempRegistry.close();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
