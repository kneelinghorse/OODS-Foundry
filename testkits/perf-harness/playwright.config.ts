import { defineConfig, devices } from '@playwright/test';

const storybookUrl = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

/**
 * Performance harness Playwright configuration
 *
 * Designed for measuring React component performance metrics:
 * - Compositor update time
 * - List render time
 * - Token transform duration
 * - Usage aggregation performance
 *
 * Produces structured JSON output conforming to performance-harness.schema.json
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.perf.spec.ts',
  timeout: 60_000, // Performance tests may take longer
  fullyParallel: false, // Serial execution for consistent results
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for stable perf measurements
  reporter: [
    ['html', { open: 'never', outputFolder: './perf-results/html' }],
    ['json', { outputFile: './perf-results/results.json' }],
  ],
  use: {
    baseURL: storybookUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    // Disable animations for stable measurements
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Disable throttling for baseline measurements
        launchOptions: {
          args: ['--disable-dev-shm-usage'],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm run storybook',
    url: storybookUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
