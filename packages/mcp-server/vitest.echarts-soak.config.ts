import { defineConfig } from "vitest/config";

// Opt-in release gate. The package command starts Vitest under `node
// --expose-gc`, and CI builds workspace packages first because this suite must
// exercise @oods/viz-render's real dist worker rather than a transformed source
// substitute. Keep the resource-heavy file serialized and outside `pnpm test`.
export default defineConfig({
  test: {
    include: ["test/soak/**/*.spec.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    pool: "forks",
    sequence: { concurrent: false },
    testTimeout: 600_000,
    hookTimeout: 600_000,
    setupFiles: ["./test/setup-env.ts"],
  },
});
