import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Resolve @oods/viz-core to SOURCE so the package's own tests verify the
      // public barrel without requiring a prior tsup build (Q1 determinism).
      '@oods/viz-core': path.join(dirname, 'src/index.ts'),
    },
  },
  test: {
    // test/** holds the suite; src/**/*.spec.ts picks up COLOCATED unit specs that must
    // import the source module directly (relative, not the @oods/viz-core barrel) to
    // mutation-guard a specific function — e.g. adapters/vega-lite-adapter.spec.ts pins
    // the palette bake so disabling it fails HERE, not only downstream (s143 m03).
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 20_000,
    // Coverage gate (sprint-112 m04). Root CI's coverage only includes the repo
    // `src/**`, so @oods/viz-core's own recommender / profiler / adapters were never
    // MEASURED. Enabled here so the viz-determinism CI step (`pnpm --filter
    // @oods/viz-core test`) enforces it. `all: true` counts untested files at 0% so
    // a new uncovered module is caught. Thresholds are MEASURED FLOORS (~5pts below
    // the 2026-06 actuals: stmts/lines 54.6%, branches 66.4%, functions 50.8%) — a
    // real floor that does not red on minor unrelated churn, NOT an aspiration.
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**'],
      all: true,
      reporter: ['text-summary'],
      thresholds: {
        statements: 50,
        branches: 60,
        functions: 45,
        lines: 50,
      },
    },
  },
});
