/**
 * s168 m06 — the two controls that DISCRIMINATE, plus a full `:root` value audit.
 *
 * ── WHY `:root` NEEDED AUDITING ──
 * `:root` is where the s167 defect actually lived: a flat Style Dictionary run collided
 * every brand × theme file on identical token paths and the alphabetically-last (hc) won,
 * so `:root` shipped brand A's `Highlight` as the default colour. After the fix, exactly
 * ONE of the 88 brand declarations in `:root` was value-checked. This audits all 88.
 *
 * ── THE ORACLE THAT WAS *NOT* BUILT, AND WHY ──
 * The obvious addition — loop `findContamination` over the OTHER BRAND as well as the
 * other themes — is provably VACUOUS. It compares `A/x`'s declared value against
 * `B/y`'s expected value **for the same CSS variable**, but the two brands' variables are
 * `--oods-color-brand-a-*` and `--oods-color-brand-b-*`: the key sets are DISJOINT, so the
 * intersection it iterates is empty and it can never report anything under any regression.
 * Building it would have added a permanently-green test that looked like brand-axis
 * coverage. Asserted below, so the vacuity is a measured fact rather than an opinion.
 *
 * The two oracles here cover the brand axis for real:
 *   CONTAINMENT       — a `[data-brand='A']` block declares ZERO `--oods-color-brand-b-*`.
 *                       Key-based, so it works even where the two brands' VALUES agree.
 *   CORRESPONDING-SLOT— strip the brand segment; A's variable must not carry B's value for
 *                       the same slot. Value-based, so it catches a copy that kept the
 *                       right key.
 *
 * ── HARD LIMIT, STATED IN THE RECORD ──
 * Brands A and B are BYTE-IDENTICAL on all 44 hc source leaves (both resolve to CSS system
 * colours). The semantic bridge remains a distinct 41-slot consumer contract: the three
 * `accent.*` source leaves are intentionally unbridged. No value-keyed brand-axis control
 * can EVER discriminate the hc row — only
 * containment covers it. The same blindness already exists in `findCrossCellLeaks`, which
 * skips whenever two cells agree. Asserted below so it stays a known limit, not a surprise.
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

function cssVarFor(tokenPath: string): string {
  return `--oods-${tokenPath
    .split('.')
    .map((s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
    .join('-')}`;
}

function leaves(node: unknown, trail: string[] = []): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if ('$value' in rec) out.push([trail.join('.'), String(rec.$value)]);
    for (const [k, v] of Object.entries(rec)) if (!k.startsWith('$')) out.push(...leaves(v, [...trail, k]));
  }
  return out;
}

function cellVars(brand: Brand, theme: Theme): Map<string, string> {
  const doc = JSON.parse(fs.readFileSync(path.join(BRAND_ROOT, brand, `${theme}.json`), 'utf8'));
  const map = new Map<string, string>();
  for (const [tokenPath, value] of leaves(doc)) {
    if (!tokenPath.startsWith('color.brand.') || value.startsWith('{')) continue;
    map.set(cssVarFor(tokenPath), value);
  }
  return map;
}

function parseCssBlocks(css: string): Map<string, Map<string, string>> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = new Map<string, Map<string, string>>();
  for (const match of stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = match[1].trim().replace(/"/g, "'");
    if (!selector) continue;
    const decls = new Map<string, string>();
    for (const line of match[2].split(';')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const prop = line.slice(0, idx).trim();
      if (prop.startsWith('--')) decls.set(prop, line.slice(idx + 1).trim());
    }
    for (const one of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
      const existing = blocks.get(one);
      if (existing) for (const [k, v] of decls) existing.set(k, v);
      else blocks.set(one, new Map(decls));
    }
  }
  return blocks;
}

const blocks = parseCssBlocks(fs.readFileSync(TOKENS_CSS, 'utf8'));
const selectorFor = (brand: Brand, theme: Theme) => `[data-brand='${brand}'][data-theme='${theme}']`;

/**
 * A block declares zero variables belonging to any OTHER brand. Key-based.
 *
 * TAKES THE BLOCK MAP AS AN ARGUMENT (s169 m02), and that is the whole point. Both oracles
 * used to be zero-arg closures over the module-level `blocks`, which meant the seeded
 * proofs below could not run through them — they re-implemented the check inline against
 * their own seeded map instead. MEASURED consequence: `return []` at the top of either
 * oracle left all nine tests GREEN. A control that cannot fail is not a control. Now the
 * seeds flow through the real function, and gutting it reds exactly its own proof.
 */
