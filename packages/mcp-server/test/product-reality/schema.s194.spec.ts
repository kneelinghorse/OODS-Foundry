import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { expect, it } from 'vitest';
import { handle as schema } from '../../src/tools/schema/index.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { resolveSchemaRef } from '../../src/tools/schema-ref.js';
import { wire, retain } from '../helpers/wire-boundary.js';

it('schema round-trips actual composed schemas, versions, metadata and deletion through the grouped wire', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s194-store-'));
  const previousRoot = process.env.MCP_SCHEMA_STORE_ROOT, previousDir = process.env.MCP_SCHEMA_STORE_DIR;
  process.env.MCP_SCHEMA_STORE_ROOT = temp; process.env.MCP_SCHEMA_STORE_DIR = '.oods/schemas';
  const call = async (input: any) => { wire('schema', 'input', input); const result = await schema(input); wire('schema', 'output', result); return result; };
  try {
    const composed = await compose({ object: 'Subscription', context: 'detail' });
    expect(composed.status).toBe('ok');
    const bytes = JSON.stringify(composed.schema);
    const input = { action: 'save', name: 's194-subscription', schemaRef: composed.schemaRef, author: 's194', tags: ['s194'], apply: false };
    const saved = await call(input);
    expect(saved.version).toBe(1);
    // apply is a documented bridge parity key: save persists on call.
    const file = path.join(temp, '.oods/schemas/s194-subscription.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).schema).toEqual(composed.schema);
    const loaded = await call({ action: 'load', name: input.name });
    const reference = resolveSchemaRef(loaded.schemaRef);
    expect(reference.ok).toBe(true);
    if (reference.ok) expect(JSON.stringify(reference.schema)).toBe(bytes);
    expect(loaded).toMatchObject({ name: input.name, version: 1, author: 's194', tags: ['s194'] });
    const repeated = await call(input);
    expect(repeated.version).toBe(2);
    expect(repeated.createdAt).toBe(saved.createdAt);
    expect(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')).schema)).toBe(bytes);
    const listed = await call({ action: 'list', tags: ['s194'] });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: input.name, version: 2 });
    // ETags and conditional requests are not in the saved-schema contract.
    expect(saved).not.toHaveProperty('etag'); expect(loaded).not.toHaveProperty('etag');
    const deleted = await call({ action: 'delete', name: input.name, apply: false });
    expect(deleted).toMatchObject({ deleted: true, schema: { name: input.name, version: 2 } });
    expect(fs.existsSync(file)).toBe(false);
    expect(await call({ action: 'list' })).toEqual([]);
    await expect(schema({ action: 'load', name: input.name })).rejects.toMatchObject({ opiCode: 'OODS-N002' });
    expect(JSON.stringify(composed.schema)).toBe(bytes);
    retain('schema', { saved, loaded, repeated, listed, deleted, schemaUnchanged: true, limitation: 'Monotonic versions and schemaRef identity; no ETag or conditional-request API.' });
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SCHEMA_STORE_ROOT; else process.env.MCP_SCHEMA_STORE_ROOT = previousRoot;
    if (previousDir === undefined) delete process.env.MCP_SCHEMA_STORE_DIR; else process.env.MCP_SCHEMA_STORE_DIR = previousDir;
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
