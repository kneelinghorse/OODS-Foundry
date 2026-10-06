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

/**
 * Sprint 203 m01, the Sprint 202 carry: `heading-order` on a generated screen.
 *
 * Sprint 202 m01 raised a detail's record title to the page's `h1` and gave every other screen a shell `h1`, but left
 * every section title at `h3` — so each generated page skipped level two. The generated outline is flat: one `h1` and a
 * run of sibling section titles, with only layout primitives (Stack, Tabs, Card) between them and never a heading. The
 * fix is at the producer: a section title is a level-two heading in both frameworks. This spec holds the outline to that
 * shape on a screen from each template, so a new recipe cannot re-open the gap.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const runtimeDir = path.join(root, 'packages/mcp-bridge/dist/preview-runtime');
const SCREENS = [
  { object: 'Subscription', context: 'detail' },
  { object: 'Subscription', context: 'timeline' },
  { object: 'Organization', context: 'form' },
  { object: 'Organization', context: 'card' },
] as const;
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
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-heading-order-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); vi.stubEnv('OODS_PREVIEW_HOST_URL', ''); });
afterEach(async () => { vi.unstubAllEnvs(); for (const server of servers.splice(0)) await server.close(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('a generated screen has no heading-level gap (s203-m01)', () => {
  it('every screen opens on one h1 and descends a level at a time, and stores no heading-order finding, in React and Vue', async () => {
    const compositionsDir = resolveCompositionsDir();
    const hostUrl = await host(compositionsDir);
    const browser = await chromium.launch({ headless: true });
    try {
      for (const screen of SCREENS) {
        const label = `${screen.object}/${screen.context}`;
        const result = await preview({ object: screen.object, context: screen.context }, { previewHostUrl: hostUrl });
        if (result.action !== 'render') throw new Error(`render expected for ${label}`);
        for (const entry of result.previews) {
          const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, locale: 'en-US', timezoneId: 'UTC' });
          await page.goto(entry.appUrl, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => document.documentElement.dataset.oodsAxeRuns === '1', undefined, { timeout: 90_000 });
          const outline = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(node => Number(node.tagName[1])));
          expect(outline[0], `${label} ${entry.framework} opens on h1`).toBe(1);
          expect(outline.filter(level => level === 1), `${label} ${entry.framework} has one h1`).toHaveLength(1);
          for (let index = 1; index < outline.length; index += 1) {
            expect(outline[index]! - outline[index - 1]!, `${label} ${entry.framework} step ${index} (${outline.join(',')})`).toBeLessThanOrEqual(1);
          }
          await page.close();
        }
        const record = await readVersion(compositionsDir, result.compositionId, 1);
        const axe = record.measurements.axe as Record<string, Record<string, { violations: Array<{ id: string }> }>>;
        for (const framework of ['react', 'vue'] as const) {
          const stored = axe[framework]?.['A/light'];
          expect(stored, `${label} ${framework}`).toBeDefined();
          expect(stored!.violations.map(v => v.id), `${label} ${framework}`).not.toContain('heading-order');
        }
      }
    } finally { await browser.close(); }
  }, 600_000);
});
