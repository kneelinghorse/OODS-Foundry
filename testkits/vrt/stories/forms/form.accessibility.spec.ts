import { expect, test, type Locator, type Page } from '@playwright/test';

const STORY_ID = 'forms-text-field--form-example';

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
