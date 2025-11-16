import { expect, test } from '@playwright/test';
import { loadStoryIndex, resolveStoryId } from '../utils/storybook';

type Target = {
  title: string;
  name: string;
  screenshot: string;
};

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

const TARGETS: Target[] = [
  { title: 'BrandA/Button', name: 'Dark', screenshot: 'brand-a-button-dark-hc.png' },
  { title: 'BrandA/Badge', name: 'Dark', screenshot: 'brand-a-badge-dark-hc.png' },
  { title: 'BrandA/Banner', name: 'Dark', screenshot: 'brand-a-banner-dark-hc.png' },
  { title: 'BrandA/Input', name: 'Dark', screenshot: 'brand-a-input-dark-hc.png' },
  { title: 'BrandA/Select', name: 'Dark', screenshot: 'brand-a-select-dark-hc.png' },
  { title: 'BrandA/Tabs', name: 'Dark', screenshot: 'brand-a-tabs-dark-hc.png' },
  { title: 'BrandA/Form', name: 'Dark', screenshot: 'brand-a-form-dark-hc.png' },
  { title: 'BrandA/Timeline', name: 'Dark', screenshot: 'brand-a-timeline-dark-hc.png' }
];

let storyIdMap: Map<string, string>;

test.beforeAll(async () => {
  const entries = await loadStoryIndex(STORYBOOK_URL);
  storyIdMap = new Map(
    TARGETS.map((target) => {
      const id = resolveStoryId(entries, { title: target.title, name: target.name });
      return [`${target.title}/${target.name}`, id];
    })
  );
});

test.describe('Brand A high-contrast coverage', () => {
  for (const target of TARGETS) {
    test(`${target.title} → ${target.name}`, async ({ page }) => {
      const key = `${target.title}/${target.name}`;
      const storyId = storyIdMap.get(key);
      if (!storyId) {
        throw new Error(`Missing Storybook id for ${key}`);
      }

      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'dark' });
      await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);

      const storyRoot = page.locator('[data-brand="A"][data-theme="dark"]').first();
      await storyRoot.waitFor({ state: 'visible' });

      // Allow fonts + animations to settle under forced-colors.
      await page.waitForTimeout(200);

      await expect(storyRoot).toHaveScreenshot(target.screenshot, {
        animations: 'disabled',
        caret: 'hide',
        scale: 'device'
      });
    });
  }
});
