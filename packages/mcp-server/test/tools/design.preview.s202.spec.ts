import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { getAjv } from '../../src/lib/ajv.js';
import { readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import outputSchema from '../../src/schemas/design.preview.output.json' with { type: 'json' };
import * as sampleData from '../../src/codegen/workflow-data-emitter.js';
import { handle as preview } from '../../src/tools/design.preview.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const runtimeDir = path.join(root, 'packages/mcp-bridge/dist/preview-runtime');
let storeRoot: string;
const servers: FastifyInstance[] = [];

/** A host like the bridge's; `native` gives it a runner that calls design.preview in-process, the way the standalone host owns one. */
async function host(compositionsDir: string, native = false): Promise<string> {
  const server = Fastify();
  servers.push(server);
  let url = '';
  await registerPreviewHost(server, { compositionsDir, runtimeDir, ...(native ? { runTool: (tool, input) => { if (tool !== 'design.preview') throw new Error(`unexpected tool ${tool}`); return preview(input as never, { previewHostUrl: url }); } } : {}) });
  await server.listen({ port: 0, host: '127.0.0.1' });
  const address = server.server.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  return url;
}
const sampleRecords = sampleData.workflowSampleRecords;
beforeEach(() => {
  // Chart-scope tests own explicit history; production's neutral seed deliberately has none (m05).
  vi.spyOn(sampleData, 'workflowSampleRecords').mockImplementation(schema => sampleRecords(schema).map(record => ({ ...record, payment_history: [{ at: '2026-08-01T00:00:00Z', amount: 9900 }, { at: '2026-09-01T00:00:00Z', amount: 10900 }] })));
  storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-design-preview-s202-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('a brand or theme switch renders and certifies the placed chart for that scope (s202-m01)', () => {
  it('generates and certifies a Subscription detail for B/dark on request, serves that module for the scope, and names the generated scope everywhere', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const context = { previewHostUrl: hostUrl };
    const base = await preview({ object: 'Subscription', context: 'detail' }, context);
    if (base.action !== 'render') throw new Error('render expected');
    const validate = getAjv().compile(outputSchema);
    expect(validate(base), JSON.stringify(validate.errors)).toBe(true);
    for (const entry of base.previews) expect(entry.generatedFor).toEqual({ brand: 'A', theme: 'light', chartScoped: true });
    expect(base.measured.charts.scopes).toEqual(['A/light']);
    const id = base.compositionId;
    const dark = await preview({ compositionId: id, version: 1, preferences: { brand: 'B', theme: 'dark' } }, context);
    if (dark.action !== 'render') throw new Error('render expected');
    expect(validate(dark), JSON.stringify(validate.errors)).toBe(true);
    expect(dark.previews.map(entry => entry.framework)).toEqual(['react', 'vue']);
    for (const [index, entry] of dark.previews.entries()) {
      expect(entry.generatedFor).toEqual({ brand: 'B', theme: 'dark', chartScoped: true });
      expect(entry.moduleUrl).toBe(`${hostUrl}/preview/${id}/1/module.js?framework=${entry.framework}&brand=B&theme=dark`);
      expect(entry.artifactContentHash).not.toBe(base.previews[index]!.artifactContentHash);
      expect(entry.compiled.sha256).not.toBe(base.previews[index]!.compiled.sha256);
    }
    expect(dark.measured.charts).toMatchObject({ placed: 1, conformant: 1, scopes: ['A/light', 'B/dark'] });
    const record = await readVersion(compositionsDir, id, 1);
    expect(Object.keys(record.scopes!)).toEqual(['B/dark']);
    expect(Object.keys(record.scopes!['B/dark']!.artifacts).sort()).toEqual(['react', 'vue']);
    const scopedCharts = record.scopes!['B/dark']!.charts as Array<{ path: string; brand: string; theme: string; svgHash: string; narrow: { path: string } }>;
    expect(scopedCharts).toHaveLength(1);
    // s222-m02 (F7): the scope's certified chart is its dark render, which sits beside the light and hc ones.
    expect(scopedCharts[0]).toMatchObject({ path: 'src/charts/payment-001.dark.svg', brand: 'B', theme: 'dark', narrow: { path: 'src/charts/payment-001.dark.narrow.svg' } });
    expect(scopedCharts[0]!.svgHash).not.toBe((record.measurements.charts as Array<{ svgHash: string }>)[0]!.svgHash);
    // The version's own artifacts and certification are untouched; the scoped SVG bytes differ from the generated scope's.
    expect(record.artifacts.react!.artifact.contentHash).toBe(base.previews[0]!.artifactContentHash);
    const own = record.artifacts.react!.artifact.files.find(file => file.path === 'src/charts/payment-001.svg')!.contents;
    const scoped = record.scopes!['B/dark']!.artifacts.react!.artifact.files.find(file => file.path === 'src/charts/payment-001.svg')!.contents;
    expect(scoped).not.toBe(own);
    // The host serves the scoped module for B/dark and the version's own for A/light, and says which.
    const light = await fetch(`${hostUrl}/preview/${id}/1/module.js?framework=react&brand=A&theme=light`);
    const darkModule = await fetch(`${hostUrl}/preview/${id}/1/module.js?framework=react&brand=B&theme=dark`);
    expect(light.headers.get('x-oods-generated-for')).toBe('A/light');
    expect(darkModule.headers.get('x-oods-generated-for')).toBe('B/dark');
    expect(darkModule.headers.get('x-oods-artifact-hash')).toBe(record.scopes!['B/dark']!.artifacts.react!.artifact.contentHash);
    expect(await darkModule.text()).not.toBe(await light.text());
    const app = await (await fetch(`${hostUrl}/preview/${id}/1/app?framework=react&brand=B&theme=dark`)).text();
    expect(app).toContain('"generatedFor":{"brand":"B","theme":"dark","chartScoped":true}');
    expect(app).toContain(`/preview/${id}/1/module.js?framework=react&brand=B&theme=dark`);
    // scope.json: the generated scope is available; a scope nobody generated is typed unavailable on a host without a native runner.
    const info = await (await fetch(`${hostUrl}/preview/${id}/1/scope.json?framework=vue&brand=B&theme=dark`)).json() as Record<string, unknown>;
    expect(info).toMatchObject({ available: true, chartScoped: true, framework: 'vue', generatedFor: { brand: 'B', theme: 'dark', chartScoped: true }, moduleUrl: `/preview/${id}/1/module.js?framework=vue&brand=B&theme=dark`, artifactContentHash: record.scopes!['B/dark']!.artifacts.vue!.artifact.contentHash });
    expect((info.charts as Array<{ brand: string; theme: string }>)[0]).toMatchObject({ brand: 'B', theme: 'dark' });
    const missing = await (await fetch(`${hostUrl}/preview/${id}/1/scope.json?framework=react&brand=A&theme=hc`)).json() as Record<string, unknown>;
    expect(missing).toMatchObject({ available: false, chartScoped: true, generatedFor: { brand: 'A', theme: 'light', chartScoped: true } });
    expect(String(missing.reason)).toMatch(/no native server/);
    // A second request for the same scope reuses the stored generation.
    const generatedAt = record.scopes!['B/dark']!.artifacts.react!.generatedAt;
    await preview({ compositionId: id, version: 1, framework: 'react', preferences: { brand: 'B', theme: 'dark' } }, context);
    expect((await readVersion(compositionsDir, id, 1)).scopes!['B/dark']!.artifacts.react!.generatedAt).toBe(generatedAt);
  }, 180_000);

  it('through a host with a native runner, scope.json generates the requested scope on first use; a version without a placed chart mounts the same artifact in every scope', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir, true);
    const context = { previewHostUrl: hostUrl };
    const card = await preview({ object: 'Subscription', context: 'card' }, context);
    if (card.action !== 'render') throw new Error('render expected');
    expect(card.previews[0]!.generatedFor).toEqual({ brand: 'A', theme: 'light', chartScoped: false });
    expect(card.measured.charts.scopes).toEqual([]);
    const cardDark = await preview({ compositionId: card.compositionId, preferences: { brand: 'B', theme: 'dark' } }, context);
    if (cardDark.action !== 'render') throw new Error('render expected');
    expect(cardDark.previews[0]!.generatedFor).toEqual({ brand: 'B', theme: 'dark', chartScoped: false });
    expect(cardDark.previews[0]!.artifactContentHash).toBe(card.previews[0]!.artifactContentHash);
    expect((await readVersion(compositionsDir, card.compositionId, 1)).scopes).toBeUndefined();
    const cardScope = await (await fetch(`${hostUrl}/preview/${card.compositionId}/1/scope.json?framework=react&brand=B&theme=hc`)).json() as Record<string, unknown>;
    expect(cardScope).toMatchObject({ available: true, chartScoped: false, generatedFor: { brand: 'B', theme: 'hc', chartScoped: false }, charts: [] });
    const detail = await preview({ object: 'Subscription', context: 'detail', framework: 'vue' }, context);
    const info = await (await fetch(`${hostUrl}/preview/${detail.compositionId}/1/scope.json?framework=vue&brand=B&theme=hc`)).json() as Record<string, unknown>;
    expect(info).toMatchObject({ available: true, chartScoped: true, generatedFor: { brand: 'B', theme: 'hc', chartScoped: true }, moduleUrl: `/preview/${detail.compositionId}/1/module.js?framework=vue&brand=B&theme=hc` });
    const record = await readVersion(compositionsDir, detail.compositionId, 1);
    expect(Object.keys(record.scopes!['B/hc']!.artifacts)).toEqual(['vue']);
    expect(record.scopes!['B/hc']!.charts).toHaveLength(1);
    expect((info.charts as Array<{ brand: string; theme: string }>)[0]).toMatchObject({ brand: 'B', theme: 'hc' });
  }, 180_000);
});

