import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * s224-m01 (#2542 ruling 2; the website's message d3b3935e): the Tabs "More" trigger and its menu's items are tabs, not
 * browser buttons, measured in Chromium on the shipped stylesheet. The website showed the trigger as a grey bevelled box
 * beside three flat tabs. Each paints as an unselected tab (no fill, no border but the transparent indicator, the tab's
 * text, type and pointer) in light, dark and forced-colour hc, and the open menu overlays the panel under the trigger
 * instead of growing the row. A tab list without the menu (the HTML renderer's) still scrolls.
 */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const read = (file: string) => fs.readFileSync(path.join(packageRoot, file), 'utf8');
const componentsCss = read('src/components.css');
const shippedCss = [fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8'),
  ...[...componentsCss.matchAll(/^@import "\.\/([^"]+)";/gm)].map(([, file]) => (file === 'statusables.css'
    ? fs.readFileSync(path.join(repoRoot, 'src/styles/statusables.css'), 'utf8') : read(`src/${file}`))),
  componentsCss].map(css => css.replace(/^@import[^;]+;\s*/gm, '')).join('\n');

const tabs = (labels: string[]) => labels.map((label, index) => `<button class="oods-tab" role="tab" type="button" aria-selected="${index === 0}">${label}</button>`).join('');
const items = ['Timeline', 'Card', 'Inline', 'Workflow'].map(label => `<button type="button" role="menuitem">${label}</button>`).join('');
// The overflow markup React and Vue write (packages/components-react/src/tabs.tsx, packages/components-vue/src/tabs.ts).
const overflow = (open: boolean) => `<div class="oods-tabs__overflow oods-tabs-overflow"><button type="button" class="tabs__overflow-trigger oods-tabs-overflow-trigger" aria-label="More tabs" aria-haspopup="menu" aria-expanded="${open}" data-tabs-overflow-trigger="true">More</button>${open ? `<div class="tabs__overflow-menu oods-tabs-overflow-menu" role="menu">${items}</div>` : ''}</div>`;
const tabsCase = (id: string, list: string) => `<div id="${id}" class="oods-tabs" data-oods-component="Tabs" data-size="md"><div class="oods-tab-list" role="tablist">${list}</div><div class="oods-tab-panel" role="tabpanel">Detail context</div></div>`;
const markup = [
  tabsCase('closed', tabs(['Detail', 'List', 'Form']) + overflow(false)),
  tabsCase('open', tabs(['Detail', 'List', 'Form']) + overflow(true)),
  tabsCase('scrolls', tabs(['Detail', 'List', 'Form', 'Timeline', 'Card', 'Inline', 'Workflow'])),
].join('');

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

describe('s224-m01 the Tabs "More" trigger and its menu are tabs', () => {
  for (const brand of ['A', 'B'] as const) {
    for (const theme of ['light', 'dark', 'hc'] as const) {
      it(`paints the trigger and the menu's items as a tab, and overlays the open menu, in ${brand}/${theme}`, async () => {
        const page = await browser.newPage({ viewport: { width: 390, height: 480 }, colorScheme: theme === 'light' ? 'light' : 'dark', forcedColors: theme === 'hc' ? 'active' : 'none' });
        await page.setContent(`<!doctype html><html data-brand="${brand}" data-theme="${theme}"><head><style>${shippedCss}</style><style>.oods-tabs { inline-size: 358px; margin-block-end: 16px; }</style></head><body>${markup}</body></html>`);
        const proof = await page.evaluate(() => {
          const paint = (element: Element) => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color, borderTop: `${style.borderTopWidth} ${style.borderTopStyle}`,
              borderBottom: `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`,
              font: `${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`, padding: style.padding, cursor: style.cursor };
          };
          const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
          return {
            tab: paint(document.querySelector('#closed [role="tab"][aria-selected="false"]')!),
            trigger: paint(document.querySelector('#closed [aria-haspopup="menu"]')!),
            items: [...document.querySelectorAll('#open [role="menuitem"]')].map((item) => ({ ...paint(item), textAlign: getComputedStyle(item).textAlign })),
            rowHeights: { closed: box('#closed [role="tablist"]').height, open: box('#open [role="tablist"]').height },
            triggerBottom: box('#open [aria-haspopup="menu"]').bottom,
            tabBottom: box('#open [role="tab"]').bottom,
            listBottom: box('#open [role="tablist"]').bottom,
            menu: { position: getComputedStyle(document.querySelector('#open [role="menu"]')!).position, top: box('#open [role="menu"]').top, right: box('#open [role="menu"]').right },
            triggerRight: box('#open [aria-haspopup="menu"]').right,
            listOverflow: { open: getComputedStyle(document.querySelector('#open [role="tablist"]')!).overflowY, scrolls: getComputedStyle(document.querySelector('#scrolls [role="tablist"]')!).overflowX },
            menuShown: (() => { const menu = box('#open [role="menu"]'); const hit = document.elementFromPoint(menu.left + menu.width / 2, menu.top + 20); return hit?.getAttribute('role') ?? hit?.parentElement?.getAttribute('role'); })(),
          };
        });

        // The trigger is a tab: the browser's grey bevelled button is gone in every theme.
        expect(proof.trigger).toEqual(proof.tab);
        expect(proof.tab).toMatchObject({ background: 'rgba(0, 0, 0, 0)', borderTop: '0px none', cursor: 'pointer' });
        expect(proof.tab.borderBottom).toMatch(/^2px solid rgba\(0, 0, 0, 0\)$/);
        // Each item is a tab too, its label at the start of the menu's row.
        expect(proof.items).toHaveLength(4);
        for (const item of proof.items) expect(item).toEqual({ ...proof.tab, textAlign: 'start' });
        // The open menu sits on top of the panel, under the trigger and flush with its end, so the row keeps its height
        // and the trigger's indicator stays on the row's rule; it is not clipped (the point under it is a menu item).
        expect(proof.rowHeights.open).toBe(proof.rowHeights.closed);
        expect(proof.triggerBottom).toBe(proof.tabBottom);
        expect(proof.menu.position).toBe('absolute');
        expect(proof.menu.top).toBeGreaterThanOrEqual(proof.listBottom);
        expect(proof.menu.right).toBe(proof.triggerRight);
        expect(proof.listOverflow.open).toBe('visible');
        expect(proof.menuShown).toBe('menuitem');
        // A list with no menu, as the HTML renderer writes it, still scrolls its tabs.
        expect(proof.listOverflow.scrolls).toBe('auto');
        // Hover raises the trigger and an item to the primary text, as it raises a tab (the selected tab's colour).
        const color = (selector: string) => page.evaluate((target) => getComputedStyle(document.querySelector(target)!).color, selector);
        const primary = await color('#closed [role="tab"][aria-selected="true"]');
        for (const selector of ['#closed [aria-haspopup="menu"]', '#open [role="menuitem"]']) {
          await page.hover(selector);
          expect(await color(selector), selector).toBe(primary);
        }
        await page.close();
      }, 30_000);
    }
  }
});
