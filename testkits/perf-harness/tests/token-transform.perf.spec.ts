import { test, expect } from '../utils/perfTest';
import { createSnapshot } from '../utils/schema';
import { flushResults } from '../utils/resultsStore';

test.afterAll(async () => {
  await flushResults();
});

async function getUserTimingEntry(page: import('@playwright/test').Page, name: string) {
  return page.evaluate((metricName) => {
    const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
    return metrics.filter((metric) => metric.name === metricName).pop() ?? null;
  }, name);
}

async function getProfilerMetric(page: import('@playwright/test').Page, id: string) {
  return page.evaluate((metricId) => {
    const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
    return metrics.filter((metric) => metric.id === metricId).pop() ?? null;
  }, id);
}

test.describe('Token Transform Performance', () => {
  test('captures brand switch measurements', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-token-transform-harness--brand-switch');
    await page.waitForSelector('[data-testid="perf-brand-toggle"]');

    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const toggle = page.getByTestId('perf-brand-toggle');
    await toggle.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'TokenTransform.BrandSwitch');
    });

    const timingEntry = await getUserTimingEntry(page, 'TokenTransform.BrandSwitch');
    const profilerMetric = await getProfilerMetric(page, 'TokenTransform.BrandSwitch');

    expect(timingEntry, 'Expected user timing metric for brand switch').not.toBeNull();
    expect(profilerMetric, 'Expected profiler metric for brand switch').not.toBeNull();

    if (timingEntry) {
      await recordSnapshot(
        createSnapshot('TokenTransform.BrandSwitch', 'UserTiming.duration', timingEntry.duration, {
          unit: 'ms',
          parameters: { operation: 'data-brand' },
        }),
      );
      expect(timingEntry.duration).toBeLessThan(40);
    }

    if (profilerMetric) {
      await recordSnapshot(
        createSnapshot('TokenTransform.BrandSwitch', 'React.actualDuration', profilerMetric.actualDuration, {
          unit: 'ms',
        }),
      );
    }
  });

  test('captures theme toggle measurements', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-token-transform-harness--theme-toggle');
    await page.waitForSelector('[data-testid="perf-theme-toggle"]');

    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const toggle = page.getByTestId('perf-theme-toggle');
    await toggle.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'TokenTransform.ThemeToggle');
    });

    const timingEntry = await getUserTimingEntry(page, 'TokenTransform.ThemeToggle');
    const profilerMetric = await getProfilerMetric(page, 'TokenTransform.ThemeToggle');

    expect(timingEntry, 'Expected user timing metric for theme toggle').not.toBeNull();
    expect(profilerMetric, 'Expected profiler metric for theme toggle').not.toBeNull();

    if (timingEntry) {
      await recordSnapshot(
        createSnapshot('TokenTransform.ThemeToggle', 'UserTiming.duration', timingEntry.duration, {
          unit: 'ms',
          parameters: { operation: 'data-theme' },
        }),
      );
      expect(timingEntry.duration).toBeLessThan(40);
    }

    if (profilerMetric) {
      await recordSnapshot(
        createSnapshot('TokenTransform.ThemeToggle', 'React.actualDuration', profilerMetric.actualDuration, {
          unit: 'ms',
        }),
      );
    }
  });

  test('captures token resolution measurements', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-token-transform-harness--token-resolution');
    await page.waitForSelector('[data-testid="perf-token-resolve"]');

    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const trigger = page.getByTestId('perf-token-resolve');
    await trigger.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'TokenTransform.Resolution');
    });

    const timingEntry = await getUserTimingEntry(page, 'TokenTransform.Resolution');
    const profilerMetric = await getProfilerMetric(page, 'TokenTransform.Resolution');

    expect(timingEntry, 'Expected user timing metric for token resolution').not.toBeNull();

    if (timingEntry) {
      await recordSnapshot(
        createSnapshot('TokenTransform.Resolution', 'UserTiming.duration', timingEntry.duration, {
          unit: 'ms',
          parameters: { tokenCount: 5 },
        }),
      );
      expect(timingEntry.duration).toBeLessThan(15);
    }

    if (profilerMetric) {
      await recordSnapshot(
        createSnapshot('TokenTransform.Resolution', 'React.actualDuration', profilerMetric.actualDuration, {
          unit: 'ms',
        }),
      );
    }
  });
});
