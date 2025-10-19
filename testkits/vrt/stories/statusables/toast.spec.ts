import { expect, test } from '@playwright/test';

const STORY_ID = 'statusables-toast--default';

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
