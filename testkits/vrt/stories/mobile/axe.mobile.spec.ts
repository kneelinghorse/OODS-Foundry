/**
 * s173 m04 (crawl 3) — axe at 375, with the drawer OPEN.
 *
 * The a11y contract runs axe at 1280x720 over six pinned stories. A drawer that only exists
 * below 768px is invisible to it — so the one surface this sprint adds is the one surface the
 * existing accessibility gate structurally cannot see.
 *
 * OPEN, not closed, and that is the whole point. With the drawer closed there is nothing to
 * scan but a button: `aria-modal` and the inert-outside treatment mean the interesting DOM
 * does not exist yet. A closed-state scan would return a clean report and prove nothing —
 * theatre, in the precise sense this project uses the word.
 *
 * TWO THINGS LEARNED HERE, both from failures rather than from planning:
 *   - Storybook's own a11y addon ships axe INTO the page, and axe refuses to run twice at
 *     once ("Axe is already running"). The run is retried rather than raced.
 *   - "Zero violations" is the same result whether axe examined a modal full of content or
 *     examined nothing at all, so the second test re-runs axe SCOPED to the dialog and
 *     asserts the operand: rules actually evaluated, on nodes actually inside it.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const DRAWER_STORY = 'contexts-view-collapse--drawer-at-wide-container';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface AxeRunSummary {
  readonly violations: Array<{ id: string; impact: string | null; nodes: number; help: string }>;
  readonly rulesEvaluated: number;
  readonly nodesInDialog: number;
}

/** Open the story at a narrow width with the drawer showing. */
async function openDrawer(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/iframe.html?id=${DRAWER_STORY}&viewMode=story`, { waitUntil: 'load' });
  const trigger = page.locator('[data-context-panel-trigger="true"]');
  await trigger.waitFor();
  await trigger.tap();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Run axe over `context`, retrying while Storybook's own addon holds the singleton.
 * Returns violations plus the two operand facts that make a clean result meaningful.
 */
async function runAxe(page: Page, scopeToDialog: boolean): Promise<AxeRunSummary> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(
    async ({ tags, scoped }) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const context = scoped ? { include: [['[role="dialog"]']] } : document;
      let results: Record<string, unknown> | undefined;
      let lastError = '';
      for (let attempt = 0; attempt < 25; attempt += 1) {
        try {
          // @ts-expect-error — axe is injected into the page, not imported by the spec.
          results = await window.axe.run(context as never, { runOnly: { type: 'tag', values: tags } });
          break;
        } catch (error) {
          lastError = String((error as Error)?.message ?? error);
          if (!lastError.includes('already running')) {
            throw error;
          }
          await sleep(150);
        }
      }
      if (!results) {
        throw new Error(`axe never got a turn after 25 attempts: ${lastError}`);
      }
      const passes = results.passes as Array<{ nodes: Array<{ html: string }> }>;
      const violations = results.violations as Array<Record<string, unknown>>;
      const incomplete = results.incomplete as unknown[];
      return {
        violations: violations.map((violation) => ({
          id: violation.id as string,
          impact: (violation.impact as string) ?? null,
          nodes: (violation.nodes as unknown[]).length,
          help: violation.help as string,
        })),
        rulesEvaluated: passes.length + violations.length + incomplete.length,
        nodesInDialog: passes
          .flatMap((pass) => pass.nodes)
          .filter((node) => typeof node.html === 'string' && node.html.includes('aria-modal')).length,
      };
    },
    { tags: WCAG_TAGS, scoped: scopeToDialog },
  );
}

test.describe('accessibility at 375 — the state the 1280 contract cannot reach', () => {
  test('the OPEN drawer has zero axe violations, document-wide', async ({ page }) => {
    await openDrawer(page);
    const result = await runAxe(page, false);
    expect(result.violations, JSON.stringify(result.violations, null, 1)).toEqual([]);
  });

  test('the scan is NOT vacuous: axe really ran, scoped to the dialog', async ({ page }) => {
    // A zero-violation result has the same shape whether axe examined a modal full of content
    // or failed to see it. Re-running with the context RESTRICTED to the dialog makes the
    // operand explicit: if the drawer were not there, or not a dialog, this errors or returns
    // nothing rather than passing quietly.
    await openDrawer(page);
    const scoped = await runAxe(page, true);

    expect(scoped.rulesEvaluated).toBeGreaterThan(5);
    expect(scoped.nodesInDialog).toBeGreaterThan(0);
    expect(scoped.violations, JSON.stringify(scoped.violations, null, 1)).toEqual([]);
  });
});
