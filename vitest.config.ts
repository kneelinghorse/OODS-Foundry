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
      reporter: ['text', 'json', 'html', 'json-summary'],
      reportsDirectory: path.join(dirname, 'coverage'),
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.config.{ts,tsx}',
        'scripts/types/__fixtures__/**',
        'src/cli/**',
        'src/utils/visualizer.ts',
        'src/utils/index.ts',
        'src/types/**',
        'src/components/index.ts',
        'src/components/base/index.ts',
        'src/components/page/index.ts',
        'src/view/index.ts'
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 70,
        functions: 80,
        branches: 70,
        statements: 70
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
      // Contrast guardrail checks (Node environment)
      extends: true,
      test: {
        name: 'guardrails',
        include: ['testing/a11y/**/*.spec.ts'],
        environment: 'node'
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
