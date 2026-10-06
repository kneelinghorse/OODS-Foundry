import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environmentMatchGlobs: [['**/rendererClient.test.ts', 'node']],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary']
    }
  }
});
