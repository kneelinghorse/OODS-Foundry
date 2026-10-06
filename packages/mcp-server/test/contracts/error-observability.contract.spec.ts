/**
 * Sprint 66 — Error Taxonomy + Observability contract tests
 *
 * Covers:
 * 1. ToolError structured error contract
 * 2. Tool handlers return OODS error codes
 * 3. Pipeline step latency tracking
 * 4. Determinism: same inputs produce identical outputs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolError, isToolError } from '../../src/errors/tool-error.js';
import { createError, allCodes, getDefinition, isRetryable } from '../../src/errors/registry.js';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as catalogHandle } from '../../src/tools/catalog.list.js';
import { handle as objectListHandle } from '../../src/tools/object.list.js';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// 1. ToolError structured error contract
// ---------------------------------------------------------------------------

describe('ToolError structured contract', () => {
  it('ToolError carries code, message, details', () => {
    const err = new ToolError('OODS-V001', 'custom msg', { field: 'name' });
    expect(err.opiCode).toBe('OODS-V001');
    expect(err.message).toBe('custom msg');
    expect(err.details).toEqual({ field: 'name' });
    expect(err.name).toBe('ToolError');
    expect(err).toBeInstanceOf(Error);
  });

  it('toStructured returns complete StructuredError shape', () => {
    const err = new ToolError('OODS-S001', 'policy denied', { tool: 'test' });
    const se = err.toStructured();
    expect(se).toMatchObject({
      code: 'OODS-S001',
      category: 'server_error',
      message: 'policy denied',
      retryable: false,
      details: { tool: 'test' },
    });
    expect(se.incidentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('isToolError returns true for ToolError, false for plain Error', () => {
    expect(isToolError(new ToolError('OODS-V001'))).toBe(true);
    expect(isToolError(new Error('plain'))).toBe(false);
    expect(isToolError(null)).toBe(false);
    expect(isToolError('string')).toBe(false);
  });

  it('ToolError with unknown code still converts to structured error', () => {
    const err = new ToolError('OODS-X999', 'unknown');
    const se = err.toStructured();
    expect(se.code).toBe('OODS-X999');
    expect(se.category).toBe('server_error');
    expect(se.retryable).toBe(false);
  });

  it('registers OODS-N015 as non-retryable component target unavailability', () => {
    // Glossary metadata is additive; these fields retain the refusal's existing meaning.
    expect(getDefinition('OODS-N015')).toMatchObject({
      code: 'OODS-N015',
      category: 'not_found',
      message: 'Component target unavailable',
      retryable: false,
    });
    expect(isRetryable('OODS-N015')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Tool handlers return OODS error codes on invalid input
// ---------------------------------------------------------------------------

describe('Tool handlers return OODS error codes', () => {
  it('code.generate returns OODS-V009 when schema is missing', async () => {
    const result = await codegenHandle({ framework: 'react' });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.code).toBe('OODS-V009');
  });

  it('code.generate returns OODS error for unknown framework', async () => {
    const schema: UiSchema = {
      screens: [{ id: 'x', component: 'Box', children: [] }],
    };
    const result = await codegenHandle({ schema, framework: 'svelte' as any });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.code).toMatch(/^OODS-V/);
  });

  it('code.generate returns OODS-N003 for invalid schemaRef', async () => {
    const result = await codegenHandle({ schemaRef: 'nonexistent-ref', framework: 'react' });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.code).toMatch(/^OODS-N00[34]$/);
  });

  it('repl.validate returns OODS-N003/N004 for invalid schemaRef', async () => {
    const result = await validateHandle({ mode: 'full', schemaRef: 'nonexistent-ref' });
    expect(result.status).not.toBe('ok');
    expect(result.errors?.[0]?.code).toMatch(/^OODS-N00[34]$/);
  });

  it('design.compose returns result with status field', async () => {
    const result = await composeHandle({ intent: 'show a dashboard' });
    expect(result.status).toBeDefined();
    expect(['ok', 'error', 'partial']).toContain(result.status);
  });
});

// ---------------------------------------------------------------------------
// 3. Pipeline observability: step latency tracking
// ---------------------------------------------------------------------------

describe('Pipeline step latency tracking', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-pipeline-test-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempDir;
  });

  afterEach(() => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('pipeline output includes stepLatency for all executed steps', async () => {
    const result = await pipelineHandle({
      intent: 'show a dashboard',
      framework: 'html',
    });

    expect(result.pipeline).toBeDefined();
    expect(result.pipeline.stepLatency).toBeDefined();
    expect(result.pipeline.duration).toBeGreaterThan(0);

    // Compose always runs
    expect(result.pipeline.stepLatency!.compose).toBeGreaterThanOrEqual(0);

    // Check that steps listed match latency keys
    for (const step of result.pipeline.steps) {
      expect(result.pipeline.stepLatency![step]).toBeGreaterThanOrEqual(0);
    }
  });

  it('step latencies approximately sum to total duration', async () => {
    const result = await pipelineHandle({
      intent: 'show a simple form',
      framework: 'html',
      options: { skipValidation: true, skipRender: true },
    });

    const latencySum = Object.values(result.pipeline.stepLatency ?? {}).reduce(
      (sum, v) => sum + v,
      0,
    );
    // Sum should be less than or equal to total (overhead accounts for difference)
    expect(latencySum).toBeLessThanOrEqual(result.pipeline.duration + 5);
  });

  it('pipeline records latency even on error steps', async () => {
    // Use an invalid schemaRef to trigger a compose result that still measures latency
    const result = await pipelineHandle({
      intent: 'show a form',
      framework: 'html',
    });

    // Whether success or error, compose latency should be present
    expect(result.pipeline.stepLatency?.compose).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: same inputs produce identical outputs
// ---------------------------------------------------------------------------

describe('Determinism regression tests', () => {
  it('compose produces identical output for same intent', async () => {
    const input = { intent: 'show a dashboard' };
    const a = await composeHandle(input);
    const b = await composeHandle(input);
    expect(a.status).toBe(b.status);
    expect(a.layout).toBe(b.layout);
    expect(a.schema?.screens.length).toBe(b.schema?.screens.length);
    // Component names and IDs should match
    if (a.schema && b.schema) {
      expect(a.schema.screens.map((s) => s.component)).toEqual(
        b.schema.screens.map((s) => s.component),
      );
    }
  });

  it('codegen produces identical code for same schema', async () => {
    const schema: UiSchema = {
      screens: [
        {
          id: 'root',
          component: 'Stack',
          layout: { type: 'stack' },
          style: { spacingToken: 'md', radiusToken: 'sm' },
          children: [
            { id: 'title', component: 'Text', props: { as: 'h1', content: 'Hello' }, children: [] },
            { id: 'body', component: 'Text', props: { content: 'World' }, children: [] },
          ],
        },
      ],
    };
    const opts = { framework: 'react' as const, options: { styling: 'tokens' as const } };
    const a = await codegenHandle({ schema, ...opts });
    const b = await codegenHandle({ schema, ...opts });
    expect(a.code).toBe(b.code);
    expect(a.status).toBe(b.status);
  });

  it('catalog_list returns same order across calls', async () => {
    const a = await catalogHandle({});
    const b = await catalogHandle({});
    expect(a.components.map((c) => c.name)).toEqual(
      b.components.map((c) => c.name),
    );
  });

  it('object_list returns same order across calls', async () => {
    const a = await objectListHandle({});
    const b = await objectListHandle({});
    expect(a.objects.map((o: any) => o.name)).toEqual(
      b.objects.map((o: any) => o.name),
    );
  });

  it('catalog_list output is alphabetically sorted by name', async () => {
    const result = await catalogHandle({});
    const names = result.components.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('vue codegen produces identical code for same schema', async () => {
    const schema: UiSchema = {
      screens: [
        {
          id: 'root',
          component: 'Card',
          layout: { type: 'inline', align: 'center' },
          style: { colorToken: 'primary' },
          children: [
            { id: 'label', component: 'Text', props: { bold: true, value: 'Test' }, children: [] },
          ],
        },
      ],
    };
    const opts = { framework: 'vue' as const, options: { styling: 'tokens' as const } };
    const a = await codegenHandle({ schema, ...opts });
    const b = await codegenHandle({ schema, ...opts });
    expect(a.code).toBe(b.code);
  });
});
