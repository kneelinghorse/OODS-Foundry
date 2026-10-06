import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadStoryIndex, resolveStoryId } from '../utils/storybook';

// s174 m03 — this spec hard-coded `forms-text-field--form-example`, but its title was
// `Forms/TextField` when both landed in d6f2567; that title generates
// `forms-textfield--form-example`. The id was invalid from inception, then 488191c moved the
// story to Components/Primitives/Text Field. No CI job ran the desktop project to expose it.
//
// Resolving through the story index does NOT make the spec rot-proof — brand-a.spec.ts used
// this same resolver and rotted anyway when its titles were deleted. What it buys is a LOUD
// AND NAMED failure ("Story not found for titles: ...") instead of a goto that renders the
// Storybook 404 page and then fails on some unrelated missing locator, and it survives
// changes to the id scheme. The alias list carries the known former title so a checkout
// mid-reorg resolves either way.
const STORY_TITLES = ['Components/Primitives/Text Field', 'Forms/TextField'] as const;
const STORY_NAME = 'Form Example';
const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

let STORY_ID: string;

test.beforeAll(async () => {
  const entries = await loadStoryIndex(STORYBOOK_URL);
  STORY_ID = resolveStoryId(entries, { title: [...STORY_TITLES], name: STORY_NAME });
});

async function getDescribedText(page: Page, locator: Locator): Promise<string[]> {
  const describedBy = await locator.getAttribute('aria-describedby');
  if (!describedBy) {
    return [];
  }

  const ids = describedBy
    .split(/\s+/)
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  const texts = await Promise.all(
    ids.map(async (id) => {
      const element = page.locator(`#${id}`);
      const content = await element.textContent();
      return content?.trim() ?? '';
    })
  );

  return texts.filter(Boolean);
}

test.describe('Forms/FormExample story', () => {
  test('tabs through fields and exposes assistive descriptions', async ({ page }) => {
    await page.goto(`/iframe.html?id=${STORY_ID}&viewMode=story`);

    const form = page.getByTestId('form-example');
    await expect(form).toBeVisible();

    const emailField = page.getByLabel('Email address');
    await expect(emailField).toBeVisible();
    await emailField.focus();
    await expect(emailField).toBeFocused();

    const emailDescriptions = await getDescribedText(page, emailField);
    expect(emailDescriptions).toContain(
      'We send receipts and incident updates to this address.'
    );
    expect(emailDescriptions).toContain(
      'Use a monitored inbox for critical alerts.'
    );

    await page.keyboard.press('Tab');
    const planSelect = page.getByLabel('Plan');
    await expect(planSelect).toBeFocused();
    const planDescriptions = await getDescribedText(page, planSelect);
    expect(planDescriptions).toContain(
      'Plan synced with provisioning defaults.'
    );

    await page.keyboard.press('Tab');
    const policiesCheckbox = page.getByLabel('Agree to billing policies');
    await expect(policiesCheckbox).toBeFocused();
    const complianceDescriptions = await getDescribedText(page, policiesCheckbox);
    expect(complianceDescriptions).toContain(
      'Acknowledges dunning procedures and incident communication cadence.'
    );
    expect(complianceDescriptions).toContain(
      'Policies must be acknowledged before continuing.'
    );
    await expect(policiesCheckbox).toHaveAttribute('aria-invalid', 'true');

    await page.keyboard.press('Tab');
    const submitButton = page.getByTestId('form-submit');
    await expect(submitButton).toBeFocused();
  });
});
