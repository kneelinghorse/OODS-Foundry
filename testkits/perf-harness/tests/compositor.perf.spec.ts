import { test, expect } from '../utils/perfTest';
import { createSnapshot } from '../utils/schema';
import { flushResults } from '../utils/resultsStore';

test.afterAll(async () => {
  await flushResults();
});

test.describe('Compositor Performance', () => {
  test('captures button state updates via React Profiler', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-compositor-harness--button-state-update');
    await page.waitForSelector('[data-testid="perf-button-toggle"]');

    await page.evaluate(() => {
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const button = page.getByTestId('perf-button-toggle');
    await button.click();
    await page.waitForTimeout(120);

    const metric = await page.evaluate(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      return metrics.filter((entry) => entry.id === 'Compositor.Button.StateUpdate').pop() ?? null;
    });

    expect(metric, 'Expected profiler metric for button state update').not.toBeNull();
    if (!metric) return;

    await recordSnapshot(
      createSnapshot('Compositor.Button.StateUpdate', 'React.actualDuration', metric.actualDuration, {
        unit: 'ms',
        browser: 'chromium',
      }),
    );
    await recordSnapshot(
      createSnapshot('Compositor.Button.StateUpdate', 'React.commitTime', metric.commitTime, {
        unit: 'ms',
        browser: 'chromium',
      }),
    );
    await recordSnapshot(
      createSnapshot('Compositor.Button.StateUpdate', 'React.baseDuration', metric.baseDuration, {
        unit: 'ms',
        browser: 'chromium',
      }),
    );

    expect(metric.actualDuration).toBeLessThan(50);
    expect(metric.phase).toBe('update');
  });

  test('captures toast queue compositor work', async ({ page, recordSnapshot }) => {
    await page.goto('/iframe.html?id=performance-compositor-harness--toast-queue');
    await page.waitForSelector('[data-testid="perf-toast-trigger"]');

    await page.evaluate(() => {
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const trigger = page.getByTestId('perf-toast-trigger');
    await trigger.click();
    await page.waitForTimeout(300);

    const metric = await page.evaluate(() => {
      const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
      return metrics.filter((entry) => entry.id === 'Compositor.Toast.Queue').pop() ?? null;
    });

    expect(metric, 'Expected profiler metric for toast queue updates').not.toBeNull();
    if (!metric) return;

    await recordSnapshot(
      createSnapshot('Compositor.Toast.Queue', 'React.actualDuration', metric.actualDuration, {
        unit: 'ms',
      }),
    );
    await recordSnapshot(
      createSnapshot('Compositor.Toast.Queue', 'React.commitTime', metric.commitTime, {
        unit: 'ms',
      }),
    );

    expect(metric.actualDuration).toBeLessThan(120);
    expect(['update', 'nested-update']).toContain(metric.phase);
  });
});
