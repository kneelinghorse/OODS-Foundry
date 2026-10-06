/**
 * s173 m04 (crawl 3) — the view-context collapse, verified in a real engine.
 *
 * Everything else that checks the collapse checks the STYLESHEET: that the rules exist, cover
 * all eight contexts, and sit at the right specificity. None of that runs a container query,
 * because jsdom has none. This file is the only place the collapse is observed happening.
 *
 * BEHAVIOURAL ONLY — zero `toHaveScreenshot`. A committed screenshot corpus was declined for
 * this sprint (platform-dependent baselines, no CI runner to regenerate them, and Chromatic's
 * autoAcceptChanges:'main' would have self-ratified whatever the first run produced). What is
 * asserted here is computed layout, which is the property the collapse actually claims.
 *
 * THE DISCRIMINATION PROBE, for the reviewer: revert the `@container view-shell (max-width:
 * 48rem)` block in a scratch tree and re-run — the narrow assertions below must RED. They are
 * written against computed `grid-template-columns`, so they cannot pass on a stylesheet that
 * does not collapse.
 */
import { expect, test, type Page } from '@playwright/test';

const PROOF_STORY = 'contexts-view-collapse--rail-at-wide-container';

/** sys.breakpoint.md. Written out because a Playwright spec cannot import the token bundle. */
const COLLAPSE_PX = 768;

async function openProofStory(page: Page): Promise<void> {
  await page.goto(`/iframe.html?id=${PROOF_STORY}&viewMode=story`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="shell-detail"]');
}

/** The computed column track list of the detail content group, and the shell's own width. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="shell-detail"]') as HTMLElement | null;
    const group = document.querySelector('[data-testid="group-detail"]') as HTMLElement | null;
    const panel = document.querySelector('[data-testid="panel-detail"]') as HTMLElement | null;
    const columns = group ? getComputedStyle(group).gridTemplateColumns : '';
    return {
      shellWidth: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
      columns,
      columnCount: columns.trim() ? columns.trim().split(/\s+/).length : 0,
      panelMinInlineSize: panel ? getComputedStyle(panel).minInlineSize : '',
    };
  });
}

test.describe('view-context collapse — computed layout across the threshold', () => {
  test('at 375 the detail content group is a SINGLE column and the rail floor is released', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openProofStory(page);
    const result = await measure(page);

    expect(result.shellWidth).toBeLessThanOrEqual(COLLAPSE_PX);
    expect(result.columnCount).toBe(1);
    // The rail floor is what starved main before the collapse: an 18rem minimum inside a
    // 375px shell. Released means 0px, not "smaller".
    expect(result.panelMinInlineSize).toBe('0px');
  });

  test('at 1280 the SAME story is two columns — the collapse is scoped, not a global stack', async ({ page }) => {
    // The pair is what makes this a control: a spec that only ever measured 375 would pass
    // just as well against a stylesheet that stacked every view at every width.
    await page.setViewportSize({ width: 1280, height: 900 });
    await openProofStory(page);
    const result = await measure(page);

    expect(result.shellWidth).toBeGreaterThan(COLLAPSE_PX);
    expect(result.columnCount).toBe(2);
    expect(result.panelMinInlineSize).not.toBe('0px');
  });

  test('the switch is governed by the CONTAINER width against the token, across a sweep', async ({ page }) => {
    // Asserting "collapses at viewport 768" would be wrong here and would pass by luck: the
    // shell is inset by the story frame's border and the canvas padding, so the container is
    // always a few px narrower than the viewport. The rule being tested is the real one —
    // single column IFF the CONTAINER is at or below sys.breakpoint.md — and it is checked at
    // every width in a sweep that crosses the threshold, including two widths whose viewport
    // is above 768 while their container is not.
    const observations: Array<{ viewport: number; shellWidth: number; columnCount: number }> = [];
    for (const width of [320, 375, 600, 760, 768, 780, 900, 1280]) {
      await page.setViewportSize({ width, height: 1024 });
      await openProofStory(page);
      const result = await measure(page);
      observations.push({ viewport: width, shellWidth: result.shellWidth, columnCount: result.columnCount });
    }

    for (const observation of observations) {
      expect(observation.columnCount, JSON.stringify(observation)).toBe(observation.shellWidth <= COLLAPSE_PX ? 1 : 2);
    }
    // The sweep has to actually cross the boundary, or the loop above is satisfiable by a
    // stylesheet that never collapses (or always does).
    expect(observations.some((o) => o.columnCount === 1)).toBe(true);
    expect(observations.some((o) => o.columnCount === 2)).toBe(true);
  });
});
