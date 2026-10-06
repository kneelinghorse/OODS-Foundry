import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/components.css'), 'utf8').replace(/^@import[^;]+;\s*/gm, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

for (const width of [390, 1440]) {
  it(`a mapped fixed-height button grows to contain the record's fields at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 600 } });
    try {
      // Tailwind's layered button sizing must not clip a row when its fields wrap onto several lines.
      await page.setContent(`<style>@layer utilities { .team-button { height: 32px; } } ${css}</style>
        <div data-oods-collection="rows"><ul class="oods-collection"><li>
          <button type="button" class="team-button oods-collection-row"><span>Harbor Cold Store</span>
            <span>Active</span><span>Full</span><time>Sep 15, 2026, 12:00 PM</time></button>
        </li></ul></div>`);
      const clipped = () => page.locator('.oods-collection-row').evaluate(row => {
        const bounds = row.getBoundingClientRect();
        return [...row.children].filter(child => {
          const box = child.getBoundingClientRect();
          return box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1;
        }).map(child => child.textContent);
      });
      expect(await clipped()).toEqual([]);
      if (width === 390) {
        await page.locator('.oods-collection-row').evaluate(row => (row as HTMLElement).style.height = '32px');
        expect(await clipped(), 'the old fixed height loses the status and date').not.toEqual([]);
      }
    } finally { await page.close(); }
  });
}
