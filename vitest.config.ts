/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.ts'],
      thresholds: {
        lines: 0.85,
        functions: 0.85,
        branches: 0.8,
        statements: 0.85
      }
    },
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
      }
    }, {
      // A11y/JSdom tests (non-storybook)
      extends: true,
      test: {
        name: 'a11y',
        include: ['tests/a11y/**/*.test.ts', 'tests/a11y/**/*.test.tsx'],
        environment: 'jsdom'
      }
    }, {
      // Core Node tests: validation, integration, core/unit, etc.
      extends: true,
      test: {
        name: 'core',
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        exclude: ['tests/a11y/**'],
        environment: 'node'
      }
    }]
  }
});
