import { defineConfig } from 'vitest/config';

// Bridge tool-surface tests (sprint-110 m05 / #696b): the package shipped
// tool-surface.test.ts but had no test script/config, so it never executed.
// This wires it into a runnable suite (and the CI viz-determinism job).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
