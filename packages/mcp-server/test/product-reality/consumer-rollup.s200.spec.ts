import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureConsumerRollup } from '../../../../scripts/product-reality/consumer-rollup.mjs';

const temporary: string[] = [];
afterEach(() => { for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
const native = '@rollup/rollup-darwin-arm64';
function write(root: string, file: string, content: string) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function installRollup(root: string, packageName = native, healthy = false) {
  write(root, 'node_modules/rollup/package.json', JSON.stringify({ name: 'rollup', main: 'index.cjs' }));
  // Same missing-binding error/cause contract as Rollup's native loader; no npm/network.
  write(root, 'node_modules/rollup/index.cjs', `try { module.exports = require('${packageName}'); } catch (cause) { throw new Error('Native Rollup could not load', { cause }); }`);
  if (healthy) write(root, `node_modules/${packageName}/index.js`, 'module.exports = {};');
}
function fixture(packageName = native, healthy = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s200-rollup-'));
  temporary.push(root);
  write(root, 'package.json', JSON.stringify({ private: true, dependencies: { vite: '6.4.1' } }));
  installRollup(root, packageName, healthy);
  write(root, 'node_modules/.package-lock.json', 'stale hidden lock');
  write(root, 'node_modules/@rollup/rollup-other-platform/index.js', 'stale binding');
  write(root, 'node_modules/@rollup/plugin-test/index.js', 'unrelated scoped package');
  write(root, 'node_modules/@oods/components-vue/package.json', 'exact packed OODS bytes');
  return root;
}

describe('isolated consumer native Rollup recovery (s200 m01)', () => {
  it('leaves a healthy install and its hidden lock untouched without reinstalling', async () => {
    const root = fixture(native, true), reinstall = vi.fn();
    expect(await ensureConsumerRollup(root, reinstall)).toEqual({ retried: false });
    expect(reinstall).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, 'node_modules/.package-lock.json'), 'utf8')).toBe('stale hidden lock');
  });

  it.each([native, '@rollup/rollup-linux-x64-musl', '@rollup/rollup-win32-x64-msvc'])(
    'recovers %s once, retaining the exact consumer manifest and unrelated packages', async packageName => {
      const root = fixture(packageName), manifest = fs.readFileSync(path.join(root, 'package.json'));
      const reinstall = vi.fn(async (args: string[]) => {
        expect(args).toEqual(['--include=optional']);
        for (const removed of ['.package-lock.json', 'rollup', '@rollup/rollup-other-platform']) {
          expect(fs.existsSync(path.join(root, 'node_modules', removed))).toBe(false);
        }
        expect(fs.readFileSync(path.join(root, 'node_modules/@oods/components-vue/package.json'), 'utf8')).toBe('exact packed OODS bytes');
        expect(fs.readFileSync(path.join(root, 'node_modules/@rollup/plugin-test/index.js'), 'utf8')).toBe('unrelated scoped package');
        installRollup(root, packageName, true);
      });
      expect(await ensureConsumerRollup(root, reinstall)).toEqual({ retried: true, missingPackage: packageName });
      expect(reinstall).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(path.join(root, 'package.json'))).toEqual(manifest);
    },
  );

  it('fails naming the native package when the single reinstall still omits it', async () => {
    const root = fixture(), reinstall = vi.fn(async () => { installRollup(root); });
    await expect(ensureConsumerRollup(root, reinstall)).rejects.toThrow(`${native} after one --include=optional reinstall`);
    expect(reinstall).toHaveBeenCalledTimes(1);
  });

  it('retains the package name and install failure without trying a second reinstall', async () => {
    const root = fixture(), reinstall = vi.fn(async () => { throw new Error('registry unavailable'); });
    await expect(ensureConsumerRollup(root, reinstall)).rejects.toThrow(`${native} after one --include=optional reinstall: registry unavailable`);
    expect(reinstall).toHaveBeenCalledTimes(1);
  });

  it.each([
    "throw new Error('broken Rollup code');",
    "require('unrelated-missing-dependency');",
    "const error = new Error(\"Cannot find module '@rollup/rollup-darwin-arm64'\"); error.code = 'ERR_DLOPEN_FAILED'; throw error;",
  ])('does not disguise another loader failure as an optional-dependency retry: %s', async source => {
    const root = fixture(), reinstall = vi.fn();
    write(root, 'node_modules/rollup/index.cjs', source);
    await expect(ensureConsumerRollup(root, reinstall)).rejects.toThrow('Consumer Rollup failed');
    expect(reinstall).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, 'node_modules/rollup'))).toBe(true);
  });

  it('cannot borrow a healthy Rollup from another checkout or remove its files', async () => {
    const root = fixture(), outside = fixture(native, true), reinstall = vi.fn();
    fs.rmSync(path.join(root, 'node_modules/rollup'), { recursive: true });
    fs.symlinkSync(path.join(outside, 'node_modules/rollup'), path.join(root, 'node_modules/rollup'), 'dir');
    await expect(ensureConsumerRollup(root, reinstall)).rejects.toThrow('outside the isolated consumer');
    expect(reinstall).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(outside, 'node_modules/rollup/index.cjs'))).toBe(true);
  });

  it('uses a fresh loader so an earlier successful probe cannot hide a deleted binding', async () => {
    const root = fixture(native, true);
    await ensureConsumerRollup(root, vi.fn());
    fs.rmSync(path.join(root, 'node_modules', native), { recursive: true });
    const reinstall = vi.fn(async () => { installRollup(root, native, true); });
    expect(await ensureConsumerRollup(root, reinstall)).toEqual({ retried: true, missingPackage: native });
    expect(reinstall).toHaveBeenCalledTimes(1);
  });
});