function findContainmentBreaches(cssBlocks: Map<string, Map<string, string>>): string[] {
  const breaches: string[] = [];
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const declared = cssBlocks.get(selectorFor(brand, theme));
      if (!declared) continue;
      for (const other of BRANDS) {
        if (other === brand) continue;
        const foreign = `--oods-color-brand-${other.toLowerCase()}-`;
        for (const key of declared.keys()) {
          if (key.startsWith(foreign)) {
            breaches.push(`${selectorFor(brand, theme)} declares ${key}, which belongs to brand ${other}`);
          }
        }
      }
    }
  }
  return breaches;
}

/**
 * Strip the brand segment: A's variable must not carry B's value for the same slot.
 * Parameterised for the same reason as `findContainmentBreaches` — see there.
 */
function findCorrespondingSlotLeaks(cssBlocks: Map<string, Map<string, string>>): string[] {
  const leaksFound: string[] = [];
  for (const theme of THEMES) {
    const a = cellVars('A', theme);
    const b = cellVars('B', theme);
    const declaredA = cssBlocks.get(selectorFor('A', theme));
    const declaredB = cssBlocks.get(selectorFor('B', theme));
    if (!declaredA || !declaredB) continue;
    const slotOf = (key: string) => key.replace(/^--oods-color-brand-[ab]-/, '');
    const bBySlot = new Map([...b].map(([k, v]) => [slotOf(k), v]));
    const aBySlot = new Map([...a].map(([k, v]) => [slotOf(k), v]));
    for (const [key, ownValue] of a) {
      const slot = slotOf(key);
      const otherValue = bBySlot.get(slot);
      // Only discriminating where the two brands genuinely disagree on this slot.
      if (otherValue === undefined || otherValue === ownValue) continue;
      if (declaredA.get(key) === otherValue) {
        leaksFound.push(`A/${theme} ${key} carries brand B's value for slot ${slot} ("${otherValue}")`);
      }
    }
    for (const [key, ownValue] of b) {
      const slot = slotOf(key);
      const otherValue = aBySlot.get(slot);
      if (otherValue === undefined || otherValue === ownValue) continue;
      if (declaredB.get(key) === otherValue) {
        leaksFound.push(`B/${theme} ${key} carries brand A's value for slot ${slot} ("${otherValue}")`);
      }
    }
  }
  return leaksFound;
}

