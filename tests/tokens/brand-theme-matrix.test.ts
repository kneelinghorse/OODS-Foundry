/**
 * s167 m01 — the brand x theme matrix oracle.
 *
 * This is deliberately NOT a literal-presence grep. Presence cannot discriminate SCOPE
 * ASSIGNMENT: before s167 the shipped CSS contained brand A's hc value `Highlight` and a
 * grep for it passed, while the base and dark values reached no output at all. The oracle
 * therefore GENERATES its expectation table from the six brand source files and asserts,
 * per emitted scope, that (a) every path carries ITS OWN scope's value and (b) no scope
 * carries another scope's value for the same path (R16 / R13a, memo SS4 m1).
 *
 * Root cause it pins: style-dictionary.config.cjs globbed `src/**\/*.json` into ONE flat
 * run emitting ONE `:root`, so brands/A/{base,dark,hc}.json collided on identical token
 * paths and the alphabetically-last file (hc) won.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BRAND_ROOT = path.join(REPO_ROOT, 'packages', 'tokens', 'src', 'tokens', 'brands');
const TOKENS_CSS = path.join(REPO_ROOT, 'packages', 'tokens', 'dist', 'css', 'tokens.css');

const BRANDS = ['A', 'B'] as const;
const THEMES = ['base', 'dark', 'hc'] as const;
type Brand = (typeof BRANDS)[number];
type Theme = (typeof THEMES)[number];

/** memo SS3 D9 — the pinned selector table. `:root` is brand A + base (D2). */
function selectorsFor(brand: Brand, theme: Theme): string[] {
  const attr = `[data-brand='${brand}'][data-theme='${theme}']`;
  if (brand === 'A' && theme === 'base') return [':root', attr];
  return [attr];
}

/**
 * `color.brand.A.surface.canvas` -> `--oods-color-brand-a-surface-canvas`
 *
 * Style Dictionary's `name/kebab` transform kebab-cases the JOINED path, which splits
 * camelCase segments too: `color.brand.B.text.onInteractive` emits as
 * `--oods-color-brand-b-text-on-interactive`, NOT `...-oninteractive`. An earlier
 * revision of this oracle lowercased the path without splitting, so it asserted a
 * variable that has never existed in any build — an expectation no correct fix could
 * ever satisfy. Splitting on the camelCase boundary is what makes the table match the
 * emitted names.
 */
function cssVarFor(tokenPath: string): string {
  const kebab = tokenPath
    .split('.')
    .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
    .join('-');
  return `--oods-${kebab}`;
}

function leaves(node: unknown, trail: string[] = []): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if ('$value' in rec) out.push([trail.join('.'), String(rec.$value)]);
    for (const [k, v] of Object.entries(rec)) {
      if (!k.startsWith('$')) out.push(...leaves(v, [...trail, k]));
    }
  }
  return out;
}

/** brand x theme -> (cssVar -> expected literal). Only literals; references are skipped. */
function expectationTable(): Map<string, Map<string, string>> {
  const table = new Map<string, Map<string, string>>();
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const file = path.join(BRAND_ROOT, brand, `${theme}.json`);
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const scoped = new Map<string, string>();
      for (const [tokenPath, value] of leaves(doc)) {
        // Brand colour slots only; alias values are not literals and cannot be compared here.
        // s168 m06 DELETED a stale claim here that `ref.typography.*` leaks out of brands/A.
        // MEASURED: every brand file has ZERO non-`color.brand.*` leaves, in all six cells.
        // It was memo-to-memo inheritance of exactly the kind this sprint corrects.
        if (!tokenPath.startsWith('color.brand.')) continue;
        if (value.startsWith('{')) continue;
        scoped.set(cssVarFor(tokenPath), value);
      }
      table.set(`${brand}/${theme}`, scoped);
    }
  }
  return table;
}

/**
 * selector -> (customProperty -> declaredValue), for every top-level block in the file.
 *
 * ALL comments are stripped up front, before any splitting. Style Dictionary emits each
 * token's `$description` as a trailing `/** ... *\/` on the same line, and those
 * descriptions contain colons — contrast ratios like "≥4.5:1" are everywhere in the
 * brand palettes. An earlier revision of this parser split the block body on ';' and
 * then took the first ':' in each segment; that colon landed inside the PREVIOUS
 * declaration's trailing comment, so the declaration following every contrast-ratio
 * description was silently dropped — roughly 15% of every block, `:root` included.
 * Dropped declarations surface as bogus "<absent>" mismatches in the value assertions
 * and, far worse, are invisible to the cross-contamination control below: a property
 * the parser never saw can never be reported as carrying another scope's value.
 */
function parseCssBlocks(css: string): Map<string, Map<string, string>> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = new Map<string, Map<string, string>>();
  const blockRe = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(stripped)) !== null) {
    const selector = match[1].trim().replace(/"/g, "'");
    if (!selector) continue;
    const decls = new Map<string, string>();
    for (const line of match[2].split(';')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const prop = line.slice(0, idx).trim();
      if (!prop.startsWith('--')) continue;
      decls.set(prop, line.slice(idx + 1).trim());
    }
    // A rule may group selectors (`[data-theme='base'],[data-theme='light']`); index each.
    for (const one of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
      const existing = blocks.get(one);
      if (existing) for (const [k, v] of decls) existing.set(k, v);
      else blocks.set(one, new Map(decls));
    }
  }
  return blocks;
}

type Blocks = Map<string, Map<string, string>>;
type Table = Map<string, Map<string, string>>;

