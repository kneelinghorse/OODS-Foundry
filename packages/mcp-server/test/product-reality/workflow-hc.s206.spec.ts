import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as preview } from '../../src/tools/design.preview.js';

// Axe and computed colors both missed Chromium painting a solid foreground backplate over the selected label.
// Read the pixels of the real generated button's text box. A fresh document matters: toggling forced-color-adjust
// on an already painted button did not reliably repaint it. The negative control restores that browser behavior.
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const selected = '.workflow-app > nav button[aria-current="page"]';
const cases = (['A', 'B'] as const).flatMap(brand => (['light', 'dark', 'hc'] as const).flatMap(theme =>
  (['light', 'dark'] as const).flatMap(colorScheme => (['react', 'vue'] as const).map(framework =>
    ({ brand, theme, colorScheme, framework })))));
const urls = new Map<string, string>();
const receipts: Array<Record<string, unknown>> = [];
const receiptDir = process.env.OODS_S206_HC_RECEIPTS;
let storeRoot: string;
let server: FastifyInstance;
let browser: Browser;

async function textPixels(page: Page) {
  const box = await page.locator(selected).evaluate(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    const rect = range.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      clip: { x: Math.floor(rect.left), y: Math.floor(rect.top), width: Math.ceil(rect.right) - Math.floor(rect.left), height: Math.ceil(rect.bottom) - Math.floor(rect.top) },
      color: style.color, background: style.backgroundColor, forcedColorAdjust: style.forcedColorAdjust,
    };
  });
  const png = await page.screenshot({ clip: box.clip });
  const foregroundFraction = await page.evaluate(async ({ encoded, color }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    let foreground = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (rgb.every((channel, offset) => Math.abs(pixels[index + offset]! - channel) <= 2)) foreground += 1;
    }
    return foreground / (image.width * image.height);
  }, { encoded: png.toString('base64'), color: box.color });
  return { ...box, foregroundFraction };
}

beforeAll(async () => {
  storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-workflow-hc-'));
  vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot);
  vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas');
  vi.stubEnv('OODS_PREVIEW_HOST_URL', '');
  server = Fastify();
  await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir: path.join(root, 'packages/mcp-bridge/dist/preview-runtime') });
  await server.listen({ port: 0, host: '127.0.0.1' });
  const address = server.server.address();
  const hostUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark', 'hc'] as const) {
    const result = await preview({ object: 'Subscription', context: 'workflow', preferences: { brand, theme } }, { previewHostUrl: hostUrl });
    if (result.action !== 'render') throw new Error(`Expected workflow render for ${brand}/${theme}`);
    for (const entry of result.previews) urls.set(`${brand}/${theme}/${entry.framework}`, entry.appUrl);
  }
  browser = await chromium.launch({ headless: true });
  if (receiptDir) fs.mkdirSync(receiptDir, { recursive: true });
}, 300_000);

afterAll(async () => {
  if (receiptDir) fs.writeFileSync(path.join(receiptDir, 'text-pixels.json'), `${JSON.stringify(receipts, null, 2)}\n`);
  await browser?.close();
  await server?.close();
  vi.unstubAllEnvs();
  if (storeRoot) fs.rmSync(storeRoot, { recursive: true, force: true });
});

describe('selected workflow labels remain visible in forced colors (s206-m05)', () => {
  it.each(cases)('$brand/$theme/$framework with $colorScheme system colors paints glyphs, including after navigation', async entry => {
    const page = await browser.newPage({ forcedColors: 'active', colorScheme: entry.colorScheme, viewport: { width: 1200, height: 1000 } });
    try {
      await page.goto(urls.get(`${entry.brand}/${entry.theme}/${entry.framework}`)!, { waitUntil: 'networkidle' });
      await page.waitForSelector('.workflow-app[data-ui-state="success"]');
      expect(await page.evaluate(() => ({ brand: document.documentElement.dataset.brand, theme: document.documentElement.dataset.theme }))).toEqual({ brand: entry.brand, theme: entry.theme });
      for (const screen of ['List', 'Detail']) {
        if (screen === 'Detail') await page.locator('.workflow-app > nav').getByRole('button', { name: 'Detail', exact: true }).click();
        await page.waitForFunction(({ selector, name }) => document.querySelector(selector)?.textContent === name, { selector: selected, name: screen });
        const pixels = await textPixels(page);
        receipts.push({ ...entry, screen, control: false, ...pixels });
        if (receiptDir && screen === 'List') await page.screenshot({ path: path.join(receiptDir, `${entry.brand}-${entry.theme}-${entry.framework}-${entry.colorScheme}.png`) });
        expect(pixels.foregroundFraction, 'visible glyph strokes occupy some of the text box').toBeGreaterThan(0.02);
        expect(pixels.foregroundFraction, 'the foreground must not become an opaque text backplate').toBeLessThan(0.6);
      }
    } finally { await page.close(); }
  }, 90_000);

  it.each(cases.filter(entry => entry.brand === 'A' && entry.theme === 'hc'))('control: $framework/$colorScheme detects the unreadable native backplate', async entry => {
    const page = await browser.newPage({ forcedColors: 'active', colorScheme: entry.colorScheme });
    try {
      const url = urls.get(`${entry.brand}/${entry.theme}/${entry.framework}`)!;
      await page.route(url, async route => {
        const response = await route.fetch();
        const html = (await response.text()).replace('</head>', `<style>${selected} { forced-color-adjust: auto !important; }</style></head>`);
        await route.fulfill({ response, body: html });
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('.workflow-app[data-ui-state="success"]');
      const pixels = await textPixels(page);
      receipts.push({ ...entry, screen: 'List', control: true, ...pixels });
      expect(pixels.foregroundFraction, 'the control must reproduce the opaque backplate the positive cases forbid').toBeGreaterThan(0.8);
    } finally { await page.close(); }
  }, 90_000);
});
