/**
 * Preserve the original bounded saved schema and the full Subscription operand.
 * The latter now generates after Sprint187; history is not rewritten or pruned.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import { handle as healthHandle } from '../../src/tools/health.js';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import { handle as schemaLoadHandle } from '../../src/tools/schema/load.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Tier 1 acceptance — bounded framework compatibility', () => {
  it('uses the saved Card/Stack/Tabs/Text schema successfully for React and Vue', async () => {
    const saved = JSON.parse(await fs.readFile(path.join(
      PACKAGE_ROOT,
      'test/fixtures/saved-schemas/tier1-acceptance-sub-detail.s182.json',
    ), 'utf8'));

    expect(saved.object).toBe('Subscription');
    expect(saved.context).toBe('detail');
    expect(saved.tags).toContain('bounded-foundation-v1');

    for (const framework of ['react', 'vue'] as const) {
      const result = await codegenHandle({
        schema: saved.schema,
        framework,
        options: { styling: 'tokens', typescript: true },
      });

      expect(result.status).toBe('ok');
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.code).toContain(
        framework === 'react' ? "from '@oods/components-react'" : "from '@oods/components-vue'",
      );
      expect(result.code).toContain("import '@oods/component-styles/css'");
      expect(result.code).toContain('Subscription details');
      expect(result.code).toContain('Current plan and renewal details');
      expect(result.code).toContain('Invoices and payment method');
      expect(result.meta).toEqual({ nodeCount: 6, componentCount: 4 });
    }
  });

  it.each(['react', 'vue'] as const)(
    'builds the unchanged Subscription detail %s flow after its final family port',
    async (framework) => {
      const result = await pipelineHandle({
        object: 'Subscription',
        context: 'detail',
        framework,
        styling: 'tailwind',
        options: { skipValidation: true, skipRender: true },
      });

      expect(result.error).toBeUndefined();
      expect(result.code?.framework).toBe(framework);
      // s221-m01: pipeline carries the code once, in its artifact's files, since s216-m05 (374a6eaec5, #2412).
      const source = result.code?.artifact.files.map(({ contents }) => contents).join('\n');
      expect(source).toContain('ArchiveSummary');
      expect(source).toContain(`@oods/components-${framework}`);
      expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    },
  );

  it('keeps a build-safe Subscription HTML save, load, and health path', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-tier1-html-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;

    try {
      const result = await pipelineHandle({
        object: 'Subscription',
        context: 'card',
        framework: 'html',
        styling: 'tokens',
        save: 's182-tier1-legacy-html',
      });

      expect(result.error).toBeUndefined();
      expect(result.code?.framework).toBe('html');
      expect(result.code?.artifact.files.find(({ path: file }) => file === 'index.html')?.contents).toContain('<!DOCTYPE html>');
      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen', 'save']);
      expect(result.saved?.name).toBe('s182-tier1-legacy-html');

      const loaded = await schemaLoadHandle({ name: 's182-tier1-legacy-html' });
      expect(loaded.name).toBe('s182-tier1-legacy-html');
      expect(loaded.schemaRef).toBeTruthy();
      expect(loaded.version).toBe(1);

      const health = await healthHandle();
      expect(['ok', 'degraded']).toContain(health.status);
      expect(health.schemas.savedCount).toBe(1);
    } finally {
      delete process.env.MCP_SCHEMA_STORE_ROOT;
      delete process.env.MCP_SCHEMA_STORE_DIR;
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
