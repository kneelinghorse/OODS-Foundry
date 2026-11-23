import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keep complete props in the parameterized component contract names.
    taskTitleValueFormatTruncate: 0,
    environment: 'jsdom',
    include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
  },
});
