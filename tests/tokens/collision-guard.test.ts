/**
 * s167 m01 — proof that the token collision guard actually bites.
 *
 * The guard exists because this repo had none: `build.mjs --check --verbose` printed
 * "Token collisions detected (949)" and exited 0 (that count is Style Dictionary's own
 * logger), and `collectValidationIssues()` inspects `dictionary.allTokens` — the list
 * AFTER Style Dictionary has deep-merged the sources — so it can never see a source
 * collision. A guard nothing proves is not a guard, so this file asserts three things:
 *
 *   1. the real source tree is clean;
 *   2. a seeded non-exempt duplicate makes the CLI exit NON-ZERO;
 *   3. the brand overlay exemption is real AND narrow — the declared
 *      `brands/<X>/base.json -> brands/<X>/<theme>.json` chain is exempted, but a
 *      duplicate that crosses out of one brand's directory is still reported.
 *
 * (3) matters because a guard that exempted too much would be green for the wrong
 * reason: the prescribed layering produces 45 differing source-leaf duplicates per themed
 * scope by design, so "no collisions reported" is only meaningful if non-chain duplicates
 * fail. This is a source inventory, distinct from the 41-slot semantic bridge.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- build tooling, no type declarations
import { expandPattern, findCollisions, resolveScopeFiles } from '../../packages/tokens/scripts/collision-guard.mjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- build tooling, no type declarations
import { oodsScoping } from '../../packages/tokens/style-dictionary.config.cjs';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TOKENS_PKG = path.join(REPO_ROOT, 'packages', 'tokens');
const GUARD = path.join(TOKENS_PKG, 'scripts', 'collision-guard.mjs');

function runGuard(root: string) {
  const result = spawnSync('node', [GUARD, '--root', root], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('s167 m01 — the token collision guard', () => {
  let sandbox: string;

  beforeAll(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-collision-guard-'));
    fs.cpSync(path.join(TOKENS_PKG, 'src'), path.join(sandbox, 'src'), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it('exits ZERO on the real, de-collided source tree', () => {
    const { code, out } = runGuard(TOKENS_PKG);
    expect(out).toContain('no non-exempt collisions');
    expect(code).toBe(0);
  });

  it('exits ZERO on an untouched copy of that tree (the sandbox is a faithful baseline)', () => {
    const { code } = runGuard(sandbox);
    expect(code).toBe(0);
  });

  it('exits NON-ZERO on a seeded duplicate whose value differs', () => {
    // `motion.duration.fast` is already declared as the literal "120ms" in
    // src/tokens/motion.json. This is the exact shape of the defect D6 removed.
    const seeded = path.join(sandbox, 'src', 'tokens', 'base', 'seeded-duplicate.json');
    fs.writeFileSync(
      seeded,
      JSON.stringify({ motion: { duration: { fast: { $type: 'duration', $value: '999ms' } } } }, null, 2),
    );

    try {
      const { code, out } = runGuard(sandbox);
      expect(code).not.toBe(0);
      expect(code).toBe(1);
      expect(out).toContain('motion.duration.fast');
      expect(out).toContain('seeded-duplicate.json');
      expect(out).toContain('"999ms"');
      expect(out).toContain('"120ms"');
    } finally {
      fs.rmSync(seeded, { force: true });
    }
  });

  it('exits NON-ZERO when a duplicate leaks a brand path OUT of that brand directory', () => {
    // Same token path as brands/A/base.json, but declared in the shared layer. This is
    // the shape the three src/presets/* files had; it must NOT be swallowed by the
    // brand-overlay exemption, because the exemption requires every declaration to sit
    // under one brand's directory.
    const seeded = path.join(sandbox, 'src', 'tokens', 'base', 'seeded-brand-leak.json');
    fs.writeFileSync(
      seeded,
      JSON.stringify(
        { color: { brand: { A: { surface: { canvas: { $type: 'color', $value: 'oklch(0.5 0.1 200)' } } } } } },
        null,
        2,
      ),
    );

    try {
      const { code, out } = runGuard(sandbox);
      expect(code).toBe(1);
      expect(out).toContain('color.brand.A.surface.canvas');
      expect(out).toContain('seeded-brand-leak.json');
    } finally {
      fs.rmSync(seeded, { force: true });
    }
  });

  it('exempts the declared brand overlay chain — which is doing real work, not nothing', () => {
    // The A/dark scope genuinely contains 44 source paths declared twice with DIFFERENT
    // values (brands/A/base.json then brands/A/dark.json). If the exemption were
    // removed, every one of them would be reported. Proving the count is non-trivial is
    // what stops "0 violations" from being a vacuous green.
    const scope = { brand: 'A', theme: 'dark' };
    const files: string[] = resolveScopeFiles(scope, TOKENS_PKG);

    const brandChainFiles = files.filter((f: string) => f.startsWith('src/tokens/brands/A/'));
    expect(brandChainFiles).toEqual(['src/tokens/brands/A/base.json', 'src/tokens/brands/A/dark.json']);

    // With the exemption in place: clean.
    expect(findCollisions(files, TOKENS_PKG)).toEqual([]);

    // Without it: the same two files collide on all 96 brand source leaves (the four accent status leaves added in s206,
    // the 21 colour roles added in s222-m01, and the 27 chart colours every brand base carries since s222-m02, where it
    // carried only categorical05 since s195). Counted directly from source so this cannot drift out of step with the
    // guard's own logic.
    const leaves = (node: unknown, trail: string[] = []): string[] => {
      const out: string[] = [];
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        const rec = node as Record<string, unknown>;
        if ('$value' in rec) out.push(trail.join('.'));
        for (const [k, v] of Object.entries(rec)) {
          if (!k.startsWith('$')) out.push(...leaves(v, [...trail, k]));
        }
      }
      return out;
    };
    const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(TOKENS_PKG, rel), 'utf8'));
    const baseLeaves = new Set(leaves(read('src/tokens/brands/A/base.json')));
    const darkLeaves = leaves(read('src/tokens/brands/A/dark.json'));
    const overlapping = darkLeaves.filter((p) => baseLeaves.has(p));
    expect(overlapping).toHaveLength(96);
  });

  /**
   * s168 m06 — the exemption's NARROW clause was untested, and provably so: deleting
   * `new Set(brands).size === 1` from `isDeclaredOverlayChain` left all five tests above
   * GREEN. The exemption would then have covered ANY collision between two brand
   * directories, not just a single brand's declared base -> theme overlay chain.
   *
   * WHY IT WAS UNTESTABLE THE OBVIOUS WAY: `sourceForScope` names
   * `brands/{A,B}/base.json` LITERALLY, with no glob, so a NEW file dropped under
   * `brands/B/` is never loaded and a test seeded that way is vacuously green. The seed
   * must therefore EDIT an already-loaded file — and because a scope loads exactly one
   * brand's directory, the cross-brand list is built explicitly here. That is the only
   * shape in which the clause can ever fire.
   */
  it('the exemption is NARROW: a collision spanning two brand directories is NOT exempt', () => {
    const aBase = 'src/tokens/brands/A/base.json';
    const bBase = 'src/tokens/brands/B/base.json';
    const collidingPath = 'color.brand.A.surface.canvas';
    const target = path.join(sandbox, bBase);
    const original = fs.readFileSync(target, 'utf8');

    try {
      // EDIT an already-loaded file: brand B's base.json now also declares one of brand
      // A's paths, with a different value. Both files are real members of the list below.
      const doc = JSON.parse(original);
      doc.color.brand.A = {
        surface: { canvas: { $type: 'color', $value: 'oklch(0.5 0.1 200)' } },
      };
      fs.writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`);

      const reported: Array<{ tokenPath: string }> = findCollisions([aBase, bBase], sandbox);
      expect(
        reported.map((c) => c.tokenPath),
        'a collision spanning brands/A and brands/B was exempted — the single-brand clause is gone',
      ).toContain(collidingPath);

      // CONTROL OF THE CONTROL: the same two files, unedited, collide on nothing in the order a brand A scope loads
      // them (the shared chart defaults, then brand B's base, then A's own last: s222-m02, where each base carries its
      // own brand's chart colours). So the report above is caused by the seed and not by the file pairing itself.
      fs.writeFileSync(target, original);
      expect(findCollisions(['src/viz-scales.json', bBase, aBase], sandbox, { brand: 'A', theme: 'base' })).toEqual([]);
    } finally {
      // The sandbox is shared via beforeAll — always restore, even on failure.
      fs.writeFileSync(target, original);
    }
  });
  it('allows the declared scales and single-series token, never arbitrary shared-token shadows', () => {
    const dark = path.join(sandbox, 'src/tokens/brands/A/dark.json');
    const original = fs.readFileSync(dark, 'utf8');
    try {
      const doc = JSON.parse(original);
      doc.viz.scale.sequential = { '01': { $type: 'color', $value: 'oklch(0.5 0.1 200)' } };
      fs.writeFileSync(dark, JSON.stringify(doc));
      expect(findCollisions(resolveScopeFiles({ brand: 'A', theme: 'dark' }, sandbox), sandbox, { brand: 'A', theme: 'dark' })).toEqual([]);
      // The declared color family is bounded: typography is not an overlay escape.
      doc.ref = { typography: { families: { sans: { $type: 'fontFamily', $value: 'Unapproved' } } } };
      fs.writeFileSync(dark, JSON.stringify(doc));
      expect(findCollisions(resolveScopeFiles({ brand: 'A', theme: 'dark' }, sandbox), sandbox, { brand: 'A', theme: 'dark' }).map((x: any) => x.tokenPath)).toContain('ref.typography.families.sans');
    } finally { fs.writeFileSync(dark, original); }
    const files = ['src/viz-scales.json', 'src/tokens/brands/A/dark.json', 'src/tokens/brands/B/dark.json'];
    expect(findCollisions(files, sandbox).map((x: any) => x.tokenPath)).toContain('viz.mark.single');
    expect(findCollisions(files, sandbox).map((x: any) => x.tokenPath)).toContain('viz.scale.categorical.01');
  });

  /**
   * s222-m02 (#2502 ruling 12): each brand base carries its own recipe's chart colours under the shared viz.* names, so a
   * scope must load its own base last of the bases (style-dictionary.config.cjs sourceForScope). Loaded the other way, a
   * brand A scope would paint brand B's charts; the guard refuses exactly those chart paths.
   */
  it('refuses a scope whose own brand base does not load last, on the chart paths only', () => {
    const scope = { brand: 'A', theme: 'base' };
    const files: string[] = resolveScopeFiles(scope, TOKENS_PKG);
    expect(files.filter((f: string) => f.startsWith('src/tokens/brands/'))).toEqual(['src/tokens/brands/B/base.json', 'src/tokens/brands/A/base.json']);
    expect(findCollisions(files, TOKENS_PKG, scope)).toEqual([]);
    const reversed = [...files.filter((f: string) => f !== 'src/tokens/brands/B/base.json'), 'src/tokens/brands/B/base.json'];
    const reported: string[] = findCollisions(reversed, TOKENS_PKG, scope).map((x: any) => x.tokenPath);
    expect(reported).toContain('viz.scale.categorical.01');
    expect(reported.every(tokenPath => tokenPath.startsWith('viz.'))).toBe(true);
  });

});

/**
 * s213-m07 — the guard runs on the Node floor the npm package promises.
 *
 * Since s213-m06 the runtime ships the token kit and builds a team's brands with it, so this guard runs wherever the
 * package runs, down to Node 20.11.1. It used `fs.globSync` (Node 22+), and on the floor brand.intake create failed with
 * the guard's own "requires fs.globSync" error. Its walker must list exactly what fs.globSync lists, or the build's
 * sources, and so every token output, would differ by Node version.
 */
describe('s213-m07 — the guard needs no fs.globSync', () => {
  it('expands every scope\'s source patterns to exactly what fs.globSync lists', () => {
    const patterns = new Set<string>(oodsScoping.BRAND_SCOPES.flatMap((scope: unknown) => oodsScoping.sourceForScope(scope)));
    expect(patterns.size).toBeGreaterThan(6);
    for (const pattern of patterns) {
      expect(expandPattern(pattern, TOKENS_PKG).sort(), pattern).toEqual((fs as any).globSync(pattern, { cwd: TOKENS_PKG }).sort());
    }
  });

  it('matches fs.globSync on a seeded tree: nesting, dot files, other extensions and a missing folder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s213-m07-glob-'));
    try {
      for (const file of ['src/a.json', 'src/.hidden.json', 'src/notes.md', 'src/tokens/base/x.json', 'src/tokens/base/deep/y.json',
        'src/tokens/base/deep/deeper/z.json', 'src/tokens/base/.dot/w.json', 'src/tokens/brands/Harbor/base.json']) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), '{}');
      }
      for (const pattern of ['src/*.json', 'src/tokens/base/**/*.json', 'src/tokens/brands/Harbor/base.json', 'src/tokens/brands/Nope/base.json', 'src/missing/*.json']) {
        expect(expandPattern(pattern, root).sort(), pattern).toEqual((fs as any).globSync(pattern, { cwd: root }).sort());
      }
      expect(expandPattern('src/tokens/base/**/*.json', root).sort()).toEqual(['src/tokens/base/deep/deeper/z.json', 'src/tokens/base/deep/y.json', 'src/tokens/base/x.json']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads and resolves a scope in a Node where fs.globSync does not exist', () => {
    const script = `import fs from 'node:fs'; delete fs.globSync;
      const guard = await import(${JSON.stringify(new URL(`file://${GUARD}`).href)});
      process.stdout.write(JSON.stringify(guard.resolveScopeFiles({ brand: 'A', theme: 'dark' }, ${JSON.stringify(TOKENS_PKG)})));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(resolveScopeFiles({ brand: 'A', theme: 'dark' }, TOKENS_PKG));
  });
});
