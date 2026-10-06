import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as compose } from '../../src/tools/design.compose.js';

/**
 * s205-m01, a Sprint 204 carry: design.compose recorded a workflow composition as its LIST screen.
 *
 * assembleWorkflow composes list, detail, form and timeline by calling design.compose four times. Those calls
 * were not transient, so each wrote its own composition, and the workflow's result spread the first one — the
 * list's — so its compositionId pointed at a version whose schema was the list screen alone and whose recorded
 * context was "list". design.preview renders the stored version, so a workflow preview was a list preview and
 * showed the list's observation rows. The fix is at the producer: the four compose transiently, and the
 * assembled workflow is recorded once, as itself.
 */
let storeRoot: string;
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-workflow-record-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); });
const servers: FastifyInstance[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('a workflow composition is recorded as the workflow (s205-m01)', () => {
  it('records exactly one version, holding all four screens and the workflow, with context "workflow"', async () => {
    const composed = await compose({ object: 'Subscription', context: 'workflow' });
    expect(composed.status).toBe('ok');
    expect(composed.compositionId).toBeDefined();
    const directory = resolveCompositionsDir();
    // One composition, not five: the four screens no longer record themselves.
    expect(fs.readdirSync(directory).filter(entry => fs.statSync(path.join(directory, entry)).isDirectory())).toEqual([composed.compositionId]);
    const record = await readVersion(directory, composed.compositionId!, composed.version!);
    expect(record.compose.context).toBe('workflow');
    expect(record.schema.workflow?.screens.map(screen => screen.context)).toEqual(['list', 'detail', 'form', 'timeline']);
    expect(record.schema.screens.map(screen => screen.id)).toEqual(['list-screen', 'detail-screen', 'form-screen', 'timeline-screen']);
    expect(record.schema).toEqual(composed.schema);
    // No swap is offered on a workflow: every slot records only the component it carries.
    for (const slot of record.slots) expect(slot.candidates).toEqual(slot.selectedComponent ? [slot.selectedComponent] : []);
  }, 180_000);

  it('a transient workflow records nothing at all', async () => {
    const composed = await compose({ object: 'Subscription', context: 'workflow', options: { transient: true } });
    expect(composed.status).toBe('ok');
    expect(composed.compositionId).toBeUndefined();
    const directory = resolveCompositionsDir();
    expect(fs.existsSync(directory) ? fs.readdirSync(directory) : []).toEqual([]);
  }, 180_000);

  /**
   * s205-m02: once the workflow was recorded as itself, design.preview opened the real workflow app for the first
   * time — and the host could not compile it: its own `src/app.css` import (esbuild has no output file to emit CSS
   * into) and, in Vue, the SFC compiler resolving a component's types from `./store` with no file system. Both are
   * answered from the artifact's own files now.
   * s206-m01: Run is read-only now and composes no workflow, so the proof opens Subscription's.
   */
  it.each(['react', 'vue'] as const)('previews a workflow as the running workflow app in %s', async framework => {
    vi.stubEnv('OODS_PREVIEW_HOST_URL', '');
    const server = Fastify();
    servers.push(server);
    const runtimeDir = path.resolve(fileURLToPath(import.meta.url), '../../../../mcp-bridge/dist/preview-runtime');
    await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir });
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    const hostUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    const result = await preview({ object: 'Subscription', context: 'workflow', framework } as never, { previewHostUrl: hostUrl }) as { previews: Array<{ framework: string; moduleUrl: string; compiled: { bytes: number } }> };
    expect(result.previews[0]!.framework).toBe(framework);
    const module = await fetch(result.previews[0]!.moduleUrl);
    expect(module.status).toBe(200);
    const source = await module.text();
    // The app's own stylesheet is applied, not dropped, and the workflow mounts its store.
    expect(source).toContain('oodsArtifactCss');
    expect(source).toContain('plan_name');
  }, 300_000);
});
