import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Sprint 213 m01, Sprint 212 review finding 5: the Subscription payment chart stopped at its 720px design width, so at
 * 1440 it filled half the detail screen (the package README's main image). A placed chart now carries a wide render beside
 * the design and narrow ones, and a figure with a wide render fills its column. These tests read the laid-out figure in
 * two engines and hold, for a phone, a tablet and a desktop column:
 *  - the render drawn for that width is the one shown (narrow < 730px, design between, wide ≥ 1130px);
 *  - the shown SVG keeps at least its native size, grows by at most 1.25x, and keeps its aspect ratio;
 *  - a column wider than 1.25 times the wide render shows it at that size and no larger (#2347);
 *  - a figure without a wide render keeps its design width cap, so nothing else changed.
 */
const root = path.resolve(import.meta.dirname, '../../..');
const css = fs.readFileSync(path.join(root, 'packages/component-styles/src/components.css'), 'utf8').replace(/^@import[^\n]+\n/gmu, '');
const tokens = fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css'), 'utf8');
const svg = (width: number, height: number, label: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 10}" height="${height + 10}" viewBox="0 0 ${width + 10} ${height + 10}" data-render="${label}"><rect width="${width}" height="${height}" fill="currentColor"/></svg>`;
const figure = (wide: boolean) => `<figure data-oods-component="VizAreaPreview" data-viz-rendered="true" data-viz-narrow="true"${wide ? ' data-viz-wide="true"' : ''} style="--oods-viz-width:720px">`
  + `<figcaption>Payment amounts</figcaption><div data-viz-svg="true">${svg(720, 240, 'design')}</div><div data-viz-svg-narrow="true">${svg(292, 240, 'narrow')}</div>`
  + `${wide ? `<div data-viz-svg-wide="true">${svg(1120, 240, 'wide')}</div>` : ''}</figure>`;

for (const [engine, browserType] of Object.entries({ chromium, firefox })) {
  describe(`${engine} placed chart fills its column (s213-m01)`, () => {
    let browser: Browser;
    beforeAll(async () => { browser = await browserType.launch(); }, 60_000);
    afterAll(async () => { await browser?.close(); }, 30_000);
    for (const [column, render] of [[302, 'narrow'], [332, 'narrow'], [668, 'narrow'], [729, 'narrow'], [730, 'design'], [760, 'design'], [924, 'design'], [1130, 'wide'], [1344, 'wide']] as const) {
      it(`a ${column}px column shows the ${render} render at its bounded native scale`, async () => {
        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        try {
          await page.setContent(`<html data-brand="A" data-theme="light"><style>${tokens}\n${css}</style><body style="margin:0"><div style="width:${column}px">${figure(true)}</div></body></html>`);
          const shown = await page.evaluate(() => [...document.querySelectorAll('svg')].filter(node => node.getBoundingClientRect().width > 0).map(node => {
            const box = node.getBoundingClientRect();
            return { render: node.getAttribute('data-render'), width: box.width, height: box.height, ratio: Number(node.getAttribute('width')) / Number(node.getAttribute('height')) };
          }));
          expect(shown.map(entry => entry.render)).toEqual([render]);
          const native = render === 'narrow' ? 302 : render === 'design' ? 730 : 1130;
          expect(Math.abs(shown[0]!.width - Math.min(column, native * 1.25))).toBeLessThanOrEqual(1);
          expect(shown[0]!.width / native).toBeGreaterThanOrEqual(1);
          expect(Math.abs(shown[0]!.width / shown[0]!.height - shown[0]!.ratio)).toBeLessThan(0.01);
        } finally { await page.close(); }
      }, 30_000);
    }
    it('a 1600px column shows the wide render at 1.25 times its size and no larger', async () => {
      const page = await browser.newPage({ viewport: { width: 1700, height: 900 } });
      try {
        await page.setContent(`<html data-brand="A" data-theme="light"><style>${tokens}\n${css}</style><body style="margin:0"><div style="width:1600px">${figure(true)}</div></body></html>`);
        const shown = await page.evaluate(() => [...document.querySelectorAll('svg')].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ render: node.getAttribute('data-render'), width: node.getBoundingClientRect().width, own: Number(node.getAttribute('width')) })));
        expect(shown.map(entry => entry.render)).toEqual(['wide']);
        expect(Math.abs(shown[0]!.width - shown[0]!.own * 1.25)).toBeLessThanOrEqual(1);
      } finally { await page.close(); }
    }, 30_000);
    it('a figure without a wide render keeps its design width at 1344px', async () => {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      try {
        await page.setContent(`<html data-brand="A" data-theme="light"><style>${tokens}\n${css}</style><body style="margin:0"><div style="width:1344px">${figure(false)}</div></body></html>`);
        const width = await page.evaluate(() => [...document.querySelectorAll('svg')].map(node => node.getBoundingClientRect().width).find(value => value > 0));
        expect(width).toBe(720);
      } finally { await page.close(); }
    }, 30_000);
  });
}
