import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Sprint 213 m01, Sprint 212 review finding 4: the light-theme billing meter's track nearly vanished. It used the raised
 * surface, which in light is whiter than the card it sits on (1.04:1), so a 23% cycle read as a short bar with no end.
 * These tests read the painted pixels of the meter inside its card in two engines and hold, per brand and theme:
 *  - the track stands apart from its card (at least 1.4:1, the border role's measure), so the whole cycle is visible;
 *  - the fill stands apart from the track and from the card by at least 3:1 (WCAG 1.4.11 for the value it shows);
 *  - in forced colors the track is outlined against the card and the fill differs from the track;
 *  - the accessible value is unchanged.
 */
const root = path.resolve(import.meta.dirname, '../../..');
const css = fs.readFileSync(path.join(root, 'packages/component-styles/src/components.css'), 'utf8').replace(/^@import[^\n]+\n/gmu, '');
const tokens = fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css'), 'utf8');

for (const [engine, browserType] of Object.entries({ chromium, firefox })) {
  describe(`${engine} billing meter track reads against its card (s213-m01)`, () => {
    let browser: Browser;
    beforeAll(async () => { browser = await browserType.launch(); }, 60_000);
    afterAll(async () => { await browser?.close(); }, 30_000);
    for (const brand of ['A', 'B']) for (const theme of ['light', 'dark', 'hc']) {
      it(`${brand}/${theme}: card, track and fill are each distinguishable`, async () => {
        const page = await browser.newPage({ forcedColors: theme === 'hc' ? 'active' : 'none', viewport: { width: 390, height: 160 } });
        try {
          await page.setContent(`<html data-brand="${brand}" data-theme="${theme}"><style>${tokens}\n${css}</style><body style="margin:0;padding:16px"><div data-oods-component="CycleProgressCard" style="width:240px"><progress style="width:200px" aria-label="Billing cycle" value="23" max="100"></progress></div></body></html>`);
          const meter = page.locator('progress');
          expect(await meter.evaluate((element: HTMLProgressElement) => ({ value: element.value, max: element.max }))).toEqual({ value: 23, max: 100 });
          const card = page.locator('[data-oods-component="CycleProgressCard"]');
          const box = (await card.boundingBox())!;
          const bar = (await meter.boundingBox())!;
          const png = await card.screenshot();
          const proof = await page.evaluate(async ({ data, row, fillX, trackX, cardX, edgeY }) => {
            const picture = new Image(); picture.src = `data:image/png;base64,${data}`; await picture.decode();
            const canvas = document.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(picture, 0, 0);
            const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
            const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
            const ratio = (a: number[], b: number[]) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + .05) / (y! + .05); };
            const fill = at(fillX, row), track = at(trackX, row), cardColor = at(cardX, row), edge = at(trackX, edgeY);
            return { fill, track, card: cardColor, edge, trackCard: ratio(track, cardColor), fillTrack: ratio(fill, track), fillCard: ratio(fill, cardColor), edgeCard: ratio(edge, cardColor) };
          }, {
            data: png.toString('base64'),
            row: Math.round(bar.y - box.y + bar.height / 2),
            fillX: Math.round(bar.x - box.x + bar.width * 0.1), trackX: Math.round(bar.x - box.x + bar.width * 0.75),
            cardX: Math.round(bar.x - box.x + bar.width + 12), edgeY: Math.round(bar.y - box.y),
          });
          if (theme === 'hc') {
            expect(proof.fill, 'forced-colors fill differs from the track').not.toEqual(proof.track);
            expect(proof.edgeCard, `forced-colors track outline against the card ${JSON.stringify(proof)}`).toBeGreaterThanOrEqual(3);
          } else {
            expect(proof.trackCard, `track against card ${JSON.stringify(proof)}`).toBeGreaterThanOrEqual(1.4);
            expect(proof.fillTrack, `fill against track ${JSON.stringify(proof)}`).toBeGreaterThanOrEqual(3);
            expect(proof.fillCard, `fill against card ${JSON.stringify(proof)}`).toBeGreaterThanOrEqual(3);
          }
        } finally { await page.close(); }
      }, 30_000);
    }
  });
}
