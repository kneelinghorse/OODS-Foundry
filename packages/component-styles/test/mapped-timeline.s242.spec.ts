import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/components.css'), 'utf8').replace(/^@import[^;]+;\s*/gm, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  it(`insets the mapped Vue timeline like React without moving other cards at ${width}px in ${theme}`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 600 } });
    try {
      // The team's card supplies vertical padding only. React's adapter supplies px-4;
      // Vue wraps that surface, so padding the wrapper would leave the text against its border.
      await page.setContent(`<style>@layer team {
        .team-card { border: 1px solid; padding: 24px 0; }
        .react-card { padding-inline: 16px; }
      } ${css}</style><main data-theme="${theme}">
        <section data-oods-collection="events"><ol class="oods-collection"><li>
          <div id="react" data-oods-adapter="Card" class="team-card react-card"><strong>Event</strong></div>
        </li><li><div data-oods-adapter="Card">
          <div id="vue" class="team-card" data-oods-card-surface><strong>Event</strong></div>
        </div></li></ol></section>
        <div data-oods-adapter="Card"><div id="other" class="team-card" data-oods-card-surface><strong>Detail</strong></div></div>
      </main>`);
      const insets = await page.locator('#react, #vue, #other').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { id: node.id, start: style.paddingInlineStart, end: style.paddingInlineEnd,
          textInset: node.firstElementChild!.getBoundingClientRect().left - node.getBoundingClientRect().left };
      }));
      expect(insets).toEqual([
        { id: 'react', start: '16px', end: '16px', textInset: 17 },
        { id: 'vue', start: '16px', end: '16px', textInset: 17 },
        { id: 'other', start: '0px', end: '0px', textInset: 1 },
      ]);
    } finally { await page.close(); }
  });
}
