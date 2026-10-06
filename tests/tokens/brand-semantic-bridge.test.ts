/**
 * s167 m02 — the brand → semantic bridge, verified at the CSS-ARTIFACT level.
 *
 * SCOPE OF THIS CONTROL, STATED UP FRONT: it loads the token sources and ONLY the
 * generated `packages/tokens/dist/css/tokens.css` artifact. It proves that the artifact
 * carries the correct six-cell matrix; the browser cascade is proven separately by
 * `scripts/quality/brand-cascade-browser-proof.mjs`.
 *
 * The expectation table is GENERATED from the six brand source files crossed with the
 * authored slot map — never transcribed from the build's own output.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- build tooling, no type declarations
import { SEMANTIC_BRIDGE, UNBRIDGED_SLOTS } from '../../packages/tokens/scripts/brand-bridge.mjs';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BRAND_ROOT = path.join(REPO_ROOT, 'packages', 'tokens', 'src', 'tokens', 'brands');
const TOKENS_CSS = path.join(REPO_ROOT, 'packages', 'tokens', 'dist', 'css', 'tokens.css');
const SLOT_CONTRACT = path.join(__dirname, '__fixtures__', 'brand-css-slot-contract.json');

const BRANDS = ['A', 'B'] as const;
const THEMES = ['base', 'dark', 'hc'] as const;
type Brand = (typeof BRANDS)[number];
type Theme = (typeof THEMES)[number];

/** A colour slot names a brand-relative `tokenPath`; a radius or font slot (s222-m01) names a `token` in the base file. */
type BridgeEntry = { slot: string; tokenPath?: string; token?: string };
const bridge = SEMANTIC_BRIDGE as readonly BridgeEntry[];
const focusSlots = bridge
  .map((entry) => entry.slot)
  .filter((slot) => slot.startsWith('--theme-focus-'))
  .sort();

interface SlotContract {
  readonly slots: string[];
  readonly focusValues: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** memo SS3 D9 — the value-bearing selector for a cell. */
function selectorFor(brand: Brand, theme: Theme): string {
  return `[data-brand='${brand}'][data-theme='${theme}']`;
}

/** Read one `$value` out of a brand document by dotted path. */
function valueAt(doc: unknown, dotted: string): string | undefined {
  let node: unknown = doc;
  for (const segment of dotted.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  if (node && typeof node === 'object' && '$value' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>).$value);
  }
  return undefined;
}

/** `brand/theme` -> (slot -> the value that brand's source file declares). */
function expectationTable(): Map<string, Map<string, string>> {
  const table = new Map<string, Map<string, string>>();
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const doc = JSON.parse(fs.readFileSync(path.join(BRAND_ROOT, brand, `${theme}.json`), 'utf8'));
      const base = JSON.parse(fs.readFileSync(path.join(BRAND_ROOT, brand, 'base.json'), 'utf8'));
      const cell = new Map<string, string>();
      for (const { slot, tokenPath, token } of bridge) {
        // A brand's radius and font are the same in each of its themes, so every cell reads them from its base file.
        const value = token ? valueAt(base, token.replace('{brand}', brand)) : valueAt(doc, `color.brand.${brand}.${tokenPath}`);
        if (value !== undefined) cell.set(slot, value);
      }
      table.set(`${brand}/${theme}`, cell);
    }
  }
  return table;
}

/** Comments stripped BEFORE splitting — $description text contains colons ("≥4.5:1"). */
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

function findFocusContractMismatches(table: Table, contract: SlotContract): string[] {
  const mismatches: string[] = [];
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const cell = `${brand}/${theme}`;
      const pinned = contract.focusValues[cell];
      if (!pinned) {
        mismatches.push(`${cell}: missing focusValues cell`);
        continue;
      }
      const pinnedSlots = Object.keys(pinned).sort();
      if (JSON.stringify(pinnedSlots) !== JSON.stringify(focusSlots)) {
        mismatches.push(`${cell}: focus slot set is [${pinnedSlots.join(', ')}]`);
        continue;
      }
      for (const slot of focusSlots) {
        const got = table.get(cell)?.get(slot);
        if (got !== pinned[slot]) {
          mismatches.push(`${cell} ${slot}: expected "${pinned[slot]}", got "${got ?? '<absent>'}"`);
        }
      }
    }
  }
  return mismatches;
}

function findWrongSlots(blocks: Blocks, table: Table, brand: Brand, theme: Theme): string[] {
  const expected = table.get(`${brand}/${theme}`)!;
  const declared = blocks.get(selectorFor(brand, theme));
  if (!declared) return [`no bridge block for ${selectorFor(brand, theme)}`];
  const wrong: string[] = [];
  for (const [slot, want] of expected) {
    const got = declared.get(slot);
    if (got !== want) wrong.push(`${slot}: expected "${want}", got "${got ?? '<absent>'}"`);
  }
  return wrong;
}

