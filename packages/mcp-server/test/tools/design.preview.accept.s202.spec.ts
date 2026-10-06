import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { getAjv } from '../../src/lib/ajv.js';
import { acceptedPath, readAccepted, readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import outputSchema from '../../src/schemas/design.preview.output.json' with { type: 'json' };
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as preview } from '../../src/tools/design.preview.js';

/**
 * Accepting a version (s202-m04): design.preview action accept records compositionId@version in the composition's
 * accepted.json with when, the heads, the schema hash and a snapshot of the measurements the version carries. Each
 * acceptance is written once; a later one supersedes the standing one with lineage; the standing version cannot be
 * accepted again and a version never generated cannot be accepted at all. versions and the browser page's host name it.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const runtimeDir = path.join(root, 'packages/mcp-bridge/dist/preview-runtime');
let storeRoot: string;
const servers: FastifyInstance[] = [];

async function host(compositionsDir: string): Promise<string> {
  const server = Fastify();
  servers.push(server);
  await registerPreviewHost(server, { compositionsDir, runtimeDir });
  await server.listen({ port: 0, host: '127.0.0.1' });
  const address = server.server.address();
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
}
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-design-preview-accept-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(async () => { vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('design.preview action accept records the accepted version with its measurements (s202-m04)', () => {
  it('writes each acceptance once with the measurements snapshot, supersedes with lineage, refuses the standing version, and names it in versions and on the page', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const context = { previewHostUrl: hostUrl };
    const validate = getAjv().compile(outputSchema);
    const card = await preview({ object: 'Subscription', context: 'card' }, context);
    if (card.action !== 'render') throw new Error('render expected');
    const id = card.compositionId;
    const v1 = await readVersion(compositionsDir, id, 1);

    const first = await preview({ action: 'accept', compositionId: id, version: 1 }, context);
    expect(validate(first), JSON.stringify(validate.errors)).toBe(true);
    if (first.action !== 'accept') throw new Error('accept expected');
    expect(first).toMatchObject({ status: 'ok', compositionId: id, version: 1, parentVersion: null, operation: 'compose', object: 'Subscription', context: 'card', acceptances: 1, acceptedPath: acceptedPath(compositionsDir, id), previewUrl: `${hostUrl}/preview/${id}/1` });
    // The snapshot is what the version stored when it was accepted: the receipts and certifications as they are on the version.
    expect(first.accepted).toMatchObject({ version: 1, supersedes: null, schemaHash: v1.schemaHash, versionHead: v1.head, scopeCharts: {} });
    expect(first.accepted.measurements).toEqual(v1.measurements);
    expect(first.accepted.measured).toMatchObject({ validation: ['react', 'vue'] });

    // The standing version is refused and nothing is written.
    const before = fs.readFileSync(acceptedPath(compositionsDir, id), 'utf8');
    await expect(preview({ action: 'accept', compositionId: id, version: 1 }, context)).rejects.toMatchObject({ opiCode: 'OODS-V205' });
    expect(fs.readFileSync(acceptedPath(compositionsDir, id), 'utf8')).toBe(before);

    // A new version accepted at the latest by default supersedes the first; the first entry stays as it was written.
    const edited = await preview({ action: 'edit', compositionId: id, version: 1, edit: { operation: 'seed', seed: 's202-m04-accept' } }, context);
    if (edited.action !== 'edit') throw new Error('edit expected');
    const second = await preview({ action: 'accept', compositionId: id }, context);
    expect(validate(second), JSON.stringify(validate.errors)).toBe(true);
    if (second.action !== 'accept') throw new Error('accept expected');
    expect(second).toMatchObject({ version: edited.version, parentVersion: 1, operation: 'seed', acceptances: 2 });
    expect(second.accepted.supersedes).toEqual({ version: 1, acceptedAt: first.accepted.acceptedAt });
    const record = await readAccepted(compositionsDir, id);
    expect(record!.acceptances).toEqual([first.accepted, second.accepted]);
    // An acceptance is not a version.
    expect(fs.readdirSync(path.join(compositionsDir, id, 'versions')).filter(name => name.endsWith('.json')).sort()).toEqual(['1.json', '2.json']);

    const versions = await preview({ action: 'versions', compositionId: id }, context);
    expect(validate(versions), JSON.stringify(validate.errors)).toBe(true);
    expect(versions).toMatchObject({ action: 'versions', latest: 2, accepted: { version: 2, acceptedAt: second.accepted.acceptedAt, acceptances: 2 } });
    // The browser page's host reads the same record.
    expect(await (await fetch(`${hostUrl}/preview/${id}/versions.json`)).json()).toMatchObject({ accepted: { version: 2, acceptances: 2, supersedes: { version: 1 } } });
    expect(await (await fetch(`${hostUrl}/preview/${id}/2`)).text()).toContain('data-oods-accepted="this"');
  }, 180_000);

  it('refuses a version that was never generated, writes nothing, and versions names no acceptance', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const context = { previewHostUrl: hostUrl };
    const composed = await compose({ object: 'Subscription', context: 'card' });
    expect(composed.status).toBe('ok');
    const id = composed.compositionId!;
    await expect(preview({ action: 'accept', compositionId: id, version: 1 }, context)).rejects.toMatchObject({ opiCode: 'OODS-V205', message: expect.stringMatching(/has not been generated/) });
    expect(fs.existsSync(acceptedPath(compositionsDir, id))).toBe(false);
    expect(await preview({ action: 'versions', compositionId: id }, context)).toMatchObject({ action: 'versions', accepted: null });
  }, 120_000);
});
