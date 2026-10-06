/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const complianceOnly = process.argv.some(arg => /tests\/compliance/.test(arg));
const defaultCoverageInclude = ['src/**/*.{ts,tsx}'];
const complianceCoverageInclude = [
  'src/services/compliance/**/*.{ts,tsx}',
  'src/domain/compliance/**/*.{ts,tsx}',
  'scripts/compliance/**/*.{ts,tsx}',
];

const srcDir = path.join(dirname, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '@oods/viz-core': path.join(dirname, 'packages/viz-core/src/index.ts'),
      '@': srcDir,
      '~': dirname
    }
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      reportsDirectory: path.join(dirname, 'coverage'),
      include: complianceOnly ? complianceCoverageInclude : defaultCoverageInclude,
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.config.{ts,tsx}',
        'scripts/types/__fixtures__/**',
        'src/cli/**',
        'src/utils/visualizer.ts',
        'src/utils/composition-visualizer.ts',
        'src/utils/graph-visualizer.ts',
        'src/utils/index.ts',
        'src/generators/**',
        'src/types/**',
        'src/components/index.ts',
        'src/components/base/index.ts',
        'src/components/page/index.ts',
        'src/view/index.ts',
        'src/stories/**'
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 70,
        functions: 80,
        branches: 70,
        statements: 70
      }
    },
    // s174 m04 — the `storybook` project was REMOVED here, together with the storybookTest
    // plugin import, the '@storybook/addon-vitest' entry in storybook.config.ts, the
    // devDependency, and .storybook/vitest.setup.ts.
    //
    // It matched ZERO files: its globs were absolute paths the `./`-remap never fired on, so
    // `vitest list --project=storybook` returned no tests — while ci.yml's coverage job ran it
    // and reported green, and never installed the browsers it declares. Vacuous CI coverage is
    // worse than none; it reads as "the stories render" to anyone scanning the job list.
    //
    // What is NOT lost: there are zero play functions across the 118-story-file / 402-export
    // corpus, so the project could not have exercised an interaction even had its globs
    // matched. Render coverage lives in build-storybook (which fails on a story that throws),
    // Chromatic, and the a11y contract. Fixing the globs and burning the project in was
    // DECLINED for s174 and routed to Derek as a deliberate interaction-testing decision;
    // re-adding it later re-pays the CI browser wiring, which is the honest cost of that call.
    projects: [{
      // A11y/JSdom tests (non-storybook)
      extends: true,
      test: {
        name: 'a11y',
        include: [
          'tests/a11y/**/*.test.ts',
          'tests/a11y/**/*.test.tsx',
          'tests/a11y/**/*.spec.ts',
          'tests/a11y/**/*.spec.tsx'
        ],
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
        include: [
          'tests/**/*.test.ts',
          'tests/**/*.test.tsx',
          'tests/**/*.spec.ts',
          'tests/**/*.spec.tsx',
          'packages/mcp-server/test/**/*.test.ts',
          'packages/mcp-server/test/**/*.spec.ts',
          'packages/mcp-adapter/**/*.test.js'
        ],
        // Product-reality compiler and packaging proofs are resource-heavy, and package
        // lifecycles replace shared `dist` trees. test:coverage runs them sequentially
        // through the package-native config after all root coverage readers finish.
        exclude: [
          'tests/a11y/**',
          'packages/mcp-server/test/soak/**',
          'packages/mcp-server/test/product-reality/codegen-matrix.s182.spec.ts',
          'packages/mcp-server/test/product-reality/packed-consumers.s182.spec.ts',
          'packages/mcp-server/test/codegen/cross-framework-parity.spec.ts',
          'packages/mcp-server/test/product-reality/typed-action-protocol.s183.spec.ts',
          'packages/mcp-server/test/product-reality/saved-schema-consumers.s183.spec.ts',
          'packages/mcp-server/test/product-reality/independent-review-approval.s183.spec.ts',
          // s185 recovery: these three proofs run npm pack/prepack against the
          // shared workspace dist trees. Retain them in serial test:coverage.
          'packages/mcp-server/test/product-reality/live-workflow-consumers.s184.spec.ts',
          'packages/mcp-server/test/product-reality/m06-gate-bites.s184.spec.ts',
          'packages/mcp-server/test/product-reality/packed-ported-consumers.s184.spec.ts',
          // These compiler/runtime and frozen-Git proofs passed natively but
          // timed out under root concurrency. Per-file attribution is retained
          // in sprint-185/m05/recovery/root-isolation.json (74 native tests).
          'packages/mcp-server/test/product-reality/emitter-directives.s184.spec.ts',
          'packages/mcp-server/test/product-reality/ported-workflow.s184.spec.ts',
          'packages/mcp-server/test/product-reality/state-axis.s184.spec.ts',
          'packages/mcp-server/test/product-reality/closeout.s184.spec.ts',
          'packages/mcp-server/test/product-reality/patch-disposition.s184.spec.ts',
          // s186 recovery: all 32 assertions passed natively and in individual
          // root runs; parallel root deadlines are retained in m06/recovery/
          // root-isolation.json. Keep these unchanged proofs in serial coverage.
          'packages/mcp-server/test/contracts/brand.intake.s181.spec.ts',
          'packages/mcp-server/test/contracts/portable-boundary.s181.spec.ts',
          'packages/mcp-server/test/product-reality/generated-heading-update.s185.spec.ts',
          'packages/mcp-server/test/product-reality/reconnect.s184.spec.ts',
          'packages/mcp-server/test/tools/dashboard-identity-lifts.s180.spec.ts',
          // s189 / decision #1833: git-range and census proofs stay in the serial
          // package suite, avoiding duplicate root-core execution and contention.
          // Per-file counts: sprint-189/m02/test-handling/suite-accounting-inputs.json.
          'packages/mcp-server/test/product-reality/sprint-wide-movers.s185.spec.ts',
          'packages/mcp-server/test/product-reality/public-head-equivalence.s185.spec.ts',
          'packages/mcp-server/test/product-reality/fresh-composition.s187.spec.ts',
          'packages/mcp-server/test/product-reality/workflow.s188.spec.ts',
          'packages/mcp-server/test/product-reality/archive-workflow.s188.spec.ts',
        ],
        environment: 'node'
      }
    }]
  }
});
