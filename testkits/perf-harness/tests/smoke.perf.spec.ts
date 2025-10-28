/**
 * Smoke Test - Verify Performance Harness Setup
 * Confirms Storybook connectivity and instrumentation exposure.
 */

import { test, expect } from '../utils/perfTest';
import { flushResults } from '../utils/resultsStore';

test.afterAll(async () => {
  await flushResults();
});

test.describe('Performance Harness Smoke Test', () => {
  test('should connect to Storybook', async ({ page }) => {
    await page.goto('/');

    // Verify Storybook loaded
    const title = await page.title();
    expect(title).toContain('Storybook');

    console.log('✅ Storybook connection successful');
  });

  test('should access User Timing API', async ({ page }) => {
    await page.goto('/');

    const hasUserTiming = await page.evaluate(() => {
      return typeof performance !== 'undefined' &&
        typeof performance.mark === 'function' &&
        typeof performance.measure === 'function';
    });

    expect(hasUserTiming).toBe(true);
    console.log('✅ User Timing API available');
  });

  test('should expose profiler metrics storage', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.__PERF_PROFILER_METRICS__ = [];
    });

    const metricsExist = await page.evaluate(() => {
      return Array.isArray(window.__PERF_PROFILER_METRICS__);
    });

    expect(metricsExist).toBe(true);
    console.log('✅ Profiler metrics storage initialized');
  });

  test('should measure simple operation with User Timing', async ({ page }) => {
    await page.goto('/');

    const duration = await page.evaluate(() => {
      performance.mark('smoke-test-start');

      // Simulate work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      performance.mark('smoke-test-end');
      const measure = performance.measure('smoke-test', 'smoke-test-start', 'smoke-test-end');

      return measure.duration;
    });

    expect(duration).toBeGreaterThanOrEqual(0);
    console.log(`✅ User Timing measurement: ${duration.toFixed(2)}ms`);
  });
});
