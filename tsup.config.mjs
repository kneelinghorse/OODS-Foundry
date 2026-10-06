import { defineConfig } from 'tsup';

const EXTERNAL_DEPENDENCIES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/server',
  'ajv',
  'ajv-formats',
  'js-yaml',
  'zod',
  '@oods/tokens',
  '@oods/tokens/tailwind',
];

const BUNDLED_DEPENDENCIES = ['@oods/viz-core'];

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    resolve: BUNDLED_DEPENDENCIES,
  },
  sourcemap: true,
  clean: false,
  target: 'es2022',
  outDir: 'dist/pkg',
  splitting: false,
  treeshake: true,
  minify: false,
  shims: false,
  external: EXTERNAL_DEPENDENCIES,
  noExternal: BUNDLED_DEPENDENCIES,
});
