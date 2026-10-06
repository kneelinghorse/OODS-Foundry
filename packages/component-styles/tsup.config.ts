import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/ported.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  platform: 'neutral',
  outDir: 'dist',
  sourcemap: false,
  target: 'es2022',
  minify: false,
  treeshake: true,
  shims: false,
});
