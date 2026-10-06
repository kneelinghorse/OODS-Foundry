import { expect, test } from '@playwright/test';
import { loadStoryIndex, resolveStoryId } from '../utils/storybook';

// s174 m03 — this spec's hard-coded `statusables-toast--default` id died in the 2025-10-21
// taxonomy normalization (488191c); the
// story is now under Components/Statusables/Toast, and nothing automated ran the desktop
// project to notice.
// Index resolution makes a future rename fail by NAME rather than by mystery locator.
const STORY_TITLES = ['Components/Statusables/Toast', 'Statusables/Toast'] as const;
const STORY_NAME = 'Default';
const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

let STORY_ID: string;

test.beforeAll(async () => {
  const entries = await loadStoryIndex(STORYBOOK_URL);
  STORY_ID = resolveStoryId(entries, { title: [...STORY_TITLES], name: STORY_NAME });
});

test.describe('Statusables/Toast', () => {
  test('announces politely and restores focus on dismiss', async ({ page }) => {
    await page.goto(`/iframe.html?id=${STORY_ID}&viewMode=story`);

    const trigger = page.getByTestId('toast-trigger');
    await trigger.waitFor({ state: 'visible' });
    await trigger.click();

    const toast = page.getByRole('status');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expect(toast).toHaveAttribute('data-state', 'open');
    await expect(toast).toBeFocused();

    await toast.press('Escape');

    await expect(toast).toHaveAttribute('data-state', 'closed');
    await expect(trigger).toBeFocused();
  });
});
