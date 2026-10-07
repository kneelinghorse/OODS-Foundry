import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { loadStoryIndex, resolveStoryId } from '../utils/storybook';
const require = createRequire(import.meta.url);
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
for (const theme of ['light', 'dark']) test(`desktop form has no serious/critical WCAG 2.2 AA findings (${theme})`, async ({ page }) => {
  const entries = await loadStoryIndex(process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006');
  const id = resolveStoryId(entries, { title: ['Components/Primitives/Text Field', 'Forms/TextField'], name: 'Form Example' });
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  await page.locator('input').first().waitFor();
  await page.addScriptTag({ content: axe });
  const result = await page.evaluate(async tags => {
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        // @ts-expect-error axe is injected into the real browser.
        const result = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
        return { passes: result.passes.length, violations: result.violations.filter((entry: { impact: string }) => ['serious', 'critical'].includes(entry.impact)) };
      } catch (error) { if (!String(error).includes('already running')) throw error; await new Promise(resolve => setTimeout(resolve, 150)); }
    }
    throw new Error('Storybook axe never released the browser runner');
  }, tags);
  expect(result.passes).toBeGreaterThan(5);
  expect(result.violations).toEqual([]);
});
