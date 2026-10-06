import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerPreviewHost } from './host.js';
import { renderEditControls } from './shell.js';
import type { CompositionVersion, PreviewArtifact } from './store.js';

const runtimeDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dist/preview-runtime');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const ID = 'cmp-0123456789ab';
type Fixture = { compose: CompositionVersion['compose']; brand: CompositionVersion['brand']; theme: CompositionVersion['theme']; schema: { screens: Array<{ id: string; component: string; children?: unknown[] }> }; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-list.json', import.meta.url), 'utf8')) as Fixture;
const version = (): CompositionVersion => ({
  recordVersion: '1', compositionId: ID, version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: null,
  compose: raw.compose, schema: raw.schema, schemaHash: 'sha256:' + 'a'.repeat(64), brand: 'A', theme: 'light',
  slots: [{ slotName: 'search', selectedComponent: 'SearchInput', candidates: ['SearchInput', 'Input', 'DatePicker'] }, { slotName: 'items', selectedComponent: 'StatusBadge', candidates: ['StatusBadge'] }], model: raw.model,
  artifacts: { react: { artifact: raw.frameworks.react.artifact, generatedAt: '2026-09-15T00:00:00.000Z' }, vue: { artifact: raw.frameworks.vue.artifact, generatedAt: '2026-09-15T00:00:00.000Z' } }, measurements: {},
});
async function host(record: CompositionVersion, runTool?: (tool: string, input: Record<string, unknown>) => Promise<unknown>) {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), 'oods-edit-')), 'compositions'); directories.push(path.dirname(dir));
  const folder = path.join(dir, ID, 'versions'); mkdirSync(folder, { recursive: true }); writeFileSync(path.join(folder, '1.json'), JSON.stringify(record));
  const server = Fastify(); servers.push(server);
  await registerPreviewHost(server, { compositionsDir: dir, runtimeDir, runTool });
  return { server, dir };
}

describe('edits from the page (s201-m05)', () => {
  it('renders the four controls from the version: regions in order, slots with the composer candidates, fields per region, the seed', () => {
    const html = renderEditControls(version());
    const regions = raw.schema.screens[0]!.children!.map(node => (node as { id: string }).id);
    expect(html).toContain(`data-regions="${JSON.stringify(regions).replace(/"/g, '&quot;')}"`);
    expect(html).toContain('data-kind="region" data-index="0" data-delta="-1" aria-label="Move ' + regions[0] + ' up" disabled');
    expect(html).toContain('<form data-edit="swap-slot" data-slot="search" data-current="SearchInput">');
    expect(html).toContain('<option value="Input">Input</option>');
    expect(html).not.toContain('data-slot="items"');
    expect(html).toContain('<form data-edit="seed" data-current="">');
    expect(html).toMatch(/data-fields="\[&quot;/);
  });

  it('posts one operation to the host, which re-composes through the native tool and answers the new version to open', async () => {
    const calls: Array<{ tool: string; input: Record<string, unknown> }> = [];
    const { server } = await host(version(), async (tool, input) => { calls.push({ tool, input }); return { compositionId: ID, version: 2, parentVersion: 1, operation: input.edit && (input.edit as { operation: string }).operation, previewUrl: `http://127.0.0.1:1/preview/${ID}/2` }; });
    const response = await server.inject({ method: 'POST', url: `/preview/${ID}/1/edit`, payload: { operation: 'swap-slot', slot: 'search', component: 'Input', framework: 'vue', brand: 'B', theme: 'dark' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ compositionId: ID, version: 2, parentVersion: 1, operation: 'swap-slot', url: `/preview/${ID}/2?framework=vue&brand=B&theme=dark` });
    expect(calls).toEqual([{ tool: 'design.preview', input: { action: 'edit', compositionId: ID, version: 1, edit: { operation: 'swap-slot', slot: 'search', component: 'Input' } } }]);
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/1/edit`, payload: { slot: 'search' } })).statusCode).toBe(400);
    expect((await server.inject({ method: 'POST', url: `/preview/${ID}/2/edit`, payload: { operation: 'seed', seed: 'x' } })).statusCode).toBe(404);
    expect((await server.inject(`/preview/${ID}/1`)).body).toContain('data-oods-edit="true"');
  });

  it('relays a typed native refusal as 422 with the native error, and answers 501 without a native tool', async () => {
    const refused = await host(version(), async () => { throw Object.assign(new Error('not applicable'), { nativeError: { code: 'OODS-V204', message: 'design.preview action edit: Table is not one of the candidates', details: { candidates: ['SearchInput', 'Input'] } } }); });
    const response = await refused.server.inject({ method: 'POST', url: `/preview/${ID}/1/edit`, payload: { operation: 'swap-slot', slot: 'search', component: 'Table' } });
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({ code: 'OODS-V204' });
    await refused.server.close(); servers.splice(0);
    const bare = await host(version());
    expect((await bare.server.inject({ method: 'POST', url: `/preview/${ID}/1/edit`, payload: { operation: 'seed', seed: 'x' } })).statusCode).toBe(501);
  });
});
