import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, clean: true,
  platform: 'browser', outDir: 'dist', sourcemap: false, target: 'es2022',
  minify: false, treeshake: true, shims: false, skipNodeModulesBundle: true,
});
