import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import inputSchema from '../../src/schemas/schema.load.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/schema.load.output.json' assert { type: 'json' };
import { SchemaStore } from '../../src/schema-store/index.js';
import { resolveSchemaRef } from '../../src/tools/schema-ref.js';
import { handle } from '../../src/tools/schema/load.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

function buildSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'subscription-detail-screen',
        component: 'Stack',
        route: '/subscriptions/detail',
      },
    ],
  };
}

describe('schema.load contract', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-load-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('input schema accepts valid payload and rejects invalid shape', () => {
    expect(validateInput({ name: 'subscription_detail' })).toBe(true);
    expect(validateInput({ name: 'bad name' })).toBe(false);
    expect(validateInput({})).toBe(false);
    expect(validateInput({ name: 'subscription_detail', extra: true })).toBe(false);
  });

  it('loads saved schema and returns reusable schemaRef + metadata', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'subscription_detail',
      schema: buildSchema(),
      object: 'Subscription',
      context: 'detail',
      tags: ['billing'],
      author: 'agent',
    });

    // Ensure load() rehydrates the persisted ref by setting a custom value.
    const schemaPath = path.join(store.storeDir, 'subscription_detail.json');
    const raw = await fs.readFile(schemaPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.schemaRef = 'persisted-load-ref-001';
    await fs.writeFile(schemaPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

    const output = await handle({ name: 'subscription_detail' });

    expect(validateOutput(output)).toBe(true);
    expect(output.schemaRef).toBe('persisted-load-ref-001');
    expect(output.name).toBe('subscription_detail');
    expect(output.version).toBe(1);
    expect(output.object).toBe('Subscription');
    expect(output.context).toBe('detail');
    expect(output.tags).toEqual(['billing']);

    const resolved = resolveSchemaRef(output.schemaRef);
    expect(resolved.ok).toBe(true);
  });

  it('returns clear not-found message with suggestion', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'subscription_detail',
      schema: buildSchema(),
      tags: ['billing'],
    });

    await expect(handle({ name: 'subscriptin_detail' })).rejects.toThrow(
      /Did you mean "subscription_detail"/,
    );
  });
});
