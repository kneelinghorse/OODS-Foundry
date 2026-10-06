import { defineConfig } from 'vitest/config';

// Q1 determinism scale-tier suite. Run via `pnpm --filter @oods/mcp-server
// run test:scale`; the separate scale-determinism CI job provides per-PR signal.
// Per decision #614, this is also a standing release gate verified at sprint
// closeout (mission-graph V2 axis #7; see cmos/foundational-docs/quality-bars.md).
export default defineConfig({
  test: {
    include: ['test/scale/**/*.spec.ts'],
    environment: 'node',
    // 1000-tier dry-run measures ~1.2s; budget generously to absorb CI
    // worker variance without serializing.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ['./test/setup-env.ts'],
  },
});
