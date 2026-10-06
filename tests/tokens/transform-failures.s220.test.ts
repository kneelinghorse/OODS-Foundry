import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import StyleDictionary from 'style-dictionary';
import { assertNoTransformFailures, recordTransformFailures } from '../../packages/tokens/scripts/transform-failures.mjs';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// s220-m02: Style Dictionary 5 catches a throwing transform and carries on with a fallback value, where 4.4.0 failed the
// build. The token build records every such failure and fails after it runs, so a brand never ships a silently wrong value.
const tokens = { color: { ok: { $type: 'color', $value: '#123456' }, broken: { $type: 'color', $value: '#abcdef' } } };
const dictionary = (transforms: string[]) => new StyleDictionary({ tokens, platforms: { probe: { transforms } }, log: { verbosity: 'silent' } });

describe('a token transform that throws fails the build (s220-m02)', () => {
  it('Style Dictionary 5 alone finishes the build and keeps a value the transform never produced', async () => {
    StyleDictionary.registerTransform({ name: 'test/unguarded', type: 'value', filter: (token) => token.path.includes('broken'), transform: () => { throw new Error('bad input'); } });
    const platform = await dictionary(['test/unguarded']).exportPlatform('probe');
    expect(platform.color.broken.$value).toBe('#abcdef');
  });

  it('the guard records the failure, synchronous or asynchronous, and assertNoTransformFailures throws with it', async () => {
    StyleDictionary.registerTransform({ name: 'test/sync-throw', type: 'value', filter: (token) => token.path.includes('broken'), transform: () => { throw new Error('bad sync input'); } });
    StyleDictionary.registerTransform({ name: 'test/async-throw', type: 'value', filter: (token) => token.path.includes('ok'), transform: async () => { throw new Error('bad async input'); } });
    const failures = recordTransformFailures(StyleDictionary);
    await dictionary(['test/sync-throw', 'test/async-throw']).exportPlatform('probe');
    expect(failures).toEqual(expect.arrayContaining(['test/sync-throw: color.broken: bad sync input', 'test/async-throw: color.ok: bad async input']));
    expect(() => assertNoTransformFailures(failures)).toThrow(/Token transforms failed \(2\)/);
  });

  it('the real token build fails on a colour its modifier transform cannot parse, instead of shipping it unmodified', () => {
    // Staged as the server stages a team brand build (compileTokenKit): the shipped kit, the server's dependencies, and
    // one token whose colour modifier throws. Without the guard's wiring, Style Dictionary 5 exits 0 and the CSS carries
    // `--oods-probe-broken: not-a-colour;`.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-transform-guard-'));
    try {
      for (const entry of ['src', 'scripts', 'style-dictionary.config.cjs', 'package.json']) {
        fs.cpSync(path.join(REPO_ROOT, 'packages/tokens', entry), path.join(root, entry), { recursive: true });
      }
      fs.rmSync(path.join(root, 'src/tokens/aliases'), { recursive: true, force: true });
      fs.symlinkSync(path.join(REPO_ROOT, 'packages/mcp-server/node_modules'), path.join(root, 'node_modules'), 'dir');
      const probe = { $type: 'color', $value: 'not-a-colour', $extensions: { 'studio.tokens': { modify: { type: 'lighten', value: '0.2', space: 'srgb' } } } };
      fs.writeFileSync(path.join(root, 'src/tokens/base/probe.json'), JSON.stringify({ probe: { broken: probe } }));
      const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
      expect(build.status).toBe(1);
      expect(build.stdout + build.stderr).toMatch(/Token transforms failed \(\d+\):\nts\/color\/modifiers: probe\.broken: Could not parse not-a-colour as a color/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);

  it('a clean build records nothing', async () => {
    StyleDictionary.registerTransform({ name: 'test/fine', type: 'value', transform: (token) => token.$value });
    const failures = recordTransformFailures(StyleDictionary);
    await dictionary(['test/fine']).exportPlatform('probe');
    expect(failures).toEqual([]);
    expect(() => assertNoTransformFailures(failures)).not.toThrow();
  });
});
