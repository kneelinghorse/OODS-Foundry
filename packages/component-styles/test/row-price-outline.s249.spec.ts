/**
 * s249-m04 (next step 1877): money in a list row reads as text beside the status, as the time does. In high contrast and
 * forced colours it took the badges' inset outline while its padding was taken away, so the outline crossed its first
 * and last characters. A row's price now takes no outline and no border there; a price on a detail page, which keeps
 * its padding, keeps its outline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/components.css'), 'utf8').replace(/^@import[^;]+;\s*/gm, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

for (const forced of [false, true]) {
  it(`a row's price takes no outline in high contrast${forced ? ' with forced colours' : ''}, and a detail's price keeps its own`, async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 600 } });
    try {
      if (forced) await page.emulateMedia({ forcedColors: 'active' });
      await page.setContent(`<style>${css}</style><main data-theme="hc">
        <section data-oods-collection="rows"><div class="oods-collection"><div class="oods-collection-row">
          <div><strong>Analytics add-on</strong></div>
          <span id="row-price" data-oods-component="PriceBadge">$39.00 · monthly</span>
          <span id="row-billing" data-oods-component="BillingSummaryBadge">$49.00 · monthly</span>
        </div></div></section>
        <div data-oods-component="Stack" id="price-read-field"><span id="detail-price" data-oods-component="PriceBadge">$39.00</span></div>
      </main>`);
      const drawn = Object.fromEntries(await page.locator('#row-price, #row-billing, #detail-price').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return [node.id, { shadow: style.boxShadow, border: style.borderTopWidth, padding: style.paddingLeft }];
      })));
      for (const id of ['row-price', 'row-billing']) expect(drawn[id], id).toEqual({ shadow: 'none', border: '0px', padding: '0px' });
      // The detail's price keeps its padding and the inset outline high contrast draws inside it.
      expect(drawn['detail-price'].shadow).toMatch(/inset/);
      expect(drawn['detail-price'].padding).not.toBe('0px');
    } finally { await page.close(); }
  });
}
