import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { commandResult, createConsumerFiles, assertInstalledIsolation, REPOSITORY_ROOT } from '../../../../scripts/product-reality/s184-m06-live-consumers.js';

const require = createRequire(import.meta.url);
describe('in-repository packed consumers cannot borrow checkout dependencies (s212-m06)', () => {
  it('resolves the installed React peer but fails when removed, even though an ancestor has React', () => {
    // The fixture is deliberately below the checkout's real node_modules so the unisolated control can borrow it.
    const parent = path.join(REPOSITORY_ROOT, '.tmp'); fs.mkdirSync(parent, { recursive: true });
    const consumer = fs.mkdtempSync(path.join(parent, 's212-module-control-'));
    try {
      fs.writeFileSync(path.join(consumer, 'package.json'), '{"type":"module"}\n');
      const peer = path.join(consumer, 'node_modules/react'); fs.mkdirSync(path.dirname(peer));
      fs.cpSync(path.dirname(require.resolve('react/package.json')), peer, { recursive: true });
      const args = ['--input-type=module', '-e', 'import {createRequire} from "node:module"; import path from "node:path"; console.log(createRequire(path.join(process.cwd(),"package.json")).resolve("react"));'];
      const run = (isolateDependencies: boolean) => commandResult(process.execPath, args, consumer, { isolateDependencies });
      // Other platforms refuse a host checkout with ancestor modules; their positive proof uses the isolated Linux mount.
      if (process.platform !== 'darwin') { expect(() => run(true)).toThrow(/isolated mount/); return; }
      const installed = run(true); expect(installed.exitCode, installed.stderr).toBe(0); expect(installed.stdout).toContain(`${consumer}/node_modules/react/`);
      fs.rmSync(peer, { recursive: true });
      const borrowed = run(false); expect(borrowed.exitCode, borrowed.stderr).toBe(0); expect(borrowed.stdout).not.toContain(consumer);
      const isolated = run(true); expect(isolated.exitCode).not.toBe(0); expect(isolated.stderr).toMatch(/MODULE_NOT_FOUND/);
    } finally { fs.rmSync(consumer, { recursive: true, force: true }); }
  });
  it('accepts an in-worktree consumer only with local package identities and a real missing-peer refusal', () => {
    if (process.platform !== 'darwin') return; // Host platforms with ancestors must use an isolated Linux mount.
    const parent = path.join(REPOSITORY_ROOT, '.tmp'); fs.mkdirSync(parent, { recursive: true });
    const consumer = fs.mkdtempSync(path.join(parent, 's218-local-consumer-'));
    try {
      fs.writeFileSync(path.join(consumer, 'package.json'), '{}');
      const modules = path.join(consumer, 'node_modules'); fs.mkdirSync(modules);
      fs.cpSync(path.dirname(require.resolve('react/package.json')), path.join(modules, 'react'), { recursive: true });
      const local = path.join(modules, '@oods/tokens'); fs.mkdirSync(local, { recursive: true });
      fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify({ name: '@oods/tokens', version: '0.3.0' }));
      const records = [{ name: '@oods/tokens', version: '0.3.0' }];
      const proof = assertInstalledIsolation(consumer, 'react', records, {});
      expect(proof).toMatchObject({ outsidePnpmWorkspace: false, allResolvedPathsOutsideRepository: false, allResolvedPathsInsideConsumer: true, ancestorLookupDenied: true, missingPeer: { positive: 0, restored: true } });
      expect((proof.missingPeer as any).negative).not.toBe(0);
      fs.rmSync(local, { recursive: true }); fs.symlinkSync(path.join(REPOSITORY_ROOT, 'packages/tokens'), local);
      expect(() => assertInstalledIsolation(consumer, 'react', records, {})).toThrow(/workspace symlink/);
    } finally { fs.rmSync(consumer, { recursive: true, force: true }); }
  });
  it.each(['react', 'vue'] as const)('%s typechecking requests only consumer-owned ambient types', framework => {
    const files = createConsumerFiles({ framework, source: framework === 'react' ? 'export const GeneratedUI = () => null;' : '<template><main /></template>', actions: [], model: {}, schemaName: 'isolation', mission: 's212-m06' });
    const options = JSON.parse(files['tsconfig.json']).compilerOptions;
    expect(options.types).toEqual(['node', 'vite/client']);
    expect(options.typeRoots).toEqual(['./node_modules/@types', './node_modules']);
    expect(files['vite.config.mjs']).toContain('css: { postcss: { plugins: [] } }');
  });
});
