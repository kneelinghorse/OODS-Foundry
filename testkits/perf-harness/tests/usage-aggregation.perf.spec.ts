import { test, expect } from '../utils/perfTest';
import { createSnapshot } from '../utils/schema';
import { flushResults } from '../utils/resultsStore';

test.afterAll(async () => {
  await flushResults();
});

async function extractTiming(page: import('@playwright/test').Page, name: string) {
  return page.evaluate((metricName) => {
    const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
    return metrics.filter((metric) => metric.name === metricName).pop() ?? null;
  }, name);
}

test.describe('Usage Aggregation Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iframe.html?id=performance-usage-aggregation-harness--usage-aggregation');
    await page.waitForSelector('[data-testid="perf-usage-daily"]');
    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
      window.__PERF_PROFILER_METRICS__ = [];
    });
  });

  test('captures daily aggregation metrics', async ({ page, recordSnapshot }) => {
    const trigger = page.getByTestId('perf-usage-daily');
    await trigger.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'UsageAggregation.Daily');
    });

    const entry = await extractTiming(page, 'UsageAggregation.Daily');

    expect(entry, 'Expected user timing metric for daily aggregation').not.toBeNull();
    if (!entry) return;

    const total = await page.getByTestId('perf-usage-daily-total').textContent();
    const count = await page.getByTestId('perf-usage-daily-count').textContent();

    await recordSnapshot(
      createSnapshot('UsageAggregation.Daily', 'UserTiming.duration', entry.duration, {
        unit: 'ms',
        parameters: {
          eventCount: 1000,
          total,
          count,
        },
      }),
    );

    expect(entry.duration).toBeLessThan(20);
  });

  test('captures weekly rollup metrics', async ({ page, recordSnapshot }) => {
    const trigger = page.getByTestId('perf-usage-weekly');
    await trigger.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'UsageAggregation.WeeklyRollup');
    });

    const entry = await extractTiming(page, 'UsageAggregation.WeeklyRollup');

    expect(entry, 'Expected user timing metric for weekly rollup').not.toBeNull();
    if (!entry) return;

    const total = await page.getByTestId('perf-usage-weekly-total').textContent();
    const count = await page.getByTestId('perf-usage-weekly-count').textContent();

    await recordSnapshot(
      createSnapshot('UsageAggregation.WeeklyRollup', 'UserTiming.duration', entry.duration, {
        unit: 'ms',
        parameters: { days: 7, total, count },
      }),
    );

    expect(entry.duration).toBeLessThan(10);
  });

  test('captures billing calculation metrics', async ({ page, recordSnapshot }) => {
    const trigger = page.getByTestId('perf-usage-billing');
    await trigger.click();
    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((entry) => entry.name === 'UsageAggregation.BillingCalculation');
    });

    const entry = await extractTiming(page, 'UsageAggregation.BillingCalculation');

    expect(entry, 'Expected user timing metric for billing calc').not.toBeNull();
    if (!entry) return;

    const total = await page.getByTestId('perf-usage-billing-total').textContent();

    await recordSnapshot(
      createSnapshot(
        'UsageAggregation.BillingCalculation',
        'UserTiming.duration',
        entry.duration,
        {
          unit: 'ms',
          parameters: { meters: 3, total },
        },
      ),
    );

    expect(entry.duration).toBeLessThan(5);
  });
});
