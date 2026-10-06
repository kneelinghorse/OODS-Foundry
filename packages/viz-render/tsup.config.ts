import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    emitter: "src/emitter.ts",
    "echarts-render.worker": "src/echarts-render.worker.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  platform: "node",
  outDir: "dist",
  sourcemap: true,
  target: "node20",
  minify: false,
  treeshake: true,
  shims: false,
  // Externalize node_modules: vega, vega-lite, and ECharts are runtime deps
  // resolved by the consumer (mcp-server), not bundled into this package.
  skipNodeModulesBundle: true,
});
