/**
 * s249-m04 (next step 1837): on dark, a generated React timeline's mapped entries sat on the team's navy card while Vue's
 * sat on its grey one. A team's mapped card in a timeline now takes no fill of its own, as OODS's own event cards take
 * none, whichever shape the adapter has: React's is the card itself, Vue's wraps it. A mapped card elsewhere keeps its fill.
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

for (const theme of ['light', 'dark']) {
  it(`a mapped timeline entry takes no fill of its own in React and Vue, and a mapped card elsewhere keeps its own, in ${theme}`, async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 600 } });
    try {
      // Two teams' card fills, as the two example projects draw them in dark: navy in React's, grey in Vue's.
      await page.setContent(`<style>@layer team {
        .team-card { border: 1px solid; padding: 24px 0; }
        .react-card { padding-inline: 16px; background: rgb(2, 8, 23); }
        .vue-card { background: rgb(26, 26, 26); }
      } ${css}</style><main data-theme="${theme}">
        <section data-oods-collection="events"><ol class="oods-collection"><li>
          <div id="react" data-oods-adapter="Card" class="team-card react-card"><strong>Event</strong></div>
        </li><li><div id="vue-adapter" data-oods-adapter="Card">
          <div id="vue" class="team-card vue-card" data-oods-card-surface><strong>Event</strong></div>
        </div></li></ol></section>
        <div data-oods-adapter="Card"><div id="other" class="team-card vue-card" data-oods-card-surface><strong>Detail</strong></div></div>
        <div id="other-react" data-oods-adapter="Card" class="team-card react-card"><strong>Detail</strong></div>
      </main>`);
      const fills = Object.fromEntries(await page.locator('#react, #vue, #vue-adapter, #other, #other-react').evaluateAll(nodes => nodes.map(node => [node.id, getComputedStyle(node).backgroundColor])));
      expect(fills).toEqual({ react: 'rgba(0, 0, 0, 0)', vue: 'rgba(0, 0, 0, 0)', 'vue-adapter': 'rgba(0, 0, 0, 0)', other: 'rgb(26, 26, 26)', 'other-react': 'rgb(2, 8, 23)' });
    } finally { await page.close(); }
  });
}
