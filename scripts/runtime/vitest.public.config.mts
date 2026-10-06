import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selection = JSON.parse(fs.readFileSync(path.join(root, 'scripts/runtime/public-test-selection.json'), 'utf8'));
const require = createRequire(import.meta.url);
export const publicDependencyWorkerOptions = { pool: 'forks' as const, poolOptions: { forks: { execArgv: ['--require', path.join(root, 'scripts/runtime/public-dependency-guard.cjs'), '--import', path.join(root, 'scripts/runtime/public-dependency-register.mjs')] } } };

// Vite transforms TS without native module hooks. Guard that load path in the same isolated project.
export function publicDependencyBoundary() {
  return {
    name: 'public-clone-dependency-boundary',
    enforce: 'pre' as const,
    load(id: string) {
      const file = id.startsWith('file:') ? fileURLToPath(id) : id.split('?')[0]!;
      if (path.isAbsolute(file) && fs.existsSync(file)) require('./public-dependency-guard.cjs').check(file);
      return null;
    },
  };
}

export default defineConfig({
  test: {
    ...(process.execArgv.includes(path.join(root, 'scripts/runtime/public-dependency-guard.cjs')) ? publicDependencyWorkerOptions : {}),
    // Package lifecycle proofs replace dist; keep them apart from every reader.
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 180_000,
    projects: [...selection.packages, 'component-styles-self-isolating', 'mcp-server-self-isolating'].map((name: string) => ({
      plugins: name.endsWith('-self-isolating') ? [publicDependencyBoundary()] : [],
      test: {
        name,
        root: name === 'tokens' ? root : path.join(root, 'packages', name.replace('-self-isolating', '')),
        globals: name === 'tokens',
        include: name === 'tokens' ? selection.specs.filter((file: string) => file.startsWith('tests/')) : name.endsWith('-self-isolating') ? selection.selfIsolatingSpecs.filter((file: string) => file.startsWith(`packages/${name.replace('-self-isolating', '')}/`)).map((file: string) => file.slice(`packages/${name.replace('-self-isolating', '')}/`.length)) : selection.specs.filter((file: string) => file.startsWith(`packages/${name}/`) && !selection.selfIsolatingSpecs.includes(file)).map((file: string) => file.slice(`packages/${name}/`.length)),
        exclude: [],
        environment: name.startsWith('components-') ? 'jsdom' : 'node',
        setupFiles: name.startsWith('mcp-server') ? ['./test/setup-env.ts'] : [],
        fileParallelism: false,
        testTimeout: 600_000,
        hookTimeout: 180_000,
      },
    })),
  },
});
