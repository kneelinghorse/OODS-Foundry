// @ts-expect-error -- shared naming and reference helpers are native ESM.
import { toolReferences } from '../../../../scripts/runtime/tool-names.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import catalogOutputSchema from '../../src/schemas/catalog.list.output.json' assert { type: 'json' };
import pipelineOutputSchema from '../../src/schemas/pipeline.output.json' assert { type: 'json' };
import { handle as catalogHandle } from '../../src/tools/catalog.list.js';
import { createValidationReceipt } from '../../src/codegen/validation-profile.js';
import type { CatalogListOutput } from '../../src/tools/types.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ajv = getAjv();
const validateCatalogOutput = ajv.compile(catalogOutputSchema);
const validatePipelineOutput = ajv.compile(pipelineOutputSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const codeConnectPathEnv = 'MCP_CODE_CONNECT_PATH';

describe('Sprint 71 fixes', () => {
  let originalCodeConnectPathEnv: string | undefined;
  let codeConnectTmpDir: string;

  beforeAll(() => {
    originalCodeConnectPathEnv = process.env[codeConnectPathEnv];
    codeConnectTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s71-code-connect-'));
    process.env[codeConnectPathEnv] = path.join(codeConnectTmpDir, 'code-connect.json');
  });

  afterAll(() => {
    if (originalCodeConnectPathEnv === undefined) {
      delete process.env[codeConnectPathEnv];
    } else {
      process.env[codeConnectPathEnv] = originalCodeConnectPathEnv;
    }

    fs.rmSync(codeConnectTmpDir, { recursive: true, force: true });
  });

  // ── catalog.list availableCategories ────────────────────────────────

  describe('catalog.list availableCategories', () => {
    it('returns availableCategories as a sorted string array', async () => {
      const result = await catalogHandle({});
      expect(result.availableCategories).toBeDefined();
      expect(Array.isArray(result.availableCategories)).toBe(true);
      expect(result.availableCategories.length).toBeGreaterThan(0);

      // Verify sorted
      const sorted = [...result.availableCategories].sort();
      expect(result.availableCategories).toEqual(sorted);
    });

    it('includes known categories', async () => {
      const result = await catalogHandle({});
      expect(result.availableCategories).toContain('core');
      expect(result.availableCategories).toContain('behavioral');
    });

    it('returns same availableCategories regardless of filter', async () => {
      const unfiltered = await catalogHandle({});
      const filtered = await catalogHandle({ category: 'core' });
      expect(filtered.availableCategories).toEqual(unfiltered.availableCategories);
    });

    it('passes output schema validation with availableCategories', async () => {
      const result = await catalogHandle({});
      const valid = validateCatalogOutput(result);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Schema validation errors:', validateCatalogOutput.errors);
      }
    });
  });

  // ── pipeline output schema includes TTL fields ─────────────────────

  describe('pipeline output schema TTL fields', () => {
    it('pipeline output schema allows schemaRefCreatedAt', () => {
      const sample = {
        validationReceipt: createValidationReceipt('build', 'react'),
        compose: { layout: 'auto', componentCount: 1 },
        pipeline: { steps: ['compose'], duration: 100 },
        schemaRef: 'ref:test',
        schemaRefCreatedAt: '2026-03-05T00:00:00.000Z',
        schemaRefExpiresAt: '2026-03-05T00:30:00.000Z',
      };
      expect(validatePipelineOutput(sample)).toBe(true);
    });

    it('pipeline output schema still valid without TTL fields', () => {
      const sample = {
        validationReceipt: createValidationReceipt('build', 'react'),
        compose: { layout: 'auto', componentCount: 1 },
        pipeline: { steps: ['compose'], duration: 100 },
        schemaRef: 'ref:test',
      };
      expect(validatePipelineOutput(sample)).toBe(true);
    });
  });

  // ── tool-descriptions.json ─────────────────────────────────────────

  describe('tool-descriptions.json documentation', () => {
    let descriptions: Record<string, string>;

    beforeAll(() => {
      descriptions = toolReferences();
    });

    it('documents apply defaults for tools that use apply param', () => {
      // s107-m01b: map.apply/map.create/repl.render consolidated into the grouped map/repl tools.
      const toolsWithApply = ['tokens.build', 'brand.apply', 'map', 'repl'];
      for (const tool of toolsWithApply) {
        expect(descriptions[tool]).toBeDefined();
        expect(descriptions[tool].toLowerCase()).toMatch(/apply/);
      }
    });

    it('documents schemaRef TTL for compose tools', () => {
      expect(descriptions['design.compose']).toMatch(/TTL|expires|30/i);
      expect(descriptions['pipeline']).toMatch(/TTL|expires|30/i);
    });

    it('documents schema (action=save) as persistence path', () => {
      expect(descriptions['schema']).toMatch(/persist|TTL/i);
    });

    it('documents availableCategories for catalog.list', () => {
      expect(descriptions['catalog.list']).toMatch(/availableCategories|categories/i);
    });
  });
});
