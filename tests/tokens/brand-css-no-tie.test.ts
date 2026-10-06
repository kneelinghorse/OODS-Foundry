/**
 * s178 m02 — the source-order tie is retired, not merely dormant.
 *
 * `brand.css` was the hand-authored second writer for the brand-to-semantic
 * mapping. s168 removed its 38 bridged declarations but had to retain seven
 * primitive aliases, three unbridged focus slots, and a forced-colors rule.
 * s178 gives focus a real token source, re-points the only primitive consumer,
 * and relocates the forced-colors rule, so the whole legacy stylesheet can go.
 *
 * This control pins that completed state. Reintroducing the file, one of its
 * imports, an unbridged focus gap, or a legacy primitive consumer must be an
 * explicit regression rather than another import-order accident.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- build tooling, no type declarations
import {
  SEMANTIC_BRIDGE,
  UNBRIDGED_SLOTS,
} from '../../packages/tokens/scripts/brand-bridge.mjs';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BRAND_CSS = path.join(
  REPO_ROOT,
  'apps',
  'explorer',
  'src',
  'styles',
  'brand.css',
);
const TOKENS_CSS = path.join(
  REPO_ROOT,
  'packages',
  'tokens',
  'dist',
  'css',
  'tokens.css',
);
const SLOT_CONTRACT = path.join(
  __dirname,
  '__fixtures__',
  'brand-css-slot-contract.json',
);

type SlotEntry = { slot: string };
const bridge = SEMANTIC_BRIDGE as readonly SlotEntry[];
const bridgedSlots = new Set(bridge.map((entry) => entry.slot));
const unbridgedSlots = UNBRIDGED_SLOTS as readonly SlotEntry[];

/** Distinct `--theme-*` properties declared (not merely referenced). */
function declaredThemeSlots(css: string): Set<string> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(
    [...stripped.matchAll(/^\s*(--theme-[a-z0-9-]+)\s*:/gm)].map(
      (match) => match[1],
    ),
  );
}

describe('s178 m02 — brand.css is fully retired', () => {
  it('the legacy second writer no longer exists', () => {
    expect(
      fs.existsSync(BRAND_CSS),
      'brand.css returned and can re-enter the cascade',
    ).toBe(false);
  });

  // s222-m01 (#2502 rulings 3, 7 and 11): 73 slots (was 45), the new fills, control borders, solids, radius and font.
  it('the generated bridge owns the complete frozen 73-slot contract', () => {
    const contract = JSON.parse(fs.readFileSync(SLOT_CONTRACT, 'utf8')) as {
      slots: string[];
    };
    const contractSlots = new Set(contract.slots);

    expect(contractSlots.size).toBe(73);
    expect(bridge).toHaveLength(73);
    expect(
      unbridgedSlots,
      'a new unbridged slot recreates a reason for a hand-authored writer',
    ).toEqual([]);
    expect([...bridgedSlots].sort()).toEqual([...contractSlots].sort());

    const focusSlots = bridge
      .map((entry) => entry.slot)
      .filter((slot) => slot.startsWith('--theme-focus-'))
      .sort();
    expect(focusSlots).toEqual([
      '--theme-focus-ring-inner',
      '--theme-focus-ring-outer',
      '--theme-focus-text',
    ]);
  });

  it('the generated CSS declares every consumer slot', () => {
    const generated = declaredThemeSlots(fs.readFileSync(TOKENS_CSS, 'utf8'));
    const missing = [...bridgedSlots].filter((slot) => !generated.has(slot));
    expect(
      missing,
      `generated tokens.css is missing bridge slots:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the three former import/story carriers no longer name brand.css', () => {
    const carriers = [
      'apps/explorer/src/styles/index.css',
      'src/styles/globals.css',
      'apps/explorer/src/stories/BrandA.stories.tsx',
    ];

    for (const carrier of carriers) {
      const source = fs.readFileSync(path.join(REPO_ROOT, carrier), 'utf8');
      expect(
        source,
        `${carrier} still reaches the retired stylesheet`,
      ).not.toMatch(/brand\.css/);
    }
  });

  it('the forced-colors responsibility moved to hc.css for both brands', () => {
    const hcCss = fs.readFileSync(
      path.join(REPO_ROOT, 'apps', 'explorer', 'src', 'styles', 'hc.css'),
      'utf8',
    );
    expect(hcCss).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    expect(hcCss).toMatch(
      /\[data-brand=['"]A['"]\][\s\S]*\[data-brand=['"]B['"]\][\s\S]*forced-color-adjust:\s*none/,
    );
  });

  it('BrandBleed still bites through canonical generated token variables', () => {
    const canary = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'apps',
        'explorer',
        'src',
        'stories',
        '__canary__',
        'BrandBleed.canary.tsx',
      ),
      'utf8',
    );
    expect(canary).toContain('var(--oods-color-brand-b-surface-canvas)');
    expect(canary).toContain('var(--oods-color-brand-b-text-primary)');
    expect(canary).not.toMatch(/var\(--brandB-/);
  });
});
