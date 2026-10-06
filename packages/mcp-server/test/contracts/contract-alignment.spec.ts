/**
 * Contract alignment tests (s74-m04).
 *
 * Verifies that agent-intuitive payloads pass input validation
 * and produce correct results without requiring recovery calls.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import validateInputSchema from '../../src/schemas/repl.validate.input.json' assert { type: 'json' };
import renderInputSchema from '../../src/schemas/repl.render.input.json' assert { type: 'json' };
import pipelineInputSchema from '../../src/schemas/pipeline.input.json' assert { type: 'json' };
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import { handle as schemaListHandle } from '../../src/tools/schema/list.js';
import { handle as schemaLoadHandle } from '../../src/tools/schema/load.js';
import { createSchemaRef } from '../../src/tools/schema-ref.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const ajv = getAjv();

const minimalSchema: UiSchema = {
  version: '2026.02',
  screens: [{ id: 'root', component: 'Box' }],
};

/* ------------------------------------------------------------------ */
/*  repl.validate — schemaRef-only (no mode)                          */
/* ------------------------------------------------------------------ */

describe('repl.validate — schemaRef-only contract', () => {
  const validate = ajv.compile(validateInputSchema);

  it('schema accepts { schemaRef } without mode', () => {
    const input = { schemaRef: 'ref:test-123' };
    const valid = validate(input);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('schema still accepts { mode: "full", schemaRef }', () => {
    const input = { mode: 'full', schemaRef: 'ref:test-123' };
    expect(validate(input)).toBe(true);
  });

  it('schema still requires patch when mode=patch', () => {
    const input = { mode: 'patch' as const };
    expect(validate(input)).toBe(false);
  });

  it('handler succeeds with schemaRef-only call', async () => {
    const record = createSchemaRef(minimalSchema, 'test');
    const result = await validateHandle({ schemaRef: record.ref });
    // Handler defaults mode to 'full' when omitted
    expect(result.mode).toBe('full');
    // Schema resolved successfully (no OODS-N003/OODS-N004 ref errors)
    const refErrors = result.errors.filter(e => e.code === 'OODS-N003' || e.code === 'OODS-N004' || e.code === 'OODS-V009');
    expect(refErrors).toHaveLength(0);
    // normalizedTree should be present (schema was resolved)
    expect(result.normalizedTree).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  repl.render — schemaRef-only (no mode)                            */
/* ------------------------------------------------------------------ */

describe('repl.render — schemaRef-only contract', () => {
  const validate = ajv.compile(renderInputSchema);

  it('schema accepts { schemaRef } without mode', () => {
    const input = { schemaRef: 'ref:test-456' };
    const valid = validate(input);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('handler resolves schemaRef without mode', async () => {
    const record = createSchemaRef(minimalSchema, 'test');
    const result = await renderHandle({ schemaRef: record.ref });
    // Handler defaults mode to 'full' when omitted
    expect(result.mode).toBe('full');
    // No ref resolution errors
    const refErrors = result.errors.filter(e => e.code === 'OODS-N003' || e.code === 'OODS-N004' || e.code === 'OODS-V009');
    expect(refErrors).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  pipeline — nested options aliases                                 */
/* ------------------------------------------------------------------ */

describe('pipeline — nested options aliases contract', () => {
  const validate = ajv.compile(pipelineInputSchema);

  it('schema accepts options.styling', () => {
    const input = { object: 'Product', options: { styling: 'tailwind' } };
    const valid = validate(input);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('schema accepts options.framework', () => {
    const input = { object: 'Product', options: { framework: 'vue' } };
    expect(validate(input)).toBe(true);
  });

  it('schema accepts options.typescript', () => {
    const input = { object: 'Product', options: { typescript: true, styling: 'tokens' } };
    expect(validate(input)).toBe(true);
  });

  it('schema accepts options.framework + options.typescript together', () => {
    const input = { object: 'Product', options: { framework: 'vue', styling: 'tokens', typescript: false } };
    expect(validate(input)).toBe(true);
  });

  it('handler reads styling from options when not at top level', async () => {
    const result = await pipelineHandle({
      intent: 'simple card',
      layout: 'card',
      options: { styling: 'tailwind' },
    });
    expect(result.code?.styling).toBe('tailwind');
  });

  it('handler reads framework from options when not at top level', async () => {
    const result = await pipelineHandle({
      intent: 'simple card',
      layout: 'card',
      options: { framework: 'vue' },
    });
    expect(result.code?.framework).toBe('vue');
  });

  it('handler accepts nested framework + typescript together', async () => {
    const result = await pipelineHandle({
      intent: 'simple card',
      layout: 'card',
      options: { framework: 'vue', styling: 'tokens', typescript: false },
    });
    expect(result.code?.framework).toBe('vue');
  });

  it('top-level styling overrides options.styling', async () => {
    const result = await pipelineHandle({
      intent: 'simple card',
      layout: 'card',
      styling: 'tokens',
      options: { styling: 'tailwind' },
    });
    expect(result.code?.styling).toBe('tokens');
  });

  it('pipeline save accepts { name, tags } object', async () => {
    // s152 F7: run against a temp schema store (mirrors the sibling test below) so the save does
    // NOT write the DEFAULT process.cwd() store. When the suite runs with process.cwd()=repo-root
    // (the closeout invocation), the unscoped save dirtied the tracked .oods/schemas/_index.json +
    // test-tagged-schema.json on every run — this was the SOLE test hitting the default store.
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-pipeline-contract-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;

    try {
      const result = await pipelineHandle({
        object: 'Product',
        context: 'card',
        framework: 'html',
        save: { name: 'test-tagged-schema', tags: ['test', 'sprint74'] },
      });
      expect(result.saved?.name).toBe('test-tagged-schema');

      // Regression teeth: the { name, tags } save round-trips through load/list from the SAME
      // temp root (a shallow result.saved.name check alone never proved the tags persisted).
      const loaded = await schemaLoadHandle({ name: 'test-tagged-schema' });
      expect(loaded.tags).toEqual(['test', 'sprint74']);
      const listed = await schemaListHandle({ tags: ['sprint74'] });
      expect(listed.map((entry) => entry.name)).toContain('test-tagged-schema');
    } finally {
      delete process.env.MCP_SCHEMA_STORE_ROOT;
      delete process.env.MCP_SCHEMA_STORE_DIR;
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('pipeline save object persists tags through schema load/list', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-pipeline-contract-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;

    try {
      const result = await pipelineHandle({
        object: 'Product',
        context: 'card',
        framework: 'html',
        save: { name: 'test-tagged-schema', tags: ['receipt', 'transaction'] },
      });

      expect(result.saved?.name).toBe('test-tagged-schema');

      const loaded = await schemaLoadHandle({ name: 'test-tagged-schema' });
      expect(loaded.tags).toEqual(['receipt', 'transaction']);

      const listed = await schemaListHandle({ tags: ['receipt'] });
      expect(listed.map((entry) => entry.name)).toContain('test-tagged-schema');
    } finally {
      delete process.env.MCP_SCHEMA_STORE_ROOT;
      delete process.env.MCP_SCHEMA_STORE_DIR;
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
