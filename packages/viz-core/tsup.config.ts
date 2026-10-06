import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  target: 'node20',
  minify: false,
  treeshake: true,
  shims: false,
  // Externalize node_modules (ajv, ajv-formats, @oods/tokens). The vendored
  // normalized-viz-spec.schema.json is a local file and is inlined by esbuild,
  // keeping the package self-contained at runtime with no JSON file dependency.
  skipNodeModulesBundle: true,
  // vega-format is ESM-only; bundle its pure formatting utilities so CJS remains usable on Node 22.0.
  noExternal: ['vega-format', 'vega-time', 'vega-util', 'd3-array', 'd3-format', 'd3-time', 'd3-time-format', 'internmap'],
  // tsup's external plugin skips the inherited @oods/* path alias before
  // checking its own external list. Native esbuild externalization keeps the
  // adapters on the same runtime bundle that brand.apply refreshes.
  esbuildOptions(options) {
    options.external = [...(options.external ?? []), '@oods/tokens'];
  },
});
