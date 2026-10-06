import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UiSchema } from '../../../schemas/generated.js';
import { SchemaStore } from '../../../schema-store/index.js';
import { createSchemaRef, resolveSchemaRef } from '../../schema-ref.js';
import { handle as composeHandle } from '../../design.compose.js';
import { handle as validateHandle } from '../../repl.validate.js';
import { handle as schemaDeleteHandle } from '../delete.js';
import { handle as schemaListHandle } from '../list.js';
import { handle as schemaLoadHandle } from '../load.js';
import { handle as schemaSaveHandle } from '../save.js';

function buildSchema(name: string, route: string, semanticType?: string): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: `${name}-screen`,
        component: 'Stack',
        route,
      },
    ],
    ...(semanticType
      ? {
          objectSchema: {
            field: {
              type: 'string',
              required: true,
              semanticType,
            },
          },
        }
      : {}),
  };
}

describe('schema tool handlers', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-schema-tools-src-test-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('schema_save validates schemaRef and returns metadata-only response', async () => {
    const schemaRef = createSchemaRef(
      buildSchema('subscription_detail', '/subscriptions/detail', 'billing.subscription.status'),
      'compose',
    );

    const saved = await schemaSaveHandle({
      name: 'subscription_detail',
      schemaRef: schemaRef.ref,
      tags: ['billing', 'detail'],
      author: 'agent',
    });

    expect(saved.name).toBe('subscription_detail');
    expect(saved.version).toBe(1);
    expect(saved.object).toBe('Subscription');
    expect(saved.context).toBe('detail');
    expect(saved.tags).toEqual(['billing', 'detail']);
    expect(Object.prototype.hasOwnProperty.call(saved as Record<string, unknown>, 'schema')).toBe(false);

    await expect(schemaSaveHandle({ name: 'subscription_detail', schemaRef: 'compose-missing' })).rejects.toThrow(
      /design\.compose again/i,
    );
  });

  it('schema_load returns usable schemaRef and errors clearly on missing name', async () => {
    const schemaRef = createSchemaRef(buildSchema('invoice_detail', '/invoices/detail', 'billing.invoice.status'), 'compose');
    await schemaSaveHandle({ name: 'invoice_detail', schemaRef: schemaRef.ref, tags: ['billing'] });

    const loaded = await schemaLoadHandle({ name: 'invoice_detail' });
    expect(loaded.name).toBe('invoice_detail');
    expect(loaded.schemaRef.length).toBeGreaterThan(0);

    const resolved = resolveSchemaRef(loaded.schemaRef);
    expect(resolved.ok).toBe(true);

    await expect(schemaLoadHandle({ name: 'invoice_detial' })).rejects.toThrow(/Did you mean/i);
  });

  it('schema_list supports filter combinations and schema_delete removes entries', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'sub_detail',
      schema: buildSchema('sub_detail', '/subscriptions/detail'),
      object: 'Subscription',
      context: 'detail',
      tags: ['billing', 'critical'],
    });
    await store.save({
      name: 'sub_list',
      schema: buildSchema('sub_list', '/subscriptions/list'),
      object: 'Subscription',
      context: 'list',
      tags: ['billing'],
    });
    await store.save({
      name: 'user_detail',
      schema: buildSchema('user_detail', '/users/detail'),
      object: 'User',
      context: 'detail',
      tags: ['identity'],
    });

    const all = await schemaListHandle({});
    expect(all.length).toBe(3);

    const objectOnly = await schemaListHandle({ object: 'Subscription' });
    expect(objectOnly.map((entry) => entry.name).sort()).toEqual(['sub_detail', 'sub_list']);

    const contextOnly = await schemaListHandle({ context: 'detail' });
    expect(contextOnly.map((entry) => entry.name).sort()).toEqual(['sub_detail', 'user_detail']);

    const tagsOnly = await schemaListHandle({ tags: ['critical'] });
    expect(tagsOnly.map((entry) => entry.name)).toEqual(['sub_detail']);

    const allFilters = await schemaListHandle({
      object: 'Subscription',
      context: 'detail',
      tags: ['critical', 'missing'],
    });
    expect(allFilters.map((entry) => entry.name)).toEqual(['sub_detail']);

    const deleted = await schemaDeleteHandle({ name: 'sub_list' });
    expect(deleted.deleted).toBe(true);
    expect(deleted.schema.name).toBe('sub_list');

    const afterDelete = await schemaListHandle({});
    expect(afterDelete.find((entry) => entry.name === 'sub_list')).toBeUndefined();
    await expect(schemaDeleteHandle({ name: 'sub_list' })).rejects.toThrow(/schema_list/i);
  });

  it('schema_save uses explicit object over inference', async () => {
    const schemaRef = createSchemaRef(
      buildSchema('txn_receipt', '/transactions/detail', 'status.archive.state'),
      'compose',
    );

    const saved = await schemaSaveHandle({
      name: 'txn_receipt',
      schemaRef: schemaRef.ref,
      object: 'Transaction',
    });

    expect(saved.object).toBe('Transaction');
  });

  it('inferObject extracts entity from 3-part semantic types correctly', async () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{ id: 's', component: 'Stack' }],
      objectSchema: {
        id: { type: 'string', required: true, semanticType: 'commerce.transaction.id' },
        timestamp: { type: 'string', required: true, semanticType: 'commerce.transaction.timestamp' },
        channel: { type: 'string', required: false, semanticType: 'commerce.transaction.channel' },
        method: { type: 'string', required: false, semanticType: 'commerce.payment.method' },
        archived: { type: 'boolean', required: false, semanticType: 'status.archive.state' },
      },
    };
    const schemaRef = createSchemaRef(schema, 'compose');

    const saved = await schemaSaveHandle({
      name: 'txn_infer_test',
      schemaRef: schemaRef.ref,
    });

    // 'transaction' appears 3 times, 'archive' and 'payment' each once → Transaction wins
    expect(saved.object).toBe('Transaction');
  });

  it('inferObject handles 2-part semantic types using first segment', async () => {
    const schema: UiSchema = {
      version: '2026.02',
      screens: [{ id: 's', component: 'Stack' }],
      objectSchema: {
        id: { type: 'string', required: true, semanticType: 'organization.id' },
        name: { type: 'string', required: true, semanticType: 'organization.name' },
        status: { type: 'string', required: false, semanticType: 'organization.status' },
      },
    };
    const schemaRef = createSchemaRef(schema, 'compose');

    const saved = await schemaSaveHandle({
      name: 'org_infer_test',
      schemaRef: schemaRef.ref,
    });

    expect(saved.object).toBe('Organization');
  });

  it('integration lifecycle compose -> save -> list -> load -> validate -> delete', async () => {
    const composed = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });

    expect(composed.status).toBe('ok');
    expect(composed.schemaRef).toBeTruthy();

    await schemaSaveHandle({
      name: 'sub_detail_lifecycle',
      schemaRef: composed.schemaRef!,
      tags: ['lifecycle'],
    });

    const listed = await schemaListHandle({ object: 'Subscription' });
    expect(listed.find((entry) => entry.name === 'sub_detail_lifecycle')).toBeDefined();

    const loaded = await schemaLoadHandle({ name: 'sub_detail_lifecycle' });
    const validation = await validateHandle({ mode: 'full', schemaRef: loaded.schemaRef });
    expect(validation.status).toBe('ok');

    await schemaDeleteHandle({ name: 'sub_detail_lifecycle' });
    const finalList = await schemaListHandle({});
    expect(finalList.find((entry) => entry.name === 'sub_detail_lifecycle')).toBeUndefined();
  });
});
