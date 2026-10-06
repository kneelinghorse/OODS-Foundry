import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerPreviewHost } from './host.js';
import { renderLineage, renderVersionList } from './shell.js';
import { readAccepted, type CompositionVersion, type PreviewArtifact } from './store.js';

/**
 * The accepted version on the browser page (s202-m04). design.preview action accept writes <compositions>/<id>/accepted.json;
 * the host's versions.json names the standing acceptance and the page's lineage and version list mark it. A composition
 * without an acceptance renders exactly as before.
 */
const runtimeDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dist/preview-runtime');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const ID = 'cmp-0123456789ab';
type Fixture = { compose: CompositionVersion['compose']; schema: CompositionVersion['schema']; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-list.json', import.meta.url), 'utf8')) as Fixture;
const version = (n: number, parentVersion: number | null, operation: string): CompositionVersion => ({
  recordVersion: '1', compositionId: ID, version: n, parentVersion, operation, createdAt: `2026-09-15T00:00:0${n}.000Z`, head: null,
  compose: raw.compose, schema: raw.schema, schemaHash: `sha256:${String(n).repeat(64)}`, brand: 'A', theme: 'light', slots: [], model: raw.model,
  artifacts: { react: { artifact: raw.frameworks.react.artifact, generatedAt: '2026-09-15T00:00:00.000Z' } }, measurements: {},
});
const acceptance = (n: number, acceptedAt: string, supersedes: { version: number; acceptedAt: string } | null) =>
  ({ version: n, acceptedAt, head: null, versionHead: null, schemaHash: `sha256:${String(n).repeat(64)}`, measurements: {}, scopeCharts: {}, measured: {}, supersedes });

/** Two versions of one composition, and accepted.json when acceptances are given. */
function store(acceptances?: unknown[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'oods-accepted-'));
  directories.push(root);
  const dir = path.join(root, 'compositions');
  const folder = path.join(dir, ID, 'versions');
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, '1.json'), JSON.stringify(version(1, null, 'compose')));
  writeFileSync(path.join(folder, '2.json'), JSON.stringify(version(2, 1, 'seed')));
  if (acceptances) writeFileSync(path.join(dir, ID, 'accepted.json'), JSON.stringify({ recordVersion: '1', compositionId: ID, acceptances }));
  return dir;
}
async function host(dir: string): Promise<FastifyInstance> {
  const server = Fastify();
  servers.push(server);
  await registerPreviewHost(server, { compositionsDir: dir, runtimeDir });
  return server;
}

describe('the accepted version on the browser page (s202-m04)', () => {
  it('reads the standing acceptance, how many there are and what it superseded; nothing without a record; refuses a malformed record', () => {
    expect(readAccepted(store(), ID)).toBeUndefined();
    const dir = store([acceptance(1, '2026-09-15T01:00:00.000Z', null), acceptance(2, '2026-09-15T02:00:00.000Z', { version: 1, acceptedAt: '2026-09-15T01:00:00.000Z' })]);
    expect(readAccepted(dir, ID)).toEqual({ version: 2, acceptedAt: '2026-09-15T02:00:00.000Z', acceptances: 2, supersedes: { version: 1, acceptedAt: '2026-09-15T01:00:00.000Z' } });
    writeFileSync(path.join(dir, ID, 'accepted.json'), JSON.stringify({ recordVersion: '1', compositionId: 'cmp-ffffffffffff', acceptances: [] }));
    expect(() => readAccepted(dir, ID)).toThrow(/Malformed acceptance record/);
  });

  it('versions.json names the standing acceptance, and the page marks it in the lineage and the version list', async () => {
    const plain = await host(store());
    expect((await plain.inject(`/preview/${ID}/versions.json`)).json()).toMatchObject({ compositionId: ID, accepted: null });
    const plainPage = (await plain.inject(`/preview/${ID}/1`)).body;
    expect(plainPage).not.toContain('data-oods-accepted');
    expect(plainPage).not.toContain('<dt>Accepted</dt>');

    const accepted = await host(store([acceptance(2, '2026-09-15T02:00:00.000Z', null)]));
    expect((await accepted.inject(`/preview/${ID}/versions.json`)).json()).toMatchObject({ accepted: { version: 2, acceptedAt: '2026-09-15T02:00:00.000Z', acceptances: 1, supersedes: null } });
    const two = (await accepted.inject(`/preview/${ID}/2`)).body;
    expect(two).toContain('<dt>Accepted</dt><dd><strong data-oods-accepted="this">this version</strong> · 2026-09-15T02:00:00.000Z</dd>');
    expect(two).toContain('<li aria-current="true"><strong>v2</strong> · seed ← v1 · <strong data-oods-accepted="true">accepted</strong></li>');
    const one = (await accepted.inject(`/preview/${ID}/1`)).body;
    expect(one).toContain(`<dt>Accepted</dt><dd><span data-oods-accepted="other"><a href="/preview/${ID}/2?framework=react&brand=A&theme=light">version 2</a></span> · 2026-09-15T02:00:00.000Z</dd>`);
  });

  it('renders the lineage and the version list exactly as before when nothing is accepted', () => {
    const link = (n: number, label: string) => `<a href="#${n}">${label}</a>`;
    const record = version(2, 1, 'seed');
    const summaries = [1, 2].map(n => ({ version: n, parentVersion: n === 1 ? null : 1, operation: n === 1 ? 'compose' : 'seed', createdAt: '', schemaHash: '', head: null, artifacts: ['react' as const] }));
    expect(renderLineage(record, 2, link)).not.toContain('Accepted');
    expect(renderVersionList(summaries, 2, link)).toBe('<li><a href="#1">v1</a> · compose</li><li aria-current="true"><strong>v2</strong> · seed ← v1</li>');
  });
});
