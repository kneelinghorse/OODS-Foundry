import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Non-worker units resolve the public barrel to source. The package test
      // command builds first because worker_threads must spawn the real ESM/CJS
      // files in dist; an in-memory Vitest transform is not a worker entry.
      "@oods/viz-render": path.join(dirname, "src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
    testTimeout: 20_000,
    // Coverage gate (mirrors @oods/viz-core). Root CI's coverage only includes the
    // repo `src/**`, so this package's emitter would never be MEASURED otherwise;
    // enabled here so the viz-determinism CI step (`pnpm --filter @oods/viz-render
    // test`) enforces it. `all: true` counts untested files at 0% so a new uncovered
    // module is caught. Thresholds are MEASURED FLOORS (~5pts below the actuals).
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/**"],
      // These modules are intentionally executable only inside the emitted
      // worker_threads entry. Running them in Vitest's main realm would defeat
      // the RNG/clock/global-isolation contract, while Node's V8 collector does
      // not remap built-worker coverage into src. The built ESM/CJS worker
      // carriers cover them behaviorally; all main-realm source stays measured.
      exclude: [
        "src/echarts-render.worker.ts",
        "src/echarts-worker-runtime.ts",
      ],
      all: true,
      reporter: ["text-summary"],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
