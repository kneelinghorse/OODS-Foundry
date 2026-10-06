import { defineConfig } from 'vitest/config';

/**
 * On-demand gate-integrity proofs. Run with `pnpm --filter @oods/mcp-server run test:gates`.
 *
 * s204-m01, measured: m06-gate-bites.s184 costs 170.4s for ONE test in the Sprint 202 certified
 * capture (336s in Sprint 203's loaded run) — 15.8% of mcp-server's summed file time, the single
 * slowest file in the whole five-suite capture. What it proves is that each of the eight runtime
 * gates detects a unique injected defect on both framework targets: gate INTEGRITY, which moves
 * only when the gate harness or the generation path moves. That is not a per-sprint regression
 * guard, so it does not earn a place in a suite that runs at every sprint close.
 *
 * It is not retired. Following the `test:scale` precedent (decision #614), it lives in its own
 * config, is excluded from the default suite, and runs at closeout in pre-freeze part B — where
 * packages are rebuilt anyway, which is what this proof needs. gate-roster.s204.spec.ts asserts
 * that this file is excluded from the default config, included here, and named by the closeout
 * runner, so an on-demand gate cannot quietly become a gate nobody runs.
 */
export default defineConfig({
  test: {
    include: ['test/product-reality/m06-gate-bites.s184.spec.ts'],
    environment: 'node',
    // Packing replaces shared workspace dist trees; never run these against a parallel reader.
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
    setupFiles: ['./test/setup-env.ts'],
  },
});
