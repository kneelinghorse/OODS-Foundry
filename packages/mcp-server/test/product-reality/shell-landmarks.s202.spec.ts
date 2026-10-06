import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { chromium } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as preview } from '../../src/tools/design.preview.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const runtimeDir = path.join(root, 'packages/mcp-bridge/dist/preview-runtime');
/** The three shell findings every generated page reported in Sprint 201 (m04 receipts). */
const SHELL_FINDINGS = ['landmark-one-main', 'page-has-heading-one', 'region'];
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
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-shell-landmarks-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(async () => { vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('the running page measures the generated shell (s202-m01)', () => {
  it('a fresh Subscription detail stores zero landmark-one-main, page-has-heading-one and region findings in React and Vue, light and dark, and switches scope with the chart re-rendered', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const result = await preview({ object: 'Subscription', context: 'detail' }, { previewHostUrl: hostUrl });
    if (result.action !== 'render') throw new Error('render expected');
    const browser = await chromium.launch({ headless: true });
    const observed: Record<string, unknown> = {};
    try {
      for (const entry of result.previews) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, locale: 'en-US', timezoneId: 'UTC' });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(`page: ${error.message}`));
        page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
        await page.goto(entry.appUrl, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.oodsAxeRuns === '1', undefined, { timeout: 90_000 });
        const landmarks = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, h1Text: document.querySelector('h1')?.textContent?.trim(), figcaption: document.querySelector('[data-oods-component="VizMarkPreview"] figcaption')?.textContent?.trim(), narrow: document.querySelectorAll('[data-viz-svg-narrow] svg').length, generatedFor: (window as unknown as { __oodsPreview: { generatedFor: unknown } }).__oodsPreview.generatedFor }));
        // s222-m02 (#2502 ruling 12): an app carries each chart in light, dark and hc, and the page's theme shows one.
        expect(landmarks).toMatchObject({ main: 1, h1: 1, figcaption: 'Payment amounts', narrow: 3, generatedFor: { brand: 'A', theme: 'light', chartScoped: true } });
        expect(landmarks.h1Text).toBeTruthy();
        // A theme switch inside the page re-mounts and measures again; without a native runner the host keeps the generated scope and says so.
        await page.evaluate(() => (window as unknown as { __oodsPreviewApplyScope: (scope: unknown) => void }).__oodsPreviewApplyScope({ brand: 'A', theme: 'dark' }));
        await page.waitForFunction(() => document.documentElement.dataset.oodsAxeRuns === '2', undefined, { timeout: 90_000 });
        const after = await page.evaluate(() => (window as unknown as { __oodsPreview: { brand: string; theme: string; generatedFor: unknown; scopeError: unknown } }).__oodsPreview);
        expect(after).toMatchObject({ brand: 'A', theme: 'dark', generatedFor: { brand: 'A', theme: 'light', chartScoped: true } });
        expect(String(after.scopeError)).toMatch(/no native server/);
        expect(errors).toEqual([]);
        observed[entry.framework] = landmarks;
        await page.close();
      }
    } finally { await browser.close(); }
    const record = await readVersion(compositionsDir, result.compositionId, 1);
    const axe = record.measurements.axe as Record<string, Record<string, { violations: Array<{ id: string }>; passes: number }>>;
    for (const framework of ['react', 'vue'] as const) for (const scope of ['A/light', 'A/dark']) {
      const stored = axe[framework]?.[scope];
      expect(stored, `${framework} ${scope}`).toBeDefined();
      expect(stored!.violations.map(violation => violation.id).filter(id => SHELL_FINDINGS.includes(id)), `${framework} ${scope}`).toEqual([]);
      expect(stored!.passes).toBeGreaterThan(0);
    }
  }, 300_000);
});
