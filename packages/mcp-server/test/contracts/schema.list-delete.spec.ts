import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import deleteInputSchema from '../../src/schemas/schema.delete.input.json' assert { type: 'json' };
import deleteOutputSchema from '../../src/schemas/schema.delete.output.json' assert { type: 'json' };
import listInputSchema from '../../src/schemas/schema.list.input.json' assert { type: 'json' };
import listOutputSchema from '../../src/schemas/schema.list.output.json' assert { type: 'json' };
import { SchemaStore } from '../../src/schema-store/index.js';
import { handle as deleteHandle } from '../../src/tools/schema/delete.js';
import { handle as listHandle } from '../../src/tools/schema/list.js';

const ajv = getAjv();
const validateListInput = ajv.compile(listInputSchema);
const validateListOutput = ajv.compile(listOutputSchema);
const validateDeleteInput = ajv.compile(deleteInputSchema);
const validateDeleteOutput = ajv.compile(deleteOutputSchema);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSchema(route: string): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: `screen-${route.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        component: 'Stack',
        route,
      },
    ],
  };
}

describe('schema.list + schema.delete contracts', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-list-delete-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('list input/output schemas validate and filters behave as expected', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'subscription_detail',
      schema: buildSchema('/subscriptions/detail'),
      object: 'Subscription',
      context: 'detail',
      tags: ['billing', 'critical'],
    });
    await sleep(5);
    await store.save({
      name: 'subscription_list',
      schema: buildSchema('/subscriptions/list'),
      object: 'Subscription',
      context: 'list',
      tags: ['billing'],
    });
    await sleep(5);
    await store.save({
      name: 'user_detail',
      schema: buildSchema('/users/detail'),
      object: 'User',
      context: 'detail',
      tags: ['identity'],
    });

    expect(validateListInput({})).toBe(true);
    expect(validateListInput({ object: 'Subscription', context: 'detail', tags: ['billing'] })).toBe(true);
    expect(validateListInput({ tags: [1] })).toBe(false);

    const all = await listHandle({});
    expect(validateListOutput(all)).toBe(true);
    expect(all.map((entry) => entry.name)).toEqual(['user_detail', 'subscription_list', 'subscription_detail']);
    expect(all.every((entry) => !Object.prototype.hasOwnProperty.call(entry as Record<string, unknown>, 'schema'))).toBe(
      true,
    );

    const filtered = await listHandle({
      object: 'Subscription',
      context: 'detail',
      tags: ['critical', 'missing'],
    });
    expect(filtered.map((entry) => entry.name)).toEqual(['subscription_detail']);
  });

  it('delete removes file/index entry and returns confirmation metadata', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'to_delete',
      schema: buildSchema('/subscriptions/detail'),
      object: 'Subscription',
      context: 'detail',
      tags: ['billing'],
    });

    expect(validateDeleteInput({ name: 'to_delete' })).toBe(true);
    expect(validateDeleteInput({ name: 'bad name' })).toBe(false);

    const result = await deleteHandle({ name: 'to_delete' });
    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.deleted).toBe(true);
    expect(result.schema.name).toBe('to_delete');

    const listed = await listHandle({});
    expect(listed.find((entry) => entry.name === 'to_delete')).toBeUndefined();

    await expect(deleteHandle({ name: 'to_delete' })).rejects.toThrow(/schema_list/i);
  });
});
