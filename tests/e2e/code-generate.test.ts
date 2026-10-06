/**
 * E2E integration test for code.generate through the MCP bridge.
 *
 * Verifies:
 * - Tool is registered in registry and policy
 * - Bridge tool name translation works (code.generate ↔ code_generate)
 * - Round-trip: validate → render → code.generate produces consistent output
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { buildToolNameMaps, resolveInternalToolName } from '../../packages/mcp-bridge/src/tool-names.js';
import { handle as handleValidate } from '../../packages/mcp-server/src/tools/repl.validate.js';
import { handle as handleRender } from '../../packages/mcp-server/src/tools/repl.render.js';
import { handle as handleCodeGen } from '../../packages/mcp-server/src/tools/code.generate.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..');

type RegistryDoc = { auto: string[]; onDemand: string[] };
type PolicyDoc = { rules: Array<{ tool: string; readOnly?: boolean; additive?: boolean; writes?: string[]; allow?: string[] }> };

function readJson<T>(repoRelativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, repoRelativePath), 'utf8')) as T;
}

// ---------------------------------------------------------------------------
// Registration contracts
// ---------------------------------------------------------------------------

describe('code.generate E2E — registration', () => {
  it('is listed in registry.json auto tools', () => {
    const registry = readJson<RegistryDoc>('packages/mcp-server/src/tools/registry.json');
    expect(registry.auto).toContain('code.generate');
  });

  it('has a policy rule in policy.json', () => {
    const policy = readJson<PolicyDoc>('packages/mcp-server/src/security/policy.json');
    const rule = policy.rules.find((r) => r.tool === 'code.generate');
    expect(rule).toBeDefined();
    // s213-m02 (#2351): file payload mode writes a new payload directory, so the policy declares an additive writer and
    // clients are no longer told the tool is read-only.
    expect(rule!.readOnly).toBeUndefined();
    expect(rule!.additive).toBe(true);
    expect(rule!.writes).toEqual(['.oods/payloads/**']);
    expect(rule!.allow).toContain('designer');
    expect(rule!.allow).toContain('maintainer');
  });

  it('has input and output JSON schemas', () => {
    const inputPath = path.join(REPO_ROOT, 'packages/mcp-server/src/schemas/code.generate.input.json');
    const outputPath = path.join(REPO_ROOT, 'packages/mcp-server/src/schemas/code.generate.output.json');
    expect(fs.existsSync(inputPath)).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);

    const inputSchema = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    expect(inputSchema.required).toContain('framework');
    expect(inputSchema.required).not.toContain('schema');
    expect(inputSchema.required).not.toContain('schemaRef');
    expect(inputSchema.properties).toHaveProperty('schema');
    expect(inputSchema.properties).toHaveProperty('schemaRef');
    const anyOf = inputSchema.allOf?.[0]?.anyOf;
    expect(Array.isArray(anyOf)).toBe(true);
    const requiredSets = (anyOf ?? [])
      .map((entry: { required?: string[] }) => entry?.required)
      .filter((req: string[] | undefined): req is string[] => Array.isArray(req));
    expect(requiredSets).toEqual(expect.arrayContaining([['schema'], ['schemaRef']]));
  });
});

// ---------------------------------------------------------------------------
// Bridge tool-name translation
// ---------------------------------------------------------------------------

describe('code.generate E2E — bridge parity', () => {
  it('translates code.generate to code_generate and back', () => {
    const maps = buildToolNameMaps(['code.generate', 'repl.render', 'repl.validate']);

    expect(maps.allowedExternalTools.has('code_generate')).toBe(true);
    expect(resolveInternalToolName('code_generate', maps.externalToInternal)).toBe('code.generate');
    expect(resolveInternalToolName('code.generate', maps.externalToInternal)).toBe('code.generate');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: validate → render → code.generate
// ---------------------------------------------------------------------------

const ROUND_TRIP_SCHEMA: UiSchema = {
  version: '1.0.0',
  screens: [
    {
      id: 'dash-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'lg' },
      style: { spacingToken: 'md' },
      children: [
        {
          id: 'header',
          component: 'Stack',
          children: [
            { id: 'title', component: 'Text', props: { as: 'h1', content: 'Dashboard' } },
          ],
        },
        {
          id: 'grid-section',
          component: 'Grid',
          layout: { type: 'grid' },
          children: [
            {
              id: 'card-1',
              component: 'Card',
              children: [{ id: 'card-1-title', component: 'Text', props: { content: 'Metric A' } }],
            },
            {
              id: 'card-2',
              component: 'Card',
              children: [{ id: 'card-2-title', component: 'Text', props: { content: 'Metric B' } }],
            },
            {
              id: 'card-3',
              component: 'Card',
              children: [{ id: 'card-3-title', component: 'Text', props: { content: 'Metric C' } }],
            },
          ],
        },
        {
          id: 'actions',
          component: 'Stack',
          layout: { type: 'inline', align: 'end' },
          children: [
            { id: 'cancel-btn', component: 'Button', props: { label: 'Cancel' } },
            { id: 'save-btn', component: 'Button', props: { label: 'Save', type: 'submit' } },
          ],
        },
      ],
    },
  ],
};

describe('code.generate E2E — round-trip pipeline', () => {
  it('validate → render → code.generate (React) is consistent', async () => {
    // Step 1: Validate
    const validateResult = await handleValidate({ mode: 'full', schema: ROUND_TRIP_SCHEMA });
    expect(validateResult.status).toBe('ok');
    expect(validateResult.errors.length).toBe(0);

    // Step 2: Render HTML
    const renderResult = await handleRender({
      mode: 'full',
      schema: ROUND_TRIP_SCHEMA,
      apply: true,
    });
    expect(renderResult.status).toBe('ok');
    expect(renderResult.html).toBeDefined();

    // Step 3: Generate React code
    const reactResult = await handleCodeGen({
      schema: ROUND_TRIP_SCHEMA,
      framework: 'react',
    });
    expect(reactResult.status).toBe('ok');
    expect(reactResult.code.length).toBeGreaterThan(0);

    // Verify all components from the schema appear in the React output
    expect(reactResult.code).toContain('Stack');
    expect(reactResult.code).toContain('Stack');
    expect(reactResult.code).toContain('Text');
    expect(reactResult.code).toContain('Grid');
    expect(reactResult.code).toContain('Card');
    expect(reactResult.code).toContain('Button');

    // Verify layout tokens are translated (t-shirt sizes → scale-<size> leaf, sprint-125 m03)
    expect(reactResult.code).toContain('var(--ref-space-scale-lg)');
    expect(reactResult.code).toContain('var(--ref-space-scale-md)');
  });

  it('validate → render → code.generate (Vue) is consistent', async () => {
    const validateResult = await handleValidate({ mode: 'full', schema: ROUND_TRIP_SCHEMA });
    expect(validateResult.status).toBe('ok');

    const vueResult = await handleCodeGen({
      schema: ROUND_TRIP_SCHEMA,
      framework: 'vue',
    });
    expect(vueResult.status).toBe('ok');
    expect(vueResult.code).toContain('<template>');
    expect(vueResult.code).toContain('<script setup');
    expect(vueResult.code).toContain('Stack');
    expect(vueResult.code).toContain('Button');
  });

  it('code.generate HTML matches repl.render for round-trip schema', async () => {
    const htmlResult = await handleCodeGen({
      schema: ROUND_TRIP_SCHEMA,
      framework: 'html',
    });

    const renderResult = await handleRender({
      mode: 'full',
      schema: ROUND_TRIP_SCHEMA,
      apply: true,
      // repl.render now defaults compact; code.generate emits full CSS.
      output: { compact: false },
    });

    expect(htmlResult.status).toBe('ok');
    expect(renderResult.status).toBe('ok');
    expect(htmlResult.code).toBe(renderResult.html);
  });
});
