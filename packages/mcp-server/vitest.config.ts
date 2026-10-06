import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'src/**/*.test.ts'],
    // Scale and ECharts soak suites are opt-in through their dedicated configs.
    // Per the s105-m03 audit (decision #614), scale tests run as a separate
    // CI check before any release-gate integration; folding them into the
    // default suite would couple release stability to determinism work that
    // hasn't yet sustained the 3-sprint streak.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/scale/**',
      'test/soak/**',
      // s204-m01: gate-INTEGRITY proofs run on demand through vitest.gates.config.ts. This one
      // file was 170.4s for a single test in the Sprint 202 certified capture — 15.8% of this
      // suite's summed file time — and what it proves moves only when the gate harness or the
      // generation path moves, not once per sprint. It runs at closeout in pre-freeze part B, and
      // test/product-reality/gate-roster.s204.spec.ts holds all three of those facts.
      'test/product-reality/m06-gate-bites.s184.spec.ts',
    ],
    environment: 'node',
    // Product-reality packing runs package prepack builds that replace shared
    // workspace dist trees; keep other compiler-facing specs off those trees
    // until each pack/build lifecycle completes.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 180_000,
    setupFiles: ['./test/setup-env.ts'],
  },
});
