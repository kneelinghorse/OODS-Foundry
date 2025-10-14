import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/context-matrix.ts'],
  format: ['esm', 'cjs'],
  dts: {
    entry: {
      index: 'src/index.ts',
      'context-matrix': 'src/context-matrix.ts',
    },
  },
  platform: 'node',
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  target: 'node20',
  minify: false,
  treeshake: true,
  shims: false,
  skipNodeModulesBundle: true,
});
