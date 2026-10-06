import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UiSchema } from '../../schemas/generated.js';
import { createSchemaRef } from '../../tools/schema-ref.js';
import { SchemaStore } from '../index.js';

function buildSchema(component: string): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: `screen-${component.toLowerCase()}`,
        component,
      },
    ],
  };
}

describe('SchemaStore edge and concurrency coverage', () => {
  let tempRoot = '';
  let store: SchemaStore;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-store-src-test-'));
    store = new SchemaStore({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('handles empty store reads cleanly', async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.exists('missing_schema')).toBe(false);
    await expect(store.load('missing_schema')).rejects.toThrow(/not found/i);
  });

  it('rejects invalid schema names', async () => {
    const schemaRef = createSchemaRef(buildSchema('Card'), 'invalid-name-test');
    await expect(store.save({ name: 'bad name', schemaRef: schemaRef.ref })).rejects.toThrow(/invalid/i);
    await expect(store.exists('bad name')).rejects.toThrow(/invalid/i);
    await expect(store.delete('bad name')).rejects.toThrow(/invalid/i);
  });

  it('serializes concurrent saves and increments version deterministically', async () => {
    const refs = ['Card', 'Table', 'Text', 'Stack'].map((component, index) =>
      createSchemaRef(buildSchema(component), `concurrent-${index}`),
    );

    const results = await Promise.all(
      refs.map((ref, index) =>
        store.save({
          name: 'concurrent_schema',
          schemaRef: ref.ref,
          tags: [`v${index + 1}`],
        }),
      ),
    );

    const versions = results.map((entry) => entry.version).sort((a, b) => a - b);
    expect(versions).toEqual([1, 2, 3, 4]);

    const latest = await store.load('concurrent_schema');
    expect(latest.version).toBe(4);
  });

  it('returns clear error when deleting a missing schema', async () => {
    await expect(store.delete('does_not_exist')).rejects.toThrow(/not found/i);
  });
});
