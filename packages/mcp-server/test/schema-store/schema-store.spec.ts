import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { SchemaStore } from '../../src/schema-store/index.js';
import { createSchemaRef, resolveSchemaRef } from '../../src/tools/schema-ref.js';

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

describe('schema-store infrastructure', () => {
  let rootDir = '';
  let store: SchemaStore;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-store-'));
    store = new SchemaStore({ projectRoot: rootDir });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('save creates schema file and metadata index', async () => {
    const schemaRef = createSchemaRef(buildSchema('Card'), 'test-save');
    const saved = await store.save({
      name: 'subscription_detail',
      schemaRef: schemaRef.ref,
      object: 'Subscription',
      context: 'detail',
      author: 'agent',
      tags: ['billing', 'detail'],
    });

    expect(saved.name).toBe('subscription_detail');
    expect(saved.version).toBe(1);
    expect(saved.schema.screens[0].component).toBe('Card');
    expect(saved.tags).toEqual(['billing', 'detail']);

    const schemaPath = path.join(store.storeDir, 'subscription_detail.json');
    const indexPath = path.join(store.storeDir, '_index.json');
    expect(await pathExists(schemaPath)).toBe(true);
    expect(await pathExists(indexPath)).toBe(true);

    const indexRaw = await fs.readFile(indexPath, 'utf8');
    const indexDoc = JSON.parse(indexRaw) as { schemas: Array<Record<string, unknown>> };
    expect(indexDoc.schemas).toHaveLength(1);
    expect(indexDoc.schemas[0].name).toBe('subscription_detail');
    expect(indexDoc.schemas[0].schema).toBeUndefined();
  });

  it('increments version and overwrites existing schema payload', async () => {
    const firstRef = createSchemaRef(buildSchema('Card'), 'v1');
    const first = await store.save({
      name: 'profile_card',
      schemaRef: firstRef.ref,
      object: 'User',
      context: 'detail',
      tags: ['alpha'],
    });

    await sleep(5);

    const secondRef = createSchemaRef(buildSchema('Table'), 'v2');
    const second = await store.save({
      name: 'profile_card',
      schemaRef: secondRef.ref,
      tags: ['beta', 'beta'],
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
    expect(second.tags).toEqual(['beta']);
    expect(second.object).toBe('User');
    expect(second.context).toBe('detail');

    const loaded = await store.load('profile_card');
    expect(loaded.version).toBe(2);
    expect(loaded.schema.screens[0].component).toBe('Table');
  });

  it('load re-registers persisted schemaRef in cache', async () => {
    await store.save({
      name: 'from_disk',
      schema: buildSchema('Text'),
      tags: ['persisted'],
    });

    const schemaPath = path.join(store.storeDir, 'from_disk.json');
    const raw = await fs.readFile(schemaPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.schemaRef = 'persisted-ref-001';
    await fs.writeFile(schemaPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

    const loaded = await store.load('from_disk');
    expect(loaded.schemaRef).toBe('persisted-ref-001');

    const resolved = resolveSchemaRef('persisted-ref-001');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.schema.screens[0].component).toBe('Text');
    }
  });

  it('list reads from index, applies filters, and sorts by updatedAt desc', async () => {
    const firstRef = createSchemaRef(buildSchema('Card'), 'list-one');
    await store.save({
      name: 'subscription_detail',
      schemaRef: firstRef.ref,
      object: 'Subscription',
      context: 'detail',
      tags: ['billing', 'critical'],
    });
    await sleep(5);

    const secondRef = createSchemaRef(buildSchema('Stack'), 'list-two');
    await store.save({
      name: 'subscription_list',
      schemaRef: secondRef.ref,
      object: 'Subscription',
      context: 'list',
      tags: ['billing'],
    });
    await sleep(5);

    const thirdRef = createSchemaRef(buildSchema('Text'), 'list-three');
    await store.save({
      name: 'user_detail',
      schemaRef: thirdRef.ref,
      object: 'User',
      context: 'detail',
      tags: ['identity'],
    });

    // Corrupt one schema payload file to verify list relies on index only.
    await fs.writeFile(path.join(store.storeDir, 'subscription_detail.json'), '{not-json', 'utf8');

    const all = await store.list();
    expect(all.map((entry) => entry.name)).toEqual(['user_detail', 'subscription_list', 'subscription_detail']);

    const filtered = await store.list({
      object: 'Subscription',
      context: 'detail',
      tags: ['critical', 'missing'],
    });
    expect(filtered.map((entry) => entry.name)).toEqual(['subscription_detail']);
  });

  it('delete removes schema file and index entry, exists reflects state', async () => {
    const schemaRef = createSchemaRef(buildSchema('Card'), 'delete-case');
    await store.save({
      name: 'to_delete',
      schemaRef: schemaRef.ref,
      tags: ['cleanup'],
    });

    expect(await store.exists('to_delete')).toBe(true);
    const deleted = await store.delete('to_delete');
    expect(deleted.name).toBe('to_delete');

    expect(await store.exists('to_delete')).toBe(false);
    expect(await pathExists(path.join(store.storeDir, 'to_delete.json'))).toBe(false);

    const listed = await store.list();
    expect(listed.find((entry) => entry.name === 'to_delete')).toBeUndefined();
  });

  it('rejects saves for missing schemaRef records', async () => {
    // s206-m03: one wording for an unavailable ref, which says what happened and what to do.
    await expect(store.save({ name: 'bad_ref', schemaRef: 'compose-missing' })).rejects.toThrow(
      /Cannot save schema "bad_ref": schemaRef 'compose-missing' is not known to this server\..* Run design\.compose again and save the new schemaRef right away\.$/,
    );
  });
});