it('redraws stale token-build charts for both frameworks in the base and requested scopes', async () => {
  const compositionsDir = resolveCompositionsDir();
  const context = { previewHostUrl: await host(compositionsDir) };
  const base = await preview({ object: 'Subscription', context: 'detail' }, context);
  const id = base.compositionId;
  await preview({ compositionId: id, preferences: { brand: 'B', theme: 'dark' } }, context);
  const filename = path.join(compositionsDir, id, 'versions/1.json');
  const record = await readVersion(compositionsDir, id, 1);
  for (const entries of [record.artifacts, record.scopes!['B/dark']!.artifacts]) for (const framework of ['react', 'vue'] as const) {
    expect(entries[framework]!.artifact.files.some(file => file.path.endsWith('.svg'))).toBe(true);
    entries[framework]!.tokenBuildHash = 'prior-token-build';
    entries[framework]!.generatedAt = '2000-01-01T00:00:00.000Z';
  }
  fs.writeFileSync(filename, JSON.stringify(record));
  await preview({ compositionId: id, preferences: { brand: 'B', theme: 'dark' } }, context);
  const fresh = await readVersion(compositionsDir, id, 1);
  const { tokenCssHash } = await import('../../src/lib/token-build.js');
  for (const entries of [fresh.artifacts, fresh.scopes!['B/dark']!.artifacts]) for (const framework of ['react', 'vue'] as const) {
    expect(entries[framework]!.tokenBuildHash).toBe(tokenCssHash());
    expect(entries[framework]!.generatedAt).not.toBe('2000-01-01T00:00:00.000Z');
  }
  expect(fresh.version).toBe(record.version); expect(fresh.schemaHash).toBe(record.schemaHash);
}, 180_000);
