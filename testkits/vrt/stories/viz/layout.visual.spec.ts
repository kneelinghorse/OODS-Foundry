import { expect, test } from '@playwright/test';
import { loadStoryIndex, resolveStoryId } from '../utils/storybook';

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

type LayoutTarget = {
  title: string;
  name: string;
  slug: string;
  selector?: string;
};

const LAYOUT_TARGETS: LayoutTarget[] = [
  { title: 'Visualization/VizFacetGrid', name: 'Region Segment Grid', slug: 'viz-facet-grid' },
  { title: 'Visualization/VizLayeredView', name: 'Default Layered View', slug: 'viz-layered-view' },
  {
    title: 'Proofs/Dashboard Contexts',
    name: 'Subscription MRR dashboard',
    slug: 'viz-dashboard',
    selector: '[data-view=\"dashboard\"]',
  },
];

const THEMES = ['light', 'dark'] as const;
const storyIds = new Map<string, string>();

test.beforeAll(async () => {
  const entries = await loadStoryIndex(STORYBOOK_URL);
  for (const target of LAYOUT_TARGETS) {
    const id = resolveStoryId(entries, { title: target.title, name: target.name });
    storyIds.set(target.slug, id);
  }
});

test.describe('Viz layout fallback coverage', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Layout visual coverage only runs on Chromium');

  for (const theme of THEMES) {
    for (const target of LAYOUT_TARGETS) {
      test(`${target.title} → ${theme}`, async ({ page }) => {
        const storyId = storyIds.get(target.slug);
        if (!storyId) {
          throw new Error(`Missing Storybook id for ${target.title}`);
        }
        await page.goto(buildStoryUrl(storyId, theme));
        const canvas = page.locator(target.selector ?? '#storybook-root').first();
        await canvas.waitFor({ state: 'visible' });
        await page.waitForTimeout(250);

        await expect(canvas).toHaveScreenshot(`${target.slug}-${theme}.png`, {
          animations: 'disabled',
          caret: 'hide',
          scale: 'device',
        });
      });
    }
  }

  for (const target of LAYOUT_TARGETS) {
    test(`${target.title} → forced colors`, async ({ page }) => {
      const storyId = storyIds.get(target.slug);
      if (!storyId) {
        throw new Error(`Missing Storybook id for ${target.title}`);
      }
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'dark' });
      await page.goto(buildStoryUrl(storyId, 'dark'));
      const canvas = page.locator(target.selector ?? '#storybook-root').first();
      await canvas.waitFor({ state: 'visible' });
      await page.waitForTimeout(250);

      await expect(canvas).toHaveScreenshot(`${target.slug}-forced-colors.png`, {
        animations: 'disabled',
        caret: 'hide',
        scale: 'device',
      });
    });
  }
});

function buildStoryUrl(id: string, theme: 'light' | 'dark'): string {
  const globals = encodeURIComponent(`theme:${theme};brand:brand-a`);
  return `/iframe.html?id=${id}&viewMode=story&globals=${globals}`;
}
