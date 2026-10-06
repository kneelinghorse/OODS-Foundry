import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { readBuildRevision, registerBridgeHealth, type BridgeHealthResponse } from './health.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directories: string[] = [];
const temp = () => { const dir = mkdtempSync(path.join(tmpdir(), 'oods-build-stamp-')); directories.push(dir); return dir; };
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const toolset = { mode: 'auto', enabledCount: 20, registrySource: 'src/tools/registry.json' };
describe('packaged bridge health revision', () => {
  it('reports the packaged build and never follows later stamp changes', async () => {
    const stamp = pathToFileURL(path.join(temp(), 'revision.json'));
    const revision = { commit: 'a'.repeat(40), structuredDataManifestHash: `sha256:${'b'.repeat(64)}` };
    writeFileSync(stamp, JSON.stringify(revision));
    const server = Fastify(); registerBridgeHealth(server, toolset, stamp);
    writeFileSync(stamp, JSON.stringify({ ...revision, commit: 'c'.repeat(40) }));
    try { expect((await server.inject('/health')).json<BridgeHealthResponse>()).toEqual({ status: 'ok', bridge: 'ready', toolset, revision }); }
    finally { await server.close(); }
  });
  it('keeps an unstamped development build healthy with the typed optional revision absent', async () => {
    const stamp = pathToFileURL(path.join(temp(), 'missing.json'));
    expect(readBuildRevision(stamp)).toBeUndefined();
    const server = Fastify(); registerBridgeHealth(server, toolset, stamp);
    try { const response = await server.inject('/health'); expect(response.statusCode).toBe(200); expect(response.json<BridgeHealthResponse>()).toEqual({ status: 'ok', bridge: 'ready', toolset }); }
    finally { await server.close(); }
  });
  it('fails loudly on a malformed stamp instead of claiming an unstamped build', () => {
    const stamp = pathToFileURL(path.join(temp(), 'bad.json')); writeFileSync(stamp, JSON.stringify({ commit: 'unknown' }));
    expect(() => readBuildRevision(stamp)).toThrow('Invalid packaged build revision');
  });
  it('stamps the exact git commit and manifest bytes using the shared server/bridge build step', () => {
    const output = path.join(temp(), 'build-revision.json');
    execFileSync(process.execPath, [path.join(root, 'scripts/build-revision.mjs'), output], { cwd: root });
    expect(readBuildRevision(pathToFileURL(output))).toEqual({
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      structuredDataManifestHash: `sha256:${createHash('sha256').update(readFileSync(path.join(root, 'artifacts/structured-data/manifest.json'))).digest('hex')}`,
    });
  });
  it('stamps assembly identity without git, a checkout, or host structured data', () => {
    const extracted = temp();
    const script = path.join(extracted, 'scripts/build-revision.mjs');
    mkdirSync(path.dirname(script));
    copyFileSync(path.join(root, 'scripts/build-revision.mjs'), script);
    const output = path.join(extracted, 'packages/mcp-bridge/dist/build-revision.json');
    const revision = { commit: 'd'.repeat(40), structuredDataManifestHash: `sha256:${'e'.repeat(64)}` };
    execFileSync(process.execPath, [script, output, '--commit', revision.commit, '--structured-data-manifest-hash', revision.structuredDataManifestHash], {
      cwd: extracted, env: { ...process.env, PATH: extracted },
    });
    expect(readBuildRevision(pathToFileURL(output))).toEqual(revision);
  });
  it.each([
    ['--commit', 'a'.repeat(40)],
    ['--structured-data-manifest-hash', `sha256:${'b'.repeat(64)}`],
    ['--commit', 'HEAD', '--structured-data-manifest-hash', `sha256:${'b'.repeat(64)}`],
    ['--commit', 'a'.repeat(40), '--structured-data-manifest-hash', 'wrong'],
    ['--unknown', 'value'],
    ['--commit', 'a'.repeat(40), '--commit', 'b'.repeat(40)],
  ])('rejects incomplete or invalid explicit identity rather than mixing in host defaults (%j)', (...args) => {
    const output = path.join(temp(), 'build-revision.json');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/build-revision.mjs'), output, ...args], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Expected --commit|Explicit build revision requires/);
    expect(existsSync(output)).toBe(false);
  });
});
