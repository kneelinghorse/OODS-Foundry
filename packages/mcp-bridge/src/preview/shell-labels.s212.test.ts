import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { renderPreviewShell } from './shell.js';
import { previewTokens } from './tokens.js';
import type { CompositionVersion } from './store.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8'));
const record = {
  ...fixture, recordVersion: '1', compositionId: 'cmp-0123456789ab', version: 1, parentVersion: null,
  operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: null, schemaHash: 'sha256:fixture', slots: [], measurements: {},
  artifacts: Object.fromEntries(Object.entries(fixture.frameworks).map(([name, entry]) => [name, { artifact: (entry as any).artifact }])),
} as CompositionVersion;
// s213-m04: the page loads the token build's CSS, then the runtime's component CSS, as the host links them.
const styles = `${previewTokens().css().text}\n${fs.readFileSync(new URL('../../dist/preview-runtime/styles.css', import.meta.url), 'utf8')}`;
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); }, 60_000);
afterAll(async () => { await browser?.close(); });

describe('selected preview controls remain readable, including native forced colours (s212-m06)', () => {
  for (const framework of ['react', 'vue'] as const) for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark', 'hc'] as const) for (const forcedColors of ['none', 'active'] as const) {
    it(`${framework}/${brand}/${theme}/${forcedColors}: selected text contains glyphs and the button background, never a blank backplate`, async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, forcedColors });
      try {
        // The real shell and shipped stylesheet; the child app is irrelevant to toolbar paint.
        const html = renderPreviewShell({ record, versions: [], framework, brand, brands: previewTokens().brands(), theme, width: 'fit', base: '/preview' });
        await page.setContent(html.replace('<head>', `<head><style>${styles}</style>`).replace(/<iframe[^>]*><\/iframe>/, ''));
        const buttons = page.locator('.controls button[aria-pressed="true"]');
        expect(await buttons.count()).toBe(4);
        for (const button of await buttons.all()) {
          const geometry = await button.evaluate(element => {
            const box = element.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(element);
            const text = range.getBoundingClientRect(), css = getComputedStyle(element);
            return { label: element.textContent, x: text.x - box.x, y: text.y - box.y, width: text.width, height: text.height, background: css.backgroundColor, foreground: css.color };
          });
          expect(geometry.label?.trim()).toBeTruthy();
          expect(geometry.background).not.toBe(geometry.foreground);
          const pixels = await button.screenshot();
          const painted = await page.evaluate(async ({ png, geometry }) => {
            const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
            const bytes = ctx.getImageData(Math.ceil(geometry.x), Math.ceil(geometry.y), Math.floor(geometry.width), Math.floor(geometry.height)).data;
            // System Highlight may have alpha outside forced-colors; sample the actual painted padding.
            const background = [...ctx.getImageData(4, Math.floor(image.height / 2), 1, 1).data].slice(0, 3);
            // Convert authored OKLCH as well as system RGB to the screenshot's sRGB pixel space.
            ctx.fillStyle = geometry.foreground; ctx.fillRect(0, 0, 1, 1);
            const foreground = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
            let bg = 0, ink = 0;
            for (let i = 0; i < bytes.length; i += 4) {
              const near = (color: number[]) => color.every((channel, index) => Math.abs(bytes[i + index]! - channel) < 16);
              if (near(background)) bg++; if (near(foreground)) ink++;
            }
            return { backgroundShare: bg / (bytes.length / 4), inkShare: ink / (bytes.length / 4) };
          }, { png: pixels.toString('base64'), geometry });
          expect(painted.backgroundShare, `${geometry.label}: ${JSON.stringify(painted)}`).toBeGreaterThan(.2);
          expect(painted.inkShare, `${geometry.label}: ${JSON.stringify(painted)}`).toBeGreaterThan(.04);
        }
        // Changing selection must retain actual label text and pressed semantics.
        await page.getByRole('button', { name: '820', exact: true }).click();
        expect(await page.getByRole('button', { name: '820', exact: true }).getAttribute('aria-pressed')).toBe('true');
        expect(await page.getByRole('button', { name: 'fit', exact: true }).getAttribute('aria-pressed')).toBe('false');
      } finally { await page.close(); }
    }, 60_000);
  }
});
