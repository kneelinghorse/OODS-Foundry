import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

export interface BuildRevision { commit: string; structuredDataManifestHash: string }
export interface BridgeHealthResponse {
  status: 'ok';
  bridge: 'ready';
  toolset: { mode: string; enabledCount: number; registrySource: string };
  revision?: BuildRevision;
}

/** Read the packaged stamp only: runtime checkout changes must not relabel a build. */
export function readBuildRevision(stamp: URL): BuildRevision | undefined {
  let content: string;
  try { content = readFileSync(stamp, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  const revision: unknown = JSON.parse(content);
  if (!revision || typeof revision !== 'object'
      || !('commit' in revision) || typeof revision.commit !== 'string' || !/^[a-f0-9]{40}$/.test(revision.commit)
      || !('structuredDataManifestHash' in revision) || typeof revision.structuredDataManifestHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(revision.structuredDataManifestHash)) {
    throw new Error('Invalid packaged build revision stamp.');
  }
  return { commit: revision.commit, structuredDataManifestHash: revision.structuredDataManifestHash };
}

export function registerBridgeHealth(server: FastifyInstance, toolset: BridgeHealthResponse['toolset'], stamp = new URL('./build-revision.json', import.meta.url)): void {
  const revision = readBuildRevision(stamp);
  server.get<{ Reply: BridgeHealthResponse }>('/health', async () => ({ status: 'ok', bridge: 'ready', toolset, ...(revision ? { revision } : {}) }));
}
