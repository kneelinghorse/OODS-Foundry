import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { expect, it, vi } from 'vitest';
import { handle as intake } from '../../src/tools/brand.intake.js';
import { handle as apply } from '../../src/tools/brand.apply.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { refreshTokenBundle, tokenCssHash, tokenPackageRoot } from '../../src/lib/token-build.js';
import { resetTokensCssCache } from '../../src/render/document.js';
import { readVersion, writeVersion } from '../../src/lib/composition-store.js';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';

it('an actual team brand.apply flags a saved chart and reopening redraws both frameworks from the new build', async () => {
  const root = path.resolve(import.meta.dirname, '../../../..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-chart-token-build-'));
  const shipped = path.join(temp, 'tokens'), brands = path.join(temp, 'brands'), compositionsDir = path.join(temp, 'compositions');
  const server = Fastify();
  try {
    fs.mkdirSync(shipped);
    for (const name of ['src', 'scripts', 'dist', 'style-dictionary.config.cjs', 'package.json']) fs.cpSync(path.join(root, 'packages/tokens', name), path.join(shipped, name), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(shipped, 'node_modules'), 'dir');
    vi.stubEnv('MCP_BRAND_SOURCE_ROOT', shipped); vi.stubEnv('OODS_BRANDS_DIR', brands); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', temp); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas');
    const documents = JSON.parse(fs.readFileSync(path.join(root, 'tests/tokens/fixtures/team-brand/harbor.tokens.json'), 'utf8'));
    documents.base.text.muted.$value = 'oklch(0.5 0.025 225)';
    await intake({ action: 'create', brand_id: 'Harbor', documents });
    const points = [{ week: 'One', stock: 2 }, { week: 'Two', stock: 4 }, { week: 'Three', stock: 9 }];
    const schema: any = { version: '2026.02', objectSchema: { points: { type: 'array', required: true } }, screens: [{ id: 'chart', component: 'VizLinePreview', props: { title: 'Recorded stock' }, chart: { chartType: 'line', source: 'record-array', dataField: 'points', encodings: { x: 'week', y: 'stock' }, sampleRows: points } }] };
    const compositionId = 'cmp-217217217217';
    await writeVersion(compositionsDir, { recordVersion: '1', compositionId, version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-25T00:00:00Z', head: null, schemaHash: `sha256:${createHash('sha256').update(JSON.stringify(schema)).digest('hex')}`, schema, brand: 'Harbor', theme: 'dark', compose: { context: 'detail' }, slots: [], model: { points }, artifacts: {}, measurements: {} } as any);
    await registerPreviewHost(server, { compositionsDir, tokensRoot: tokenPackageRoot, runtimeDir: path.join(root, 'packages/mcp-bridge/dist/preview-runtime') });
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address() as { port: number }, previewHostUrl = `http://127.0.0.1:${address.port}`;
    await preview({ compositionId }, { previewHostUrl });
    const before = await readVersion(compositionsDir, compositionId, 1), beforeHash = tokenCssHash();
    const result = await apply({ brand: 'Harbor', apply: true, delta: { dark: { color: { brand: { Harbor: { text: { primary: { $value: 'oklch(0.97 0.01 60)' } } } } } } } } as any);
    expect(result.receipt.build?.exitCode).toBe(0); expect(tokenCssHash()).not.toBe(beforeHash);
    for (const framework of ['react', 'vue'] as const) {
      const response = await server.inject(`/preview/${compositionId}/1/scope.json?framework=${framework}&brand=Harbor&theme=dark`);
      expect(response.json()).toMatchObject({ staleTokens: true, tokenBuildHash: beforeHash });
      const app = await server.inject(`/preview/${compositionId}/1/app?framework=${framework}&brand=Harbor&theme=dark`);
      expect(app.body).toContain('id="oods-token-build-notice" role="status">');
    }
    await preview({ compositionId }, { previewHostUrl });
    const after = await readVersion(compositionsDir, compositionId, 1);
    for (const framework of ['react', 'vue'] as const) {
      const current = after.artifacts[framework]!, previous = before.artifacts[framework]!;
      expect(current.tokenBuildHash).toBe(tokenCssHash());
      const svgs = current.artifact.files.filter(file => file.path.endsWith('.svg'));
      // Three sizes in each of light, dark and hc (s222-m02, F7).
      expect(svgs).toHaveLength(9);
      expect(svgs.map(file => file.contents)).not.toEqual(previous.artifact.files.filter(file => file.path.endsWith('.svg')).map(file => file.contents));
      expect((await server.inject(`/preview/${compositionId}/1/scope.json?framework=${framework}&brand=Harbor&theme=dark`)).json()).toMatchObject({ staleTokens: false, tokenBuildHash: tokenCssHash() });
    }
    expect(after.schemaHash).toBe(before.schemaHash);
  } finally {
    await server.close(); vi.unstubAllEnvs(); await refreshTokenBundle(); resetTokensCssCache(); fs.rmSync(temp, { recursive: true, force: true });
  }
}, 180_000);
