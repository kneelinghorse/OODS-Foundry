import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { chromium } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as preview } from '../../src/tools/design.preview.js';

/**
 * Sprint 203 m01, the re-typed Sprint 202 descope: why axe-core is not re-run inside the conversation view.
 *
 * The conversation app mounts the generated design in its own document, beside its own chrome, so there are only two
 * possible scopes and this spec measures both. A run scoped to the mounted design cannot evaluate axe's document-level
 * rules — among them the three the generated shell exists to satisfy and Sprint 202 m01 closed. A run over the whole
 * document reports the app's own chrome as the design's findings. The browser preview page has neither problem, because
 * there the generated page IS the document; its full-document result is what the version stores and the panel shows.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const runtimeDir = path.join(root, 'packages/mcp-bridge/dist/preview-runtime');
const AXE = path.join(root, 'node_modules/axe-core/axe.min.js');
/** The three of them are exactly the findings Sprint 202 m01 closed in the generated shell. */
const DOCUMENT_LEVEL_RULES = ['landmark-one-main', 'page-has-heading-one', 'region'];
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
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-axe-scope-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(async () => { vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('the conversation view shows the stored measurement rather than re-running axe (s203-m01)', () => {
  it('a subtree run cannot evaluate the document-level rules the shell satisfies, and a document run beside chrome reports the chrome', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const result = await preview({ object: 'Subscription', context: 'detail' }, { previewHostUrl: hostUrl });
    if (result.action !== 'render') throw new Error('render expected');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
      await page.goto(result.previews[0]!.appUrl, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.oodsAxeRuns === '1', undefined, { timeout: 90_000 });
      await page.addScriptTag({ path: AXE });
      const measured = await page.evaluate(async () => {
        type Run = { violations: Array<{ id: string }>; passes: Array<{ id: string }> };
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<Run> } }).axe;
        const run = (ctx: unknown) => axe.run(ctx, { resultTypes: ['violations', 'passes'] });
        const evaluated = (r: Run) => [...r.violations.map(v => v.id), ...r.passes.map(v => v.id)];
        const documentRun = evaluated(await run(document));
        const subtreeRun = evaluated(await run(document.getElementById('app')));
        // What the conversation view actually is: the design mounted beside this app's own chrome, in one document.
        const chrome = document.createElement('div');
        chrome.innerHTML = '<h1>Forge design preview</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
        document.body.insertBefore(chrome, document.body.firstChild);
        const documentRunBesideChrome = await run(document);
        chrome.remove();
        return { documentRun, subtreeRun, besideChrome: documentRunBesideChrome.violations.map(v => v.id) };
      });
      // The design's own page evaluates the document-level rules; a run scoped to the mounted design does not.
      for (const rule of DOCUMENT_LEVEL_RULES) {
        expect(measured.documentRun, rule).toContain(rule);
        expect(measured.subtreeRun, rule).not.toContain(rule);
      }
      // And widening the scope back out in the conversation would attribute this app's chrome to the design.
      expect(measured.besideChrome).toContain('image-alt');
      await page.close();
    } finally { await browser.close(); }
  }, 300_000);

  it('the measurement panel says the results are stored, names the page that measured them and why nothing is re-run here', () => {
    const app = fs.readFileSync(path.join(root, 'packages/mcp-bridge/dist/preview-app/app.html'), 'utf8');
    expect(app).toContain('data-oods-axe-scope="stored-document-run"');
    expect(app).toContain('re-runs nothing');
    for (const rule of DOCUMENT_LEVEL_RULES) expect(app).toContain(rule);
  });
});
