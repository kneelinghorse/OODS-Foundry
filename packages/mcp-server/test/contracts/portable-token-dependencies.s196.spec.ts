import { handle as intakeReadWriteSplit } from '../../src/tools/brand.read.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle as tokens } from '../../src/tools/tokens.build.js';
import { handle as apply } from '../../src/tools/brand.apply.js';
import { handle as intake } from '../../src/tools/brand.intake.js';
import * as tokenBuild from '../../src/lib/token-build.js';
import * as security from '../../src/lib/security.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const required = ['css/tokens.css', 'ts/tokens.ts', 'tailwind/tokens.json', 'css-variables-by-scope.json'];
let temporary: string;
let tokenRoot: string;

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s196-token-dependencies-'));
  tokenRoot = path.join(temporary, 'packages/tokens');
  for (const relative of required) {
    const destination = path.join(tokenRoot, 'dist', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, 'packages/tokens/dist', relative), destination);
  }
  vi.stubEnv('MCP_BRAND_SOURCE_ROOT', tokenRoot);
  vi.spyOn(security, 'loadPolicy').mockReturnValue({ ...security.loadPolicy(), artifactsBase: path.join(temporary, 'artifacts') });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(temporary, { recursive: true, force: true });
});

describe('s196 portable token dependencies', () => {
  it('refuses a runtime missing the compiler kit instead of silently exporting stale built values', async () => {
    const build = vi.spyOn(tokenBuild, 'runTokenBuild');
    await expect(tokens({ brand: 'B', theme: 'dark', apply: true })).rejects.toMatchObject({
      opiCode: 'OODS-N011', details: { dependency: 'token-compiler-kit', buildAttempted: false },
    });
    expect(build).not.toHaveBeenCalled();
  });

  it('retains the compiler failure and never mutates the shipped token source or dist', async () => {
    for (const entry of ['src', 'scripts', 'style-dictionary.config.cjs', 'package.json']) {
      fs.cpSync(path.join(root, 'packages/tokens', entry), path.join(tokenRoot, entry), { recursive: true });
    }
    fs.writeFileSync(path.join(tokenRoot, 'scripts/build.mjs'), 'console.error("s216 intentional compiler failure"); process.exit(1);');
    const before = fs.readFileSync(path.join(tokenRoot, 'dist/css-variables-by-scope.json'));
    await expect(tokens({ apply: true })).rejects.toMatchObject({
      opiCode: 'OODS-S019', message: expect.stringContaining('s216 intentional compiler failure'),
      details: { build: { exitCode: 1, commands: [{ exitCode: 1, stderr: expect.stringContaining('s216 intentional compiler failure') }] } },
    });
    expect(fs.readFileSync(path.join(tokenRoot, 'dist/css-variables-by-scope.json'))).toEqual(before);
  });

  it.each([false, true])('brand.apply apply:%s reports the actual missing source dependency without raw ENOENT', async shouldApply => {
    const build = vi.spyOn(tokenBuild, 'runTokenBuild');
    await expect(apply({ brand: 'B', delta: {}, apply: shouldApply })).rejects.toMatchObject({
      opiCode: 'OODS-N020',
      message: 'brand.apply: canonical brand source is not shipped in this runtime.',
      details: { tool: 'brand.apply', dependency: 'canonical-brand-source', path: path.join(tokenRoot, 'src/tokens/brands') },
    });
    expect(build).not.toHaveBeenCalled();
  });

  it('intake validates from the shipped brand template without token source or build scripts (s213-m05)', async () => {
    // validate reads only the template the token build ships (dist/brand-template.json): no brand source, no build.
    fs.copyFileSync(path.join(root, 'packages/tokens/dist/brand-template.json'), path.join(tokenRoot, 'dist/brand-template.json'));
    const build = vi.spyOn(tokenBuild, 'runTokenBuild');
    const result = await intakeReadWriteSplit({ action: 'validate', documents: { dark: { text: { primary: { $type: 'color', $value: 'not a colour' } } } } }) as any;
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ rule: 'value-not-colour', theme: 'dark', slot: 'text.primary' }));
    expect(build).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tokenRoot, 'src'))).toBe(false);
  });
});
