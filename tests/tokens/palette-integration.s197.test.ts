import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
// @ts-ignore -- shared browser proof helper is native ESM.
import { focusIdentityFailures } from '../../scripts/quality/brand-focus-identity.mjs';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const contract = JSON.parse(readFileSync('tests/tokens/__fixtures__/brand-css-slot-contract.json', 'utf8'));

describe('S197 palette integration preserves discriminating gates', () => {
  it('keeps all nine cross-brand focus relationships, including shared neutral/accent and HC', () => {
    expect(focusIdentityFailures(contract.focusValues)).toEqual([]);
    for (const theme of ['base', 'dark', 'hc']) for (const slot of ['--theme-focus-ring-outer', '--theme-focus-ring-inner', '--theme-focus-text']) {
      const changed = structuredClone(contract.focusValues);
      changed[`B/${theme}`][slot] = theme !== 'hc' && slot !== '--theme-focus-ring-inner'
        ? changed[`A/${theme}`][slot] : 'incorrect divergent paint';
      expect(focusIdentityFailures(changed)).toHaveLength(1);
      expect(focusIdentityFailures(changed)[0]).toContain(`${theme} ${slot}`);
    }
    expect(focusIdentityFailures({})).toHaveLength(9);
  });

  it('lints every DTCG root while keeping seed metadata under its separate schema contract', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'oods-palette-lint-')); temporary.push(root);
    symlinkSync(path.resolve('tools'), path.join(root, 'tools'), 'dir');
    for (const directory of ['tokens', 'presets', 'palette']) mkdirSync(path.join(root, 'packages/tokens/src', directory), { recursive: true });
    const write = (file: string, value: unknown) => writeFileSync(path.join(root, 'packages/tokens/src', file), JSON.stringify(value));
    write('palette/seeds.json', { primaryHue: 43, schemaVersion: 1 });
    write('palette/seeds.schema.json', { additionalProperties: false });
    write('viz-scales.json', {});
    const command = JSON.parse(readFileSync('package.json', 'utf8')).scripts['lint:tokens'];
    const run = () => spawnSync('sh', ['-c', command], { cwd: root, encoding: 'utf8' });
    expect(run().status).toBe(0);
    // Every format-bearing root must still reject an invalid token, including the
    // standalone viz files that a tokens-only directory scope would accidentally omit.
    for (const file of ['tokens/invalid.json', 'presets/invalid.json', 'viz-scales.json']) {
      write(file, { 'invalidName': { $type: 'color', $value: '#000000' } });
      const result = run();
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stdout).toContain(file);
      write(file, {});
    }
  });
});
