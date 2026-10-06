/**
 * s213-m06 — a team's brands, kept and built outside the runtime.
 *
 * The published runtime re-hashes every file it ships before it generates code, so a team's brand cannot be built into
 * it. These tests hold the arrangement that replaces that: a brand lives in the team's brands folder (OODS_BRANDS_DIR;
 * the npm launcher sets ~/.oods-foundry/brands), the shipped token kit is built there beside it, and every tool reads
 * that build. What they hold, and why:
 * - the shipped token package is never written, byte for byte, or code generation from npm would refuse itself;
 * - a restart reuses the build, and a hand edit or a new runtime version rebuilds it, or a team's brand would be stale
 *   or lost after an upgrade;
 * - a rebuild that fails after an upgrade stops serving the old version's tokens and says so;
 * - a generated app for the team's brand carries its stylesheet, and an app for a shipped brand is byte-identical
 *   whether or not team brands exist, or the goldens and every existing app would move.
 * The "shipped" package here is a copy (MCP_BRAND_SOURCE_ROOT), so its bytes can be compared before and after.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as intake } from '../../src/tools/brand.intake.js';
import { handle as apply } from '../../src/tools/brand.apply.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { knownBrands, brandRegistryReport } from '../../src/lib/brand-registry.js';
import { refreshTokenBundle, tokenPackageRoot } from '../../src/lib/token-build.js';
import { resetTokensCssCache } from '../../src/render/document.js';
import { activeUserBuild, buildUserBrands, kitFingerprint, prepareUserBrands, shippedTokenRoot } from '../../src/lib/user-brands.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s213-team-brands-'));
const shipped = path.join(temp, 'tokens');
const brands = path.join(temp, 'brands');
const original = { source: process.env.MCP_BRAND_SOURCE_ROOT, brands: process.env.OODS_BRANDS_DIR };
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const team = JSON.parse(fs.readFileSync(path.join(root, 'tests/tokens/fixtures/team-brand/harbor.tokens.json'), 'utf8'));
team.base.text.muted.$value = 'oklch(0.5 0.025 225)';

/** Every file under a folder with its sha256 (links are not ours). */
function treeHash(folder: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(file);
      else out[path.relative(folder, file)] = sha256(fs.readFileSync(file));
    }
  };
  visit(folder);
  return out;
}

async function generated(brand: string, context: 'detail' | 'workflow', framework: 'react' | 'vue') {
  const composition = await compose({ object: 'Subscription', context, preferences: { brand } } as any);
  expect(composition.status, JSON.stringify(composition.errors)).toBe('ok');
  const result = await generate({ schema: composition.schema!, framework, options: { brand } } as any);
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  return result.artifact!;
}

let shippedBefore: Record<string, string>;
let aDetailWithoutTeam: string;

