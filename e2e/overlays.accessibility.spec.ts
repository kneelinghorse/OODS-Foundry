import { expect, test } from '@playwright/test';

const STORY_ID = 'explorer-proofs-overlay-manager--manager-proof';

test.describe('Overlay manager accessibility', () => {
  test('traps focus, restores trigger, and renders with high-contrast tokens', async ({ page }) => {
    await page.goto(`/iframe.html?id=${STORY_ID}&viewMode=story`);

    const openOverlay = page.getByRole('button', { name: 'Open Overlay' });
    await openOverlay.focus();
    await expect(openOverlay).toBeFocused();

    await openOverlay.click();

    const dialog = page.getByRole('dialog', { name: /overlay manager proof/i });
    await expect(dialog).toBeVisible();

    const firstInput = page.getByPlaceholder('Focusable input');
    await expect(firstInput).toBeFocused();

    await page.keyboard.press('Tab');
    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    await expect(confirmButton).toBeFocused();

    await page.keyboard.press('Tab');
    const closeButton = page.getByRole('button', { name: 'Close' });
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(firstInput).toBeFocused();

    await page.emulateMedia({ forcedColors: 'active' });
    const forcedColorsActive = await page.evaluate(() =>
      globalThis.matchMedia?.('(forced-colors: active)').matches ?? false
    );
    expect(forcedColorsActive).toBe(true);

    const borderWidth = await dialog.evaluate((node) => {
      const style = getComputedStyle(node as HTMLElement);
      return parseFloat(style.borderWidth || '0');
    });
    expect(borderWidth).toBeGreaterThanOrEqual(2);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(openOverlay).toBeFocused();
  });
});