/** Paths in `brand/theme`'s block that do not carry that scope's own source value. */
function findWrongValues(blocks: Blocks, table: Table, brand: Brand, theme: Theme): string[] {
  const expected = table.get(`${brand}/${theme}`)!;
  const declared = blocks.get(selectorsFor(brand, theme).at(-1)!);
  if (!declared) return [`no block for selector ${selectorsFor(brand, theme).at(-1)}`];

  const wrong: string[] = [];
  for (const [cssVar, want] of expected) {
    const got = declared.get(cssVar);
    if (got !== want) wrong.push(`${cssVar}: expected "${want}", got "${got ?? '<absent>'}"`);
  }
  return wrong;
}

/** Any scope block carrying a DIFFERENT scope's value for the same path. */
function findContamination(blocks: Blocks, table: Table): string[] {
  const contaminated: string[] = [];
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const selector = selectorsFor(brand, theme).at(-1)!;
      const declared = blocks.get(selector);
      if (!declared) continue;
      const own = table.get(`${brand}/${theme}`)!;

      for (const otherTheme of THEMES) {
        if (otherTheme === theme) continue;
        const other = table.get(`${brand}/${otherTheme}`)!;
        for (const [cssVar, otherValue] of other) {
          const ownValue = own.get(cssVar);
          // Only discriminating where the two scopes genuinely differ.
          if (ownValue === undefined || ownValue === otherValue) continue;
          if (declared.get(cssVar) === otherValue) {
            contaminated.push(
              `${selector} ${cssVar} carries ${brand}/${otherTheme}'s value "${otherValue}" (should be "${ownValue}")`,
            );
          }
        }
      }
    }
  }
  return contaminated;
}

describe('s167 m01 — brand x theme matrix is scope-correct in the emitted CSS', () => {
  const css = fs.readFileSync(TOKENS_CSS, 'utf8');
  const blocks = parseCssBlocks(css);
  const table = expectationTable();

  it('emits a block for every one of the six brand x theme scopes', () => {
    const missing: string[] = [];
    for (const brand of BRANDS) {
      for (const theme of THEMES) {
        for (const selector of selectorsFor(brand, theme)) {
          if (!blocks.has(selector)) missing.push(`${brand}/${theme} -> ${selector}`);
        }
      }
    }
    expect(missing, `tokens.css is missing scope blocks: ${missing.join(', ')}`).toEqual([]);
  });

  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      it(`${brand}/${theme}: every brand token carries its OWN scope's source value`, () => {
        const expected = table.get(`${brand}/${theme}`)!;
        // 69 brand colour leaves per file — distinct from the 73 semantic bridge slots (s206-m01: +4 accent status;
        // s222-m01: +21 colours, and the bridge's radius and font slots read the base file's radius and font groups;
        // leaves in every scope). A table that silently emptied would otherwise pass vacuously.
        expect(expected.size).toBe(69);

        const wrong = findWrongValues(blocks, table, brand, theme);
        expect(wrong, `${brand}/${theme} scope carries wrong values:\n  ${wrong.join('\n  ')}`).toEqual([]);
      });
    }
  }

  it('no scope carries another scope\'s value (cross-contamination control)', () => {
    const contaminated = findContamination(blocks, table);
    expect(contaminated, `cross-scope contamination:\n  ${contaminated.join('\n  ')}`).toEqual([]);
  });

  /**
   * The control above is only worth its green if it can go red. Before the restructure
   * it passed VACUOUSLY — no scope blocks existed at all, so the loop found nothing to
   * compare and reported clean. This seeds an actual contamination through the exact
   * same code path and proves both checks report it.
   */
  it('the cross-contamination control is discriminating (seeded contamination)', () => {
    const cssVar = '--oods-color-brand-a-surface-interactive-primary-default';
    const baseValue = table.get('A/base')!.get(cssVar);
    const darkValue = table.get('A/dark')!.get(cssVar);
    // The seed is only meaningful if the two scopes genuinely disagree here. s168 m03
    // RE-ANCHORED this: it used to hard-pin the two literals ('oklch(0.58 0.19 43)' and
    // 'oklch(0.72 0.16 183)'), both of which that mission changed — the palette moved to
    // orange and the base value gained contrast margin. A pin that must be hand-edited
    // whenever a token changes is a maintenance trap, and worse, hand-editing it is
    // indistinguishable from silencing it. Derive the premise instead: both scopes must
    // resolve, and they must disagree. That is the ONLY property the seed needs.
    expect(baseValue, `${cssVar} missing from A/base`).toBeDefined();
    expect(darkValue, `${cssVar} missing from A/dark`).toBeDefined();
    expect(baseValue).not.toBe(darkValue);

    // A later block for the same selector overrides that one property, exactly as a
    // regressed build that leaked A/dark's value into the A/base scope would.
    const seeded = parseCssBlocks(
      `${css}\n[data-brand='A'][data-theme='base'] { ${cssVar}: ${darkValue}; }\n`,
    );

    const contamination = findContamination(seeded, table);
    expect(contamination.join('\n')).toContain(cssVar);
    expect(contamination.some((c) => c.includes("A/dark's value"))).toBe(true);

    // ...and the per-scope value assertion must catch the same seed.
    expect(findWrongValues(seeded, table, 'A', 'base').join('\n')).toContain(cssVar);

    // Control of the control: the unseeded input is clean, so the seed is what moved it.
    expect(findContamination(blocks, table)).toEqual([]);
  });

  it('regression pin: brand A base is its own colour, never the hc forced-colors keyword', () => {
    const v = '--oods-color-brand-a-surface-interactive-primary-default';
    const root = blocks.get(':root');
    expect(root, ':root block missing').toBeDefined();
    // The exact s167 defect: hc won the flat merge and shipped `Highlight` as the default.
    expect(root!.get(v)).toBe(table.get('A/base')!.get(v));
    expect(root!.get(v)).not.toBe('Highlight');
  });
});
