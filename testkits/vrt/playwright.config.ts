import { defineConfig, devices } from '@playwright/test';

const storybookUrl = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';

/**
 * s173 m04 (crawl 3) — the mobile specs, and the scoping that keeps them apart.
 *
 * The two desktop projects run every spec under `testDir` at 1280x720. The mobile specs
 * assume a touch-capable context and drive their own viewports, so they must NOT run there —
 * and, symmetrically, the desktop specs must not run under the mobile projects.
 *
 * SCOPING IS SYMMETRIC, deliberately: a `testMatch` on the new projects alone would leave the
 * new specs ALSO running under `chromium` AND `firefox`, desktop-prepared, where firefox has
 * no touch support at all. One-directional scoping is the easy version of this change and it
 * is wrong in a way that only shows up as a confusing firefox failure.
 */
const MOBILE_SPECS = '**/mobile/*.spec.ts';

/**
 * Point the run at an already-built, already-served Storybook instead of booting the dev
 * server. Used by CI, where `storybook-static` is built once and served by a static server —
 * starting a dev Storybook there would cost minutes and rebuild what already exists.
 * Unset (the default) leaves local behaviour exactly as it was.
 */
const useExternalStorybook = process.env.STORYBOOK_EXTERNAL === '1';

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
      testIgnore: MOBILE_SPECS,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: MOBILE_SPECS,
    },
    {
      // Phone class. Chromium only: firefox does not support `isMobile`, and webkit is not
      // installed on any runner here — a webkit project would be a red that means "nobody
      // ran this" rather than "this is broken".
      name: 'mobile-375',
      testMatch: MOBILE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        hasTouch: true,
      },
    },
    {
      // Tablet class, and the boundary case: 768px is sys.breakpoint.md exactly, so this
      // project runs the specs at the width the collapse switches on.
      name: 'tablet-768',
      testMatch: MOBILE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
  ],
  ...(useExternalStorybook
    ? {}
    : {
        webServer: {
          command: 'npm run storybook',
          url: storybookUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
