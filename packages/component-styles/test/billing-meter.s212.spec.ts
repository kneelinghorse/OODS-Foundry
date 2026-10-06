import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const css = fs.readFileSync(path.join(root, 'packages/component-styles/src/components.css'), 'utf8').replace(/^@import[^\n]+\n/gmu, '');
const tokens = fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css'), 'utf8');

for (const [engine, browserType] of Object.entries({ chromium, firefox })) {
  describe(`${engine} native billing meter communicates the completed share (s212-m01)`, () => {
    let browser: Browser;
    beforeAll(async () => { browser = await browserType.launch(); }, 60_000);
    afterAll(async () => { await browser?.close(); }, 30_000);
    for (const brand of ['A', 'B']) for (const theme of ['light', 'dark', 'hc']) {
      it(`${brand}/${theme}: 23% occupies the left quarter and keeps its accessible value`, async () => {
        const page = await browser.newPage({ forcedColors: theme === 'hc' ? 'active' : 'none', viewport: { width: 390, height: 120 } });
        try {
          await page.setContent(`<html data-brand="${brand}" data-theme="${theme}"><style>${tokens}\n${css}</style><body><div data-oods-component="CycleProgressCard" style="width:200px"><progress style="width:200px" aria-label="Billing cycle" value="23" max="100"></progress></div></body></html>`);
          const meter = page.locator('progress');
          expect(await meter.evaluate((element: HTMLProgressElement) => ({ value: element.value, max: element.max, position: element.position }))).toEqual({ value: 23, max: 100, position: .23 });
          expect(await page.getByRole('progressbar', { name: 'Billing cycle' }).count()).toBe(1);
          // Read the native widget's actual painted pixels, not a CSS declaration or pseudo-element guess.
          const png = await meter.screenshot();
          const proof = await page.evaluate(async (data) => {
            const picture = new Image(); picture.src = `data:image/png;base64,${data}`; await picture.decode();
            const canvas = document.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(picture, 0, 0);
            const pixels = ctx.getImageData(0, Math.floor(picture.height / 2), picture.width, 1).data;
            const rgb = (x: number) => [...pixels.slice(x * 4, x * 4 + 3)];
            const fill = rgb(20), track = rgb(150);
            const distance = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);
            const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
            return { fill, track, fillCount: Array.from({ length: picture.width }, (_, x) => rgb(x)).filter(color => distance(color, fill) < 8).length, fillLuminance: luminance(fill), trackLuminance: luminance(track) };
          }, png.toString('base64'));
          expect(proof.fill).not.toEqual(proof.track);
          expect(proof.fillCount).toBeGreaterThanOrEqual(43);
          expect(proof.fillCount).toBeLessThanOrEqual(48);
          if (theme === 'dark') expect(proof.fillLuminance).toBeGreaterThan(proof.trackLuminance);
          if (theme === 'light') expect(proof.fillLuminance).toBeLessThan(proof.trackLuminance);
        } finally { await page.close(); }
      }, 30_000);
    }
    it('preserves an explicit component fill override outside forced colors', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(`<html data-brand="A" data-theme="light"><style>${tokens}\n${css}</style><div data-oods-component="CycleProgressCard" style="--cmp-billing-cycle-progress-fill:rgb(20, 80, 140)"><progress value="23" max="100"></progress></div></html>`);
        expect(await page.locator('progress').evaluate(node => getComputedStyle(node).color)).toBe('rgb(20, 80, 140)');
      } finally { await page.close(); }
    }, 30_000);
  });
}
