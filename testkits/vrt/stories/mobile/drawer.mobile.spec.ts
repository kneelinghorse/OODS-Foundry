/**
 * s173 m04 (crawl 3) — the contextPanel drawer, under touch.
 *
 * The jsdom tests cover the component's contract (inline when wide, trigger + named dialog
 * when narrow, threshold from the token). What they cannot cover is the part that only exists
 * in a browser: that a TAP opens it, that focus is actually trapped inside the panel, and that
 * Esc returns focus somewhere usable. Those are the reasons a modal drawer is acceptable on a
 * phone at all, so they are checked where they are real.
 *
 * The project supplies `hasTouch`, so `tap()` dispatches genuine touch events rather than
 * synthesised clicks.
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * The WIDE drawer story, used at both viewports on purpose: its frame is
 * `width: 1100px; max-width: 100%`, so the SAME story is a wide container at 1280 and a narrow
 * one at 375. Using the fixed-narrow story for the wide assertion would prove nothing — its
 * frame stays 375px however large the viewport is.
 */
const DRAWER_STORY = 'contexts-view-collapse--drawer-at-wide-container';

async function openStory(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/iframe.html?id=${DRAWER_STORY}&viewMode=story`, { waitUntil: 'load' });
  await page.waitForSelector('[data-context-panel-trigger="true"]');
}

test.describe('contextPanel drawer — touch behaviour at 375', () => {
  test('a TAP opens a modal dialog that carries the panel content', async ({ page }) => {
    await openStory(page);

    const trigger = page.locator('[data-context-panel-trigger="true"]');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await trigger.tap();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toContainText('Related records');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('focus is TRAPPED inside the open drawer', async ({ page }) => {
    await openStory(page);
    await page.locator('[data-context-panel-trigger="true"]').tap();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Tab several times — more than the panel has focusable children — and the active element
    // must still be inside the dialog every time. A drawer that let focus walk out into the
    // page behind it would be a screen-reader trap of the worse kind: the user reads content
    // that is visually covered.
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
      });
      expect(inside, `focus escaped the dialog after ${index + 1} Tab press(es)`).toBe(true);
    }
  });

  test('Esc closes it and the trigger goes back to advertising collapsed', async ({ page }) => {
    await openStory(page);
    const trigger = page.locator('[data-context-panel-trigger="true"]');
    await trigger.tap();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('at 1280 the same story has NO trigger — the drawer is a narrow-container affordance', async ({ page }) => {
    // Without this, every assertion above would still pass on a drawer that had swallowed the
    // rail at every width, which is the change this composition was explicitly designed not
    // to make.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/iframe.html?id=${DRAWER_STORY}&viewMode=story`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="shell-detail"]');

    await expect(page.locator('[data-context-panel-trigger="true"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="panel-detail"]')).toContainText('Related records');
  });
});
