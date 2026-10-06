import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import inputSchema from '../../src/schemas/schema.save.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/schema.save.output.json' assert { type: 'json' };
import { createSchemaRef } from '../../src/tools/schema-ref.js';
import { handle } from '../../src/tools/schema/save.js';

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
        meta: { intent: 'Subscription detail view' },
      },
    ],
    objectSchema: {
      status: {
        type: 'string',
        required: true,
        semanticType: 'billing.subscription.status',
      },
    },
  };
}

describe('schema.save contract', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-save-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('input schema accepts valid payload and rejects invalid shape', () => {
    expect(validateInput({ name: 'subscription_detail', schemaRef: 'compose-abcd1234' })).toBe(true);
    expect(validateInput({ name: 'bad name', schemaRef: 'compose-abcd1234' })).toBe(false);
    expect(validateInput({ name: 'subscription_detail' })).toBe(false);
    expect(validateInput({ name: 'subscription_detail', schemaRef: 'compose-abcd1234', extra: true })).toBe(false);
  });

  it('persists schema metadata without returning full UiSchema payload', async () => {
    const schemaRef = createSchemaRef(buildSchema(), 'compose');
    const output = await handle({
      name: 'subscription_detail',
      schemaRef: schemaRef.ref,
      tags: ['billing', 'detail'],
      author: 'agent',
    });

    expect(validateOutput(output)).toBe(true);
    expect(output.name).toBe('subscription_detail');
    expect(output.version).toBe(1);
    expect(output.object).toBe('Subscription');
    expect(output.context).toBe('detail');
    expect(output.tags).toEqual(['billing', 'detail']);
    expect(Object.prototype.hasOwnProperty.call(output as Record<string, unknown>, 'schema')).toBe(false);
  });

  it('returns clear errors for invalid name and missing schemaRef', async () => {
    const validRef = createSchemaRef(buildSchema(), 'compose').ref;
    await expect(handle({ name: 'bad name', schemaRef: validRef })).rejects.toThrow(/slug format/i);
    await expect(handle({ name: 'subscription_detail', schemaRef: 'compose-missing-ref' })).rejects.toThrow(
      /design\.compose again/i,
    );
  });
});
