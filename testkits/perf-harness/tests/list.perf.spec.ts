import { test, expect } from '../utils/perfTest';
import { createSnapshot } from '../utils/schema';
import { flushResults } from '../utils/resultsStore';

test.afterAll(async () => {
  await flushResults();
});

test.describe('List Rendering Performance', () => {
  test('captures table render metrics for 100 rows', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-list-harness--table-render');
    await page.waitForSelector('table tbody tr', { state: 'attached' });
    await page.waitForFunction(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      return metrics.some((entry) => entry.id === 'List.Table.100Rows');
    });

    const metric = await page.evaluate(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      return metrics.filter((entry) => entry.id === 'List.Table.100Rows').pop() ?? null;
    });

    expect(metric, 'Expected profiler metrics for table render').not.toBeNull();
    if (!metric) return;

    await recordSnapshot(
      createSnapshot('List.Table.100Rows', 'React.actualDuration', metric.actualDuration, {
        unit: 'ms',
        parameters: { rowCount: 100 },
      }),
    );
    await recordSnapshot(
      createSnapshot('List.Table.100Rows', 'React.commitTime', metric.commitTime, {
        unit: 'ms',
        parameters: { rowCount: 100 },
      }),
    );

    expect(metric.actualDuration).toBeLessThan(80);
  });

  test('captures filter computation via User Timing marks', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-list-harness--table-filter');
    await page.waitForSelector('[data-testid="perf-filter-input"]');

    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
    });

    const filterInput = page.getByTestId('perf-filter-input');
    await filterInput.fill('customer 10');
    await page.waitForTimeout(120);

    await page.waitForFunction(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.some((metric) => metric.name === 'List.Table.FilterApply');
    });

    const entry = await page.evaluate(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.filter((metric) => metric.name === 'List.Table.FilterApply').pop() ?? null;
    });

    const visibleRowCount = await page.locator('tbody tr').count();

    expect(entry, 'Expected user timing metric for filter apply').not.toBeNull();
    if (!entry) return;

    await recordSnapshot(
      createSnapshot('List.Table.FilterApply', 'UserTiming.duration', entry.duration, {
        unit: 'ms',
        parameters: { filter: 'customer 10', rowCount: visibleRowCount },
      }),
    );

    expect(entry.duration).toBeLessThan(8);
  });

  test('captures tabs navigation switch metrics', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-list-harness--tabs-switch');
    await page.waitForSelector('[role="tab"]');

    await page.evaluate(() => {
      window.__PERF_USER_TIMING__?.clearAll();
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const secondTab = page.locator('[role="tab"]').nth(1);
    await secondTab.click();
    await page.waitForTimeout(80);

    await page.waitForFunction(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      const userTiming = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return (
        metrics.some((entry) => entry.id === 'List.Tabs.NavigationSwitch') ||
        userTiming.some((entry) => entry.name === 'List.Tabs.NavigationSwitch')
      );
    });

    const profilerMetric = await page.evaluate(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      return metrics.filter((entry) => entry.id === 'List.Tabs.NavigationSwitch').pop() ?? null;
    });

    const timingMetric = await page.evaluate(() => {
      const metrics = window.__PERF_USER_TIMING__?.extractMetrics() ?? [];
      return metrics.filter((metric) => metric.name === 'List.Tabs.NavigationSwitch').pop() ?? null;
    });

    expect(profilerMetric, 'Expected profiler metric for tab switch').not.toBeNull();
    if (profilerMetric) {
      await recordSnapshot(
        createSnapshot('List.Tabs.NavigationSwitch', 'React.actualDuration', profilerMetric.actualDuration, {
          unit: 'ms',
        }),
      );
    }

    expect(timingMetric, 'Expected user timing metric for tab switch').not.toBeNull();
    if (timingMetric) {
      await recordSnapshot(
        createSnapshot('List.Tabs.NavigationSwitch', 'UserTiming.duration', timingMetric.duration, {
          unit: 'ms',
        }),
      );
      expect(timingMetric.duration).toBeLessThan(12);
    }
  });
});
