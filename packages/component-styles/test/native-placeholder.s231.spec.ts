import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const css = fs.readFileSync(path.join(root, 'packages/component-styles/src/components.css'), 'utf8').replace(/^@import[^;]+;\s*/gm, '');
const tokens = fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css'), 'utf8');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30_000);
afterAll(async () => { await browser?.close(); });

for (const brand of ['A', 'B']) for (const theme of ['light', 'dark']) {
  it(`native Product form placeholders stay readable under a host reset in ${brand}/${theme}`, async () => {
    const page = await browser.newPage();
    try {
      // Tailwind v4 preflight supplies a half-opacity currentColor placeholder to unstyled native controls.
      await page.setContent(`<html data-brand="${brand}" data-theme="${theme}"><style>
        @layer base { ::placeholder { color: color-mix(in oklab, currentColor 50%, transparent); } }
        ${tokens}\n${css}
        </style><form data-oods-component="ClassificationEditor"><label data-form-control="input">
        <span>Tags</span><input name="tags" placeholder="tag-1, tag-2"></label></form></html>`);
      const ratio = () => page.locator('input').evaluate(input => {
        const style = getComputedStyle(input, '::placeholder');
        const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const rgb = () => [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        context.fillStyle = getComputedStyle(input).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const background = rgb();
        context.globalAlpha = Number(style.opacity);
        context.fillStyle = style.color;
        context.fillRect(0, 0, 1, 1);
        const luminance = (channels: number[]) => {
          const [r, g, b] = channels.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
          return .2126 * r! + .7152 * g! + .0722 * b!;
        };
        const a = luminance(background), b = luminance(rgb());
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      expect(await ratio()).toBeGreaterThanOrEqual(4.5);
      if (theme === 'light') {
        await page.addStyleTag({ content: 'input::placeholder { color: color-mix(in oklab, currentColor 50%, transparent) !important; }' });
        expect(await ratio(), 'the previous native reset fails for visible placeholder text').toBeLessThan(4.5);
      }
    } finally { await page.close(); }
  }, 30_000);
}