beforeAll(async () => {
  fs.mkdirSync(shipped);
  for (const name of ['src', 'scripts', 'dist', 'style-dictionary.config.cjs', 'package.json']) {
    fs.cpSync(path.join(root, 'packages/tokens', name), path.join(shipped, name), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(shipped, 'node_modules'), 'dir');
  process.env.MCP_BRAND_SOURCE_ROOT = shipped;
  delete process.env.OODS_BRANDS_DIR;
  aDetailWithoutTeam = (await generated('A', 'detail', 'react')).contentHash;
  process.env.OODS_BRANDS_DIR = brands;
  shippedBefore = treeHash(shipped);
});

afterAll(async () => {
  for (const [key, value] of [['MCP_BRAND_SOURCE_ROOT', original.source], ['OODS_BRANDS_DIR', original.brands]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await refreshTokenBundle();
  resetTokensCssCache();
  fs.rmSync(temp, { recursive: true, force: true });
});

describe('s213-m06 a team brand, built outside the runtime', () => {
  it('create writes into the team brands folder and builds there; the shipped package is not touched', async () => {
    const created = await intake({ action: 'create', brand_id: 'Harbor', documents: team }) as any;
    expect(created.folder).toBe(brands);
    expect(created.files.map((file: any) => file.path)).toEqual(['Harbor/base.json', 'Harbor/dark.json', 'Harbor/hc.json']);
    for (const file of created.files) expect(sha256(fs.readFileSync(path.join(brands, file.path)))).toBe(file.sha256);
    const active = activeUserBuild()!;
    expect(path.dirname(active.root)).toBe(path.join(brands, '.build'));
    expect(active.kit).toBe(kitFingerprint());
    expect(tokenPackageRoot()).toBe(active.root);
    expect(shippedTokenRoot()).toBe(shipped);
    expect(knownBrands()).toEqual(['A', 'B', 'Harbor']);
    expect(brandRegistryReport()).toMatchObject({ teamFolder: brands, issues: [] });
    // Nothing is written into the shipped token package, the runtime's own files (readiness attestation).
    expect(treeHash(shipped)).toEqual(shippedBefore);
  }, 120_000);

  it('a restart reuses the build; a hand edit rebuilds it, and only the new build is kept', async () => {
    const before = activeUserBuild()!;
    expect(await prepareUserBrands()).toMatchObject({ action: 'reused' });
    expect(activeUserBuild()!.root).toBe(before.root);
    const file = path.join(brands, 'Harbor/dark.json');
    const dark = JSON.parse(fs.readFileSync(file, 'utf8'));
    dark.color.brand.Harbor.surface.canvas.$value = 'oklch(0.17 0.02 230)';
    fs.writeFileSync(file, `${JSON.stringify(dark, null, 2)}\n`);
    expect(brandRegistryReport().issues.map(issue => issue.kind)).toEqual(['changed-since-build']);
    const rebuilt = await prepareUserBrands();
    expect(rebuilt).toMatchObject({ action: 'built', reason: "a team brand's files changed after the build" });
    await refreshTokenBundle();
    expect(activeUserBuild()!.root).not.toBe(before.root);
    expect(fs.existsSync(before.root)).toBe(false);
    expect(brandRegistryReport().issues).toEqual([]);
  }, 120_000);

  it('a new runtime version rebuilds; if that fails the old version\'s build is not served, and health says why', async () => {
    const sizing = path.join(shipped, 'src/viz-sizing.json');
    const kept = fs.readFileSync(sizing, 'utf8');
    try {
      // A new version: the kit changes, so the build made from the old one is stale.
      fs.writeFileSync(sizing, `${kept.trimEnd()}\n\n`);
      expect(await prepareUserBrands()).toMatchObject({ action: 'built', reason: 'the runtime changed (a new version, or its token kit)' });
      // Another version whose kit does not build: the team build made from the previous kit is retired, not served.
      const broken = path.join(shipped, 'src/tokens/base/zz-broken.json');
      fs.writeFileSync(broken, '{ not json');
      try {
        expect(await prepareUserBrands()).toMatchObject({ action: 'failed', reason: 'the runtime changed (a new version, or its token kit)' });
        expect(activeUserBuild()).toBeNull();
        expect(tokenPackageRoot()).toBe(shipped);
        expect(brandRegistryReport().issues.map(issue => issue.kind)).toContain('team-build-failed');
      } finally {
        fs.rmSync(broken);
      }
    } finally {
      fs.writeFileSync(sizing, kept);
    }
    expect(await prepareUserBrands()).toMatchObject({ action: 'built' });
    await refreshTokenBundle();
    expect(knownBrands()).toEqual(['A', 'B', 'Harbor']);
  }, 180_000);

  it('refuses a team folder named like a shipped brand before building anything', async () => {
    fs.mkdirSync(path.join(brands, 'b'));
    try {
      await expect(buildUserBrands()).rejects.toThrow(/b in .* is named like a brand OODS Foundry ships/);
    } finally {
      fs.rmSync(path.join(brands, 'b'), { recursive: true });
    }
  });

  it('a generated app for the team brand carries its stylesheet; an app for a shipped brand is unchanged', async () => {
    const lower = 'harbor';
    for (const framework of ['react', 'vue'] as const) {
      const artifact = await generated('Harbor', 'detail', framework);
      const css = artifact.files.find(file => file.path === `src/oods-brand-${lower}.css`);
      expect(css, framework).toBeDefined();
      const screen = artifact.files.find(file => /src\/GeneratedUI\./.test(file.path))!;
      expect(screen.contents).toContain(`import './oods-brand-${lower}.css';`);
      // The file holds Harbor's scopes, with the values its build carries.
      const built = fs.readFileSync(path.join(tokenPackageRoot(), 'dist/css/tokens.css'), 'utf8');
      for (const theme of ['light', 'dark', 'hc']) expect(css!.contents).toContain(`[data-brand='Harbor'][data-theme='${theme}']`);
      expect(css!.contents).not.toContain("[data-brand='A']");
      // s222-m04: the team's own canvas, as its token file declares it (Harbor is made from its recipe since 0.4.0).
      const canvas = `--theme-surface-canvas: ${team.base.surface.canvas.$value};`;
      expect(css!.contents).toContain(canvas);
      expect(built).toContain(canvas);
    }
    const workflow = await generated('Harbor', 'workflow', 'react');
    expect(workflow.files.find(file => file.path === 'src/App.tsx')!.contents).toContain(`import './oods-brand-${lower}.css';`);
    expect(workflow.files.some(file => file.path === `src/oods-brand-${lower}.css`)).toBe(true);
    expect(workflow.files.filter(file => /src\/screens\//.test(file.path)).every(file => !file.contents.includes('oods-brand-'))).toBe(true);
    // A shipped brand's app is byte-identical with or without team brands present.
    expect((await generated('A', 'detail', 'react')).contentHash).toBe(aDetailWithoutTeam);
  }, 180_000);

  it('brand.apply edits the team brand in its folder and rebuilds there, reporting what the build emitted', async () => {
    const result = await apply({ brand: 'Harbor', apply: true, delta: { dark: { color: { brand: { Harbor: { text: { primary: { $value: 'oklch(0.97 0.01 60)' } } } } } } } } as any);
    expect(result.receipt.sourceFiles.map(file => file.path)).toEqual([path.join(brands, 'Harbor/dark.json')]);
    expect(result.receipt.build?.exitCode).toBe(0);
    expect(result.receipt.emitted!.every(change => change.selector.includes("[data-brand='Harbor']"))).toBe(true);
    expect(result.receipt.emitted!.map(change => change.variable)).toContain('--theme-text-primary');
    expect(JSON.parse(fs.readFileSync(path.join(brands, 'Harbor/dark.json'), 'utf8')).color.brand.Harbor.text.primary.$value).toBe('oklch(0.97 0.01 60)');
    expect(treeHash(shipped)).toEqual(shippedBefore);
  }, 120_000);
});
