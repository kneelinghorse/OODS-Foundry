import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { registerPreviewHost } from './host.js';
import type { CompositionVersion } from './store.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8'));
const id = 'cmp-0123456789ab';
const record = {
  recordVersion: '1', compositionId: id, version: 1, parentVersion: null, operation: 'compose',
  createdAt: '2026-09-15T00:00:00.000Z', head: null, schemaHash: 'sha256:fixture',
  compose: fixture.compose, schema: fixture.schema, model: fixture.model, brand: fixture.brand, theme: fixture.theme,
  slots: [], measurements: {}, artifacts: Object.fromEntries(Object.entries(fixture.frameworks).map(([name, entry]) => [name, { artifact: (entry as any).artifact, generatedAt: '2026-09-15T00:00:00.000Z' }])),
} as CompositionVersion;
let browser: Browser, server: FastifyInstance, store: string, url: string;
beforeAll(async () => {
  store = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s212-frame-size-'));
  const versions = path.join(store, id, 'versions'); fs.mkdirSync(versions, { recursive: true });
  fs.writeFileSync(path.join(versions, '1.json'), JSON.stringify(record));
  server = Fastify();
  await registerPreviewHost(server, { compositionsDir: store, runtimeDir: path.resolve(import.meta.dirname, '../../dist/preview-runtime') });
  url = await server.listen({ port: 0, host: '127.0.0.1' });
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => { await browser?.close(); await server?.close(); if (store) fs.rmSync(store, { recursive: true, force: true }); });

describe('a preview frame follows content that grows and shrinks (s212-m06)', () => {
  for (const framework of ['react', 'vue']) for (const width of [390, 1440]) {
    it(`${framework}/${width}: temporary tall content cannot leave a permanent blank region`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 }, forcedColors: 'active' });
      try {
        await page.goto(`${url}/preview/${id}/1?framework=${framework}&brand=A&theme=hc&width=fit`);
        await page.waitForFunction(() => document.documentElement.dataset.oodsAppMounted === 'true');
        const frame = page.frames().find(item => item !== page.mainFrame())!;
        // Deterministic stand-in for a temporarily taller mount, expanded panel, or loading state.
        await frame.evaluate(() => { document.getElementById('app')!.style.minHeight = '2800px'; });
        await expect.poll(() => frame.evaluate(() => innerHeight), { timeout: 10000 }).toBeGreaterThanOrEqual(2800);
        await frame.evaluate(() => { document.getElementById('app')!.style.removeProperty('min-height'); });
        await expect.poll(() => frame.evaluate(() => Math.abs(innerHeight - Math.max(480, Math.ceil(document.body.scrollHeight)))), { timeout: 10000 }).toBeLessThanOrEqual(1);
        expect(await frame.evaluate(() => innerHeight)).toBeLessThan(1500);
      } finally { await page.close(); }
    }, 60_000);
  }
});