function findCrossCellLeaks(blocks: Blocks, table: Table): string[] {
  const leaks: string[] = [];
  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      const declared = blocks.get(selectorFor(brand, theme));
      if (!declared) continue;
      const own = table.get(`${brand}/${theme}`)!;
      for (const otherBrand of BRANDS) {
        for (const otherTheme of THEMES) {
          if (otherBrand === brand && otherTheme === theme) continue;
          const other = table.get(`${otherBrand}/${otherTheme}`)!;
          for (const [slot, otherValue] of other) {
            const ownValue = own.get(slot);
            // Only discriminating where the two cells genuinely disagree.
            if (ownValue === undefined || ownValue === otherValue) continue;
            if (declared.get(slot) === otherValue) {
              leaks.push(
                `${selectorFor(brand, theme)} ${slot} carries ${otherBrand}/${otherTheme}'s value "${otherValue}" (should be "${ownValue}")`,
              );
            }
          }
        }
      }
    }
  }
  return leaks;
}

describe('s167 m02 — the brand→semantic bridge in the emitted CSS artifact', () => {
  const css = fs.readFileSync(TOKENS_CSS, 'utf8');
  const blocks = parseCssBlocks(css);
  const table = expectationTable();
  const contract = JSON.parse(fs.readFileSync(SLOT_CONTRACT, 'utf8')) as SlotContract;

  it('the authored map accounts for every slot in the frozen contract with no recorded gaps', () => {
    // s168 m05 RE-POINTED THIS, and it had to happen before brand.css was touched.
    // brand.css was the hand-authored copy this bridge replaces, so its slot NAMES were
    // the contract, and this test read them straight out of the file. m05 stripped the 38
    // bridged slots from it; s178 bridged the final 3 focus slots and retired the file.
    // It can no longer supply the list, so the 41-slot contract remains frozen here.
    //
    // The list is therefore FROZEN in a fixture, captured from brand.css immediately
    // before the reduction. It is no longer self-updating, which is the trade: adding a
    // slot to the bridge now requires adding it to the fixture too. That is a deliberate
    // act rather than silence, and it is the property this test existed to protect.
    // s206-m01: + the four accent status slots, added to the fixture and the bridge together (dark and hc painted
    // the light accent chip without them).
    const declaredSlots = new Set(contract.slots);
    expect(declaredSlots.size).toBe(73);

    expect(UNBRIDGED_SLOTS, 'focus has a real token source; no consumer slot remains unbridged').toEqual([]);
    const covered = new Set(bridge.map((entry) => entry.slot));
    const unaccounted = [...declaredSlots].filter((s) => !covered.has(s));
    expect(unaccounted, `contract slots absent from the bridge: ${unaccounted.join(', ')}`).toEqual([]);

    // ...and nothing in the map that the contract does not actually name.
    const phantom = bridge.map((e) => e.slot).filter((s) => !declaredSlots.has(s));
    expect(phantom, `mapped slots absent from the frozen contract: ${phantom.join(', ')}`).toEqual([]);
    expect(bridge).toHaveLength(73);
  });

  // s221-m02/m03 (#2482 ruling 3): in hc the focus ring and focus text are CanvasText on Canvas (they were Highlight and
  // HighlightText, which lose contrast outside forced colours); the frozen contract's A/hc and B/hc cells follow.
  it('the 18 ratified focus cells equal the independent source contract', () => {
    expect(Object.keys(contract.focusValues).sort()).toEqual([
      'A/base',
      'A/dark',
      'A/hc',
      'B/base',
      'B/dark',
      'B/hc',
    ]);
    expect(focusSlots).toEqual([
      '--theme-focus-ring-inner',
      '--theme-focus-ring-outer',
      '--theme-focus-text',
    ]);
    expect(
      findFocusContractMismatches(table, contract),
      'the ratified focus token values changed; regenerate CSS only after reconciling the source contract',
    ).toEqual([]);
  });

  it('the focus contract is discriminating against a reverted branded-light token', () => {
    const seeded = new Map([...table].map(([cell, values]) => [cell, new Map(values)]));
    seeded.get('A/base')!.set('--theme-focus-text', 'var(--ref-color-primary-600)');
    expect(findFocusContractMismatches(seeded, contract).join('\n')).toContain(
      'A/base --theme-focus-text',
    );
    expect(findFocusContractMismatches(table, contract)).toEqual([]);
  });

  it('emits a bridge block for every one of the six cells', () => {
    const missing: string[] = [];
    for (const brand of BRANDS) {
      for (const theme of THEMES) {
        const declared = blocks.get(selectorFor(brand, theme));
        if (!declared) missing.push(selectorFor(brand, theme));
        else if (![...declared.keys()].some((k) => k.startsWith('--theme-'))) {
          missing.push(`${selectorFor(brand, theme)} (block present but carries no --theme-* slot)`);
        }
      }
    }
    expect(missing, `missing bridge blocks: ${missing.join(', ')}`).toEqual([]);
  });

  it("the base row also matches the MCP theme vocabulary ('light', not just 'base')", () => {
    // normalizeTheme defaults to 'light' at the MCP boundary while the token tree spells
    // it 'base'. A matrix keyed only on 'base' would match zero rendered documents while
    // a file-text oracle stayed green (memo SS3 D9).
    for (const brand of BRANDS) {
      const lightBlock = blocks.get(`[data-brand='${brand}'][data-theme='light']`);
      expect(lightBlock, `no [data-brand='${brand}'][data-theme='light'] block`).toBeDefined();
      const baseExpected = table.get(`${brand}/base`)!;
      for (const [slot, want] of baseExpected) {
        expect(lightBlock!.get(slot), `${brand} light ${slot}`).toBe(want);
      }
    }
  });

  for (const brand of BRANDS) {
    for (const theme of THEMES) {
      it(`${brand}/${theme}: every bridged slot carries THIS cell's brand value`, () => {
        expect(table.get(`${brand}/${theme}`)!.size).toBe(73);
        const wrong = findWrongSlots(blocks, table, brand, theme);
        expect(wrong, `${brand}/${theme} bridge is wrong:\n  ${wrong.join('\n  ')}`).toEqual([]);
      });
    }
  }

  it('no cell carries another cell\'s value (cross-cell control)', () => {
    const leaks = findCrossCellLeaks(blocks, table);
    expect(leaks, `cross-cell leakage:\n  ${leaks.join('\n  ')}`).toEqual([]);
  });

  it('the cross-cell control is discriminating (seeded leak)', () => {
    const slot = '--theme-surface-canvas';
    const aBase = table.get('A/base')!.get(slot);
    const aDark = table.get('A/dark')!.get(slot);
    // s168 m03 RE-ANCHORED. These were hard-pinned literals ('oklch(0.967 0.03 86)' and
    // 'oklch(0.14 0.008 200)'); the palette truth-up moved A/dark to orange and reddened
    // this control for a reason that had nothing to do with what it tests. A pin that must
    // be hand-edited whenever a token changes is a maintenance trap — and hand-editing it
    // is indistinguishable from silencing it. The seed needs exactly one property: the two
    // cells must resolve and must genuinely disagree. Derive that; assert nothing more.
    expect(aBase, `${slot} missing from A/base`).toBeDefined();
    expect(aDark, `${slot} missing from A/dark`).toBeDefined();
    expect(aBase).not.toBe(aDark);

    const seeded = parseCssBlocks(`${css}\n${selectorFor('A', 'base')} { ${slot}: ${aDark}; }\n`);
    const leaks = findCrossCellLeaks(seeded, table);
    expect(leaks.join('\n')).toContain(slot);
    expect(leaks.some((l) => l.includes("A/dark's value"))).toBe(true);
    expect(findWrongSlots(seeded, table, 'A', 'base').join('\n')).toContain(slot);

    // Control of the control: unseeded is clean, so the seed is what moved it.
    expect(findCrossCellLeaks(blocks, table)).toEqual([]);
  });

  /**
   * The point of the whole mission. Before s167 every `--theme-*` slot resolved to the
   * neutral reference palette and NO semantic declaration referenced a brand var, so
   * emitting `[data-brand]` blocks over the brand namespace alone would have changed
   * zero pixels. If a bridge block merely restated the `:root` value it would be exactly
   * that no-op wearing a selector.
   */
  it('the bridge is not a no-op: cells genuinely diverge from the :root default', () => {
    const root = blocks.get(':root')!;
    expect(root).toBeDefined();

    for (const brand of BRANDS) {
      for (const theme of THEMES) {
        const declared = blocks.get(selectorFor(brand, theme))!;
        const matching = bridge.filter(({ slot }) => {
          const rootValue = root.get(slot);
          return rootValue !== undefined && declared.get(slot) === rootValue;
        }).map(({ slot }) => slot).sort();
        // s222-m01 (#2502 ruling 3): the unbranded :root holds brand A's light roles, and brand B shares A's neutral
        // structure, so a cell may equal :root exactly where its own source value equals the root's. Anywhere else a
        // shared value would be the bridge restating :root instead of this cell's brand.
        const own = table.get(`${brand}/${theme}`)!;
        const shared = bridge.map(({ slot }) => slot).filter((slot) => own.get(slot) === root.get(slot)).sort();
        expect(matching, `${brand}/${theme} unexpected shared defaults`).toEqual(shared);
        if (!(brand === 'A' && theme === 'base')) expect(bridge.length - matching.length).toBeGreaterThan(0);

      }
    }

    // And the :root default is brand A's light theme (s222-m01: theme0 holds A's recipe roles as values).
    expect(root.get('--theme-surface-canvas')).toBe(table.get('A/base')!.get('--theme-surface-canvas'));
  });
});