describe('s168 m06 — :root value audit + the two discriminating brand-axis oracles', () => {
  it('(a) :root carries the full union of both brands’ base cells, every value checked', () => {
    const root = blocks.get(':root');
    expect(root, ':root block missing').toBeDefined();

    const expected = new Map([...cellVars('A', 'base'), ...cellVars('B', 'base')]);
    // DERIVED, not hard-coded: 69 + 69 colour source leaves with disjoint brand key sets (s206-m01: +4 accent status each;
    // s222-m01: +21, the secondary and destructive fills, control borders, destructive text and six solids with their text).
    expect(expected.size).toBe(cellVars('A', 'base').size + cellVars('B', 'base').size);
    expect(expected.size).toBe(138);

    const wrong: string[] = [];
    for (const [cssVar, want] of expected) {
      const got = root!.get(cssVar);
      if (got !== want) wrong.push(`${cssVar}: expected "${want}", got "${got ?? '<absent>'}"`);
    }
    expect(wrong, `:root brand declarations that are wrong or missing:\n  ${wrong.join('\n  ')}`).toEqual([]);

    // ...and :root declares no brand variable BEYOND that union.
    const extra = [...root!.keys()].filter((k) => k.startsWith('--oods-color-brand-') && !expected.has(k));
    expect(extra, `:root declares brand variables outside the base union: ${extra.join(', ')}`).toEqual([]);
  });

  it('(a) no :root brand value is a dark or hc value — DERIVED, never hard-coded', () => {
    // CAUTION the charter flagged, and it is real: after m03's palette work a base and a
    // dark value CAN legitimately coincide. So a blanket "no dark value appears" assertion
    // would be a false positive. What is checked instead is the only thing that means
    // anything: where base and dark/hc genuinely DIFFER, :root must carry the BASE one.
    const root = blocks.get(':root')!;
    const violations: string[] = [];
    for (const brand of BRANDS) {
      const base = cellVars(brand, 'base');
      for (const theme of ['dark', 'hc'] as const) {
        for (const [cssVar, otherValue] of cellVars(brand, theme)) {
          const baseValue = base.get(cssVar);
          if (baseValue === undefined || baseValue === otherValue) continue;
          if (root.get(cssVar) === otherValue) {
            violations.push(`:root ${cssVar} carries ${brand}/${theme}'s value "${otherValue}", not base's "${baseValue}"`);
          }
        }
      }
    }
    expect(violations, `:root is contaminated:\n  ${violations.join('\n  ')}`).toEqual([]);
  });

  it('(b) CONTAINMENT: no brand block declares another brand’s variables', () => {
    expect(findContainmentBreaches(blocks)).toEqual([]);
  });

  it('(b) CORRESPONDING-SLOT: no brand block carries the other brand’s value for a slot', () => {
    expect(findCorrespondingSlotLeaks(blocks)).toEqual([]);
  });

  /**
   * The seed runs THROUGH the oracle (s169 m02) and the assertion is on the oracle's exact
   * REPORT STRING, not on a re-implemented predicate. Both halves matter: routing through
   * the real function is what makes `return []` detectable, and asserting the message is
   * what makes a silently-reworded or mis-attributed report detectable.
   */
  it('(b) the containment oracle is discriminating (seeded foreign variable)', () => {
    const seeded = parseCssBlocks(
      `${fs.readFileSync(TOKENS_CSS, 'utf8')}\n${selectorFor('A', 'dark')} { --oods-color-brand-b-surface-canvas: rgb(1,2,3); }\n`,
    );
    expect(findContainmentBreaches(seeded)).toEqual([
      "[data-brand='A'][data-theme='dark'] declares --oods-color-brand-b-surface-canvas, which belongs to brand B",
    ]);
    // Control of the control: unseeded is clean, so the seed is what moved it.
    expect(findContainmentBreaches(blocks)).toEqual([]);
  });

  it('(b) the corresponding-slot oracle is discriminating (seeded cross-brand value)', () => {
    // S197 shares neutrals; the primary remains the discriminating brand role.
    const slot = 'surface-interactive-primary-default';
    const aKey = `--oods-color-brand-a-${slot}`;
    const bValue = cellVars('B', 'base').get(`--oods-color-brand-b-${slot}`)!;
    const aValue = cellVars('A', 'base').get(aKey)!;
    // The seed only means something if the two brands genuinely disagree here.
    expect(aValue).not.toBe(bValue);

    const seeded = parseCssBlocks(
      `${fs.readFileSync(TOKENS_CSS, 'utf8')}\n${selectorFor('A', 'base')} { ${aKey}: ${bValue}; }\n`,
    );
    expect(findCorrespondingSlotLeaks(seeded)).toEqual([
      `A/base ${aKey} carries brand B's value for slot ${slot} ("${bValue}")`,
    ]);
    // Control of the control: unseeded is clean, so the seed is what moved it.
    expect(findCorrespondingSlotLeaks(blocks)).toEqual([]);
  });

  it('the otherBrand contamination loop would be VACUOUS — measured, not asserted by opinion', () => {
    // The reason it was not built: the two brands' CSS variable key sets are DISJOINT, so
    // any loop comparing A's declared values against B's expected values BY KEY iterates
    // an empty intersection and can never report anything.
    for (const theme of THEMES) {
      const aKeys = new Set(cellVars('A', theme).keys());
      const bKeys = new Set(cellVars('B', theme).keys());
      const intersection = [...aKeys].filter((k) => bKeys.has(k));
      expect(intersection, `${theme}: brand key sets are no longer disjoint`).toEqual([]);
      expect(aKeys.size).toBe(69);
      expect(bKeys.size).toBe(69);
    }
  });

  /**
   * (d) THE NO-OP CONTROL. A bridge block that merely restated `:root`'s value would be a
   * no-op wearing a selector — emitted, parseable, and changing nothing. Before s167 that
   * is exactly what emitting `[data-brand]` blocks would have been.
   *
   * The comparison is over RESOLVED VALUES from the token sources, and THE EXPECTED TABLE
   * IS DERIVED, never hard-coded. That matters here specifically: `:root` IS brand A base
   * (memo D2), so A/base is expected to agree with `:root` on everything, and the count of
   * agreeing slots in the other cells is a moving number — m03's status re-authoring
   * changed it. Pinning it as a literal would have made this control a maintenance trap of
   * the same species m03 removed from two other tests.
   */
  it('(d) every non-base cell genuinely differs from :root — the blocks are not no-ops', () => {
    const root = blocks.get(':root')!;
    const summary: string[] = [];
    for (const brand of BRANDS) {
      for (const theme of THEMES) {
        const declared = blocks.get(selectorFor(brand, theme));
        if (!declared) continue;
        const own = cellVars(brand, theme);
        let differ = 0;
        for (const [cssVar, value] of own) if (root.get(cssVar) !== value) differ += 1;
        summary.push(`${brand}/${theme}: ${differ}/${own.size} differ from :root`);
        if (theme === 'base') {
          // BOTH base cells agree with `:root`, and that is correct rather than a no-op.
          // The memo describes `:root` as "brand A + base" (D2), but MEASURED it carries
          // the UNION of both brands' base values — 88 brand declarations, 44 per brand —
          // because these variables are brand-NAMESPACED (`--oods-color-brand-a-*` vs
          // `--oods-color-brand-b-*`) and therefore cannot collide. This control's first
          // draft expected only A/base to agree and went red on B/base; the expectation
          // was wrong, not the CSS. What actually switches brands is the `--theme-*`
          // mapping layer, not these namespaced primitives.
          expect(differ, `${brand}/base should match :root — :root carries both base cells`).toBe(0);
        } else {
          expect(
            differ,
            `${brand}/${theme} restates :root on every slot — the block is a no-op wearing a selector`,
          ).toBeGreaterThan(0);
        }
      }
    }
    console.log(summary.join('\n'));
  });

  it('HARD LIMIT: A and B are byte-identical on every hc slot, so only containment covers hc', () => {
    const a = cellVars('A', 'hc');
    const b = cellVars('B', 'hc');
    const slotOf = (key: string) => key.replace(/^--oods-color-brand-[ab]-/, '');
    const bBySlot = new Map([...b].map(([k, v]) => [slotOf(k), v]));
    const differing = [...a].filter(([k, v]) => bBySlot.get(slotOf(k)) !== v);
    expect(
      differing,
      'A and B now DIFFER on some hc slot — the value-keyed brand-axis controls can finally ' +
        'discriminate part of the hc row, and this limit should be re-stated rather than deleted',
    ).toEqual([]);
    expect(a.size).toBe(69);
  });
});
