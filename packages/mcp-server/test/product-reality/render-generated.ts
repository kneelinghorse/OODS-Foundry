import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/**
 * Bundle one generated standalone screen and server-render it with a model, in a child process beside the built
 * component package (the Sprint 187 values spec's method). Returns the markup.
 */
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const requireVue = createRequire(path.join(root, 'packages/components-vue/package.json'));
const compiler = requireVue('@vue/compiler-sfc');
const esbuild = createRequire(requireVue.resolve('vite/package.json'))('esbuild');

export function renderGenerated(framework: 'react' | 'vue', code: string, model: Record<string, unknown>, actions: string[] = []): string {
  return renderGeneratedModels(framework, code, [model], actions)[0]!;
}

/**
 * renderGenerated for several models from one bundle in one child process: one markup per model, in order (s221-m01).
 * `app` renders a workflow screen at its own path beside the app's TypeScript modules, since a workflow screen may import
 * its store's helpers ('../store').
 */
export function renderGeneratedModels(framework: 'react' | 'vue', code: string, models: ReadonlyArray<Record<string, unknown>>, actions: string[] = [], app?: { entry: string; files: ReadonlyArray<{ path: string; contents: string }> }): string[] {
  const cacheRoot = path.join(root, `packages/components-${framework}/.cache`);
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(path.join(cacheRoot, 's213-render-'));
  try {
    let source = code;
    if (framework === 'vue') source = compiler.compileScript(compiler.parse(source, { filename: 'GeneratedUI.vue' }).descriptor, { id: 's213-render', inlineTemplate: true }).content;
    for (const file of app?.files.filter(entry => entry.path.startsWith('src/') && entry.path.endsWith('.ts')) ?? []) {
      mkdirSync(path.dirname(path.join(directory, file.path)), { recursive: true });
      writeFileSync(path.join(directory, file.path), file.contents);
    }
    const sourcePath = path.join(directory, app ? app.entry.replace(/\.(tsx|vue)$/, framework === 'react' ? '.tsx' : '.ts') : framework === 'react' ? 'GeneratedUI.tsx' : 'GeneratedUI.ts');
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, source);
    // The component styles import @oods/tokens/css, which names DM Sans's font files beside it (s221-m02): an esbuild
    // bundle needs a loader for them, as any esbuild consumer does.
    esbuild.buildSync({ entryPoints: [sourcePath], outfile: path.join(directory, 'GeneratedUI.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', jsx: 'automatic', logLevel: 'silent',
      loader: { '.woff2': 'file' },
      external: ['react', 'react-dom', 'vue', '@oods/components-react', '@oods/components-react/*', '@oods/components-vue', '@oods/components-vue/*'] });
    writeFileSync(path.join(directory, 'render.cjs'), `
const generated = require('./GeneratedUI.cjs');
const actions = Object.fromEntries(${JSON.stringify(actions)}.map(name => [name, () => {}]));
(async () => {
  const pages = [];
  for (const model of ${JSON.stringify(models)}) {
    const props = { ...model, actions };
    pages.push(${JSON.stringify(framework)} === 'react'
      ? require('react-dom/server').renderToString(require('react').createElement(generated.GeneratedUI, props))
      : await require('@vue/server-renderer').renderToString(require('vue').createSSRApp(generated.default, props)));
  }
  process.stdout.write(JSON.stringify(pages));
})().catch(error => { console.error(error); process.exit(1); });
`);
    const run = spawnSync(process.execPath, [path.join(directory, 'render.cjs')], { cwd: directory, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) throw new Error(`render failed: ${run.stderr}`);
    return JSON.parse(run.stdout) as string[];
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

/**
 * Bundle a generated workflow's store (src/store.ts and what it imports) and run a script against it in a child process;
 * the script receives the store module as `store` and prints JSON, which is returned parsed.
 */
export function runGeneratedStore(files: ReadonlyArray<{ path: string; contents: string }>, script: string): unknown {
  const cacheRoot = path.join(root, 'packages/components-react/.cache');
  mkdirSync(cacheRoot, { recursive: true });
  const directory = mkdtempSync(path.join(cacheRoot, 's213-store-'));
  try {
    for (const file of files.filter(file => file.path.startsWith('src/') && file.path.endsWith('.ts'))) {
      mkdirSync(path.dirname(path.join(directory, file.path)), { recursive: true });
      writeFileSync(path.join(directory, file.path), file.contents);
    }
    esbuild.buildSync({ entryPoints: [path.join(directory, 'src/store.ts')], outfile: path.join(directory, 'store.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent' });
    const run = spawnSync(process.execPath, ['-e', `const store = require('./store.cjs');\n${script}`], { cwd: directory, encoding: 'utf8', timeout: 60_000 });
    if (run.status !== 0) throw new Error(`store script failed: ${run.stderr}`);
    return JSON.parse(run.stdout);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
