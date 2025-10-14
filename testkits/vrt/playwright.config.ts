import { defineConfig, devices } from '@playwright/test';

const storybookUrl = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

export default defineConfig({
  testDir: './stories',
  testMatch: '**/*.@(stories|spec).@(ts|tsx)',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: storybookUrl,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      threshold: 0.2,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run storybook',
    url: storybookUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
