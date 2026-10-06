import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerArtifactEndpoints } from './endpoints/artifacts.js';
import { resolveBridgeArtifacts } from './runtime-paths.js';

const directories: string[] = [];
function fixture(): { root: string; serverCwd: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'oods-bridge-artifacts-'));
  directories.push(root);
  const serverCwd = path.join(root, 'packages/mcp-server');
  mkdirSync(path.join(serverCwd, 'dist/security'), { recursive: true });
  return { root, serverCwd };
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('bundled bridge artifacts', () => {
  it('resolves the shipped server policy from the extracted root, independent of process cwd', () => {
    const { root, serverCwd } = fixture();
    writeFileSync(path.join(serverCwd, 'dist/security/policy.json'), JSON.stringify({ artifactsBase: 'artifacts/current-state' }));
    expect(resolveBridgeArtifacts(serverCwd)).toEqual({
      artifactsRoot: path.join(root, 'artifacts'), artifactsBase: path.join(root, 'artifacts/current-state'),
    });
  });

  it('honors the built policy over source policy and serves the exact configured run directory', async () => {
    const { root, serverCwd } = fixture();
    const artifactsBase = path.join(root, 'receipts/runs');
    writeFileSync(path.join(serverCwd, 'dist/security/policy.json'), JSON.stringify({ artifactsBase }));
    mkdirSync(path.join(serverCwd, 'src/security'), { recursive: true });
    writeFileSync(path.join(serverCwd, 'src/security/policy.json'), JSON.stringify({ artifactsBase: 'wrong' }));
    const run = path.join(artifactsBase, '2026-09-12/viz-render');
    mkdirSync(run, { recursive: true });
    writeFileSync(path.join(run, 'transcript.json'), JSON.stringify({ tool: 'viz.render', ts: '2026-09-12T00:00:00Z' }));
    const resolved = resolveBridgeArtifacts(serverCwd);
    expect(resolved).toEqual({ artifactsRoot: path.join(root, 'receipts'), artifactsBase });
    const server = Fastify();
    const limit = { max: 120, timeWindow: '1 minute' };
    await registerArtifactEndpoints(server, resolved.artifactsRoot, { list: limit, detail: limit, files: limit, open: limit }, resolved.artifactsBase);
    try {
      const response = await server.inject('/runs');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([expect.objectContaining({ tool: 'viz.render', startedAt: '2026-09-12T00:00:00Z' })]);
      const runId = response.json()[0].id;
      const fileId = Buffer.from('transcript.json').toString('base64url');
      const open = await server.inject(`/runs/${runId}/files/${fileId}/open`);
      expect(open.headers.location).toBe('/artifacts/runs/2026-09-12/viz-render/transcript.json');
    } finally { await server.close(); }
  });
});
