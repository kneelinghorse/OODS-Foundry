/**
 * s168 m03 — a brand token's `$description` must not assert a contrast ratio it misses.
 *
 * WHY THIS IS A TEST AND NOT A ONE-TIME AUDIT. Two brand tokens shipped a `$description`
 * claiming a ratio they did not meet (brand A `text.onInteractive` claimed "(4.9:1)" and
 * measured 4.2465; brand B claimed "(≥4.7:1)" and measured 3.2683). That is not a cosmetic
 * defect: the s167 drift catalogue USED those descriptions as evidence to rule the
 * generated side correct, so a false ratio in the token source propagated into a review
 * conclusion. Nothing prevented it recurring. This does.
 *
 * MEASURED THROUGH THE REPO'S OWN EVALUATOR PATH (standing rule 13). `normaliseColor`
 * converts oklch through colorjs.io to sRGB hex, which CLIPS out-of-gamut values before
 * `contrastRatio` runs. The clipped number is the number the guardrail enforces, so it is
 * the number a description must be true against — a more faithful measurement taken in
 * oklch directly would be the WRONG number here.
 *
 * COMPLETENESS, not sampling: every numeric ratio claim in all six brand files must appear
 * in PAIR_FOR_CLAIM. A claim with no mapping FAILS rather than being skipped, so a new
 * token cannot quietly arrive with an ungraded assertion.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseColor, contrastRatio } from '@oods/a11y-tools';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const BRAND_ROOT = path.resolve(moduleDir, '../../packages/tokens/src/tokens/brands');

const BRANDS = ['A', 'B'] as const;
const THEMES = ['base', 'dark', 'hc'] as const;

type Leaf = { value: string; description: string };

function loadCell(brand: string, theme: string): Map<string, Leaf> {
  const doc = JSON.parse(readFileSync(path.join(BRAND_ROOT, brand, `${theme}.json`), 'utf8'));
  const out = new Map<string, Leaf>();
  const walk = (node: unknown, trail: string[]): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, any>;
    if ('$value' in obj) {
      out.set(trail.join('.').replace(/^color\.brand\.[AB]\./, ''), {
        value: String(obj.$value),
        description: String(obj.$description ?? ''),
      });
      return;
    }
    for (const [key, child] of Object.entries(obj)) walk(child, trail.concat(key));
  };
  walk(doc, []);
  return out;
}

/**
 * The pair each token's ratio claim is ABOUT. A description says "≥4.5:1 on subtle
 * surfaces" — this is what "on subtle surfaces" means, made explicit and checkable.
 */
const PAIR_FOR_CLAIM: Record<string, { foreground: string; background: string }> = {
  'surface.disabled': { foreground: 'text.disabled', background: 'surface.disabled' },
  'text.disabled': { foreground: 'text.disabled', background: 'surface.disabled' },
  'surface.interactive.primary.default': {
    foreground: 'text.onInteractive',
    background: 'surface.interactive.primary.default',
  },
  'surface.interactive.primary.hover': {
    foreground: 'text.onInteractive',
    background: 'surface.interactive.primary.hover',
  },
  'surface.interactive.primary.pressed': {
    foreground: 'text.onInteractive',
    background: 'surface.interactive.primary.pressed',
  },
  'focus.ring.outer': { foreground: 'focus.ring.outer', background: 'surface.canvas' },
  // s222-m01 (#2502 ruling 7): a control's border promises 3:1 on the canvas (the raised part is graded by brand-rules).
  'border.interactive': { foreground: 'border.interactive', background: 'surface.canvas' },
  'text.primary': { foreground: 'text.primary', background: 'surface.canvas' },
  'text.muted': { foreground: 'text.muted', background: 'surface.subtle' },
  'text.accent': { foreground: 'text.accent', background: 'surface.canvas' },
  'text.onInteractive': {
    foreground: 'text.onInteractive',
    background: 'surface.interactive.primary.default',
  },
  'status.success.text': { foreground: 'status.success.text', background: 'status.success.surface' },
  'status.success.icon': { foreground: 'status.success.icon', background: 'surface.subtle' },
  'status.warning.icon': { foreground: 'status.warning.icon', background: 'surface.subtle' },
  'viz.scale.categorical.04': { foreground: 'viz.scale.categorical.04', background: 'surface.canvas' },
  'viz.scale.categorical.05': { foreground: 'viz.scale.categorical.05', background: 'surface.canvas' },
};

/** Any `N:1` in the prose, with the comparator that governs how it must be read. */
const RATIO_CLAIM = /(≥|>=|at least|below|under)?\s*([0-9]+(?:\.[0-9]+)?)\s*:\s*1/gi;

type Claim = { cell: string; token: string; comparator: string; ratio: number; description: string };

function claimsIn(cell: string, tokens: Map<string, Leaf>): Claim[] {
  const claims: Claim[] = [];
  for (const [token, leaf] of tokens) {
    // "WCAG 1.4.3" and similar are section numbers, not ratios — the `:1` suffix is what
    // makes a number a contrast claim.
    for (const match of leaf.description.matchAll(RATIO_CLAIM)) {
      claims.push({
        cell,
        token,
        comparator: (match[1] ?? '').toLowerCase().trim(),
        ratio: Number(match[2]),
        description: leaf.description,
      });
    }
  }
  return claims;
}

function measure(
  tokens: Map<string, Leaf>,
  foreground: string,
  background: string,
  backgroundTokens: Map<string, Leaf> = tokens,
): number | null {
  const fg = tokens.get(foreground);
  const bg = backgroundTokens.get(background);
  if (!fg || !bg) return null;
  try {
    return contrastRatio(normaliseColor(fg.value, foreground), normaliseColor(bg.value, background));
  } catch {
    // hc cells resolve to CSS system colours (Canvas, CanvasText, ...) and are not
    // numerically gradeable. They also carry no ratio claims — asserted below.
    return null;
  }
}

describe('brand $description ratio claims are true (s168 m03)', () => {
  const cells = BRANDS.flatMap((brand) => THEMES.map((theme) => `${brand}/${theme}`));

  it('every numeric ratio claim has a declared pair (no silent gaps)', () => {
    const unmapped: string[] = [];
    for (const cell of cells) {
      const [brand, theme] = cell.split('/');
      for (const claim of claimsIn(cell, loadCell(brand, theme))) {
        if (!PAIR_FOR_CLAIM[claim.token]) unmapped.push(`${cell} ${claim.token}`);
      }
    }
    expect(
      unmapped,
      `these tokens assert a ratio but PAIR_FOR_CLAIM does not say what pair it is about:\n  ${unmapped.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every claim measures true through the evaluator path', () => {
    const violations: string[] = [];
    let verified = 0;
    for (const cell of cells) {
      const [brand, theme] = cell.split('/');
      const tokens = loadCell(brand, theme);
      for (const claim of claimsIn(cell, tokens)) {
        const pair = PAIR_FOR_CLAIM[claim.token];
        if (!pair) continue;
        const measured = measure(tokens, pair.foreground, pair.background);
        if (measured === null) {
          violations.push(`${cell} ${claim.token}: claims ${claim.ratio}:1 but the pair is unresolvable`);
          continue;
        }
        verified += 1;
        // "below 3:1" / "under 3:1" assert the ratio is BENEATH the number — the disabled
        // pair, which WCAG 1.4.3 exempts and whose low contrast is the affordance itself.
        const inverted = claim.comparator === 'below' || claim.comparator === 'under';
        const ok = inverted ? measured < claim.ratio : measured >= claim.ratio;
        if (!ok) {
          violations.push(
            `${cell} ${claim.token}: description claims ${inverted ? 'below ' : '≥'}${claim.ratio}:1 for ` +
              `${pair.foreground} on ${pair.background}, measured ${measured.toFixed(4)}:1`,
          );
        }
      }
    }
    expect(verified, 'no claims were verified — the parser stopped matching').toBeGreaterThan(0);
    expect(violations, `false ratio claims:\n  ${violations.join('\n  ')}`).toEqual([]);
  });

  it('also verifies the raised-surface part of the Sprint 192 focus-ring claim', () => {
    // The existing claim map grades canvas. The authored sentence names both
    // surfaces, so raised must be measured too rather than passed by accident.
    for (const brand of BRANDS) {
      for (const theme of ['base', 'dark']) {
        const tokens = loadCell(brand, theme);
        expect(measure(tokens, 'focus.ring.outer', 'surface.raised'), `${brand}/${theme} focus on raised`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('also verifies the other-brand canvas named in categorical ratio claims', () => {
    // Each m05 categorical description promises both canvases, not just its own.
    // Grade each authored foreground independently so later brand divergence cannot
    // pass this promise merely because the same-brand pair still meets 3:1.
    for (const brand of BRANDS) {
      const otherBrand = brand === 'A' ? 'B' : 'A';
      for (const [theme, slot] of [['base', '05'], ['dark', '04']] as const) {
        const token = `viz.scale.categorical.${slot}`;
        expect(
          measure(loadCell(brand, theme), token, 'surface.canvas', loadCell(otherBrand, theme)),
          `${brand}/${theme} ${token} on ${otherBrand}/${theme} canvas`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('hc cells carry no numeric ratio claims, because they cannot be graded', () => {
    // Both hc cells resolve entirely to CSS system colours, so no ratio is computable and
    // any numeric assertion there would be unfalsifiable rather than merely wrong.
    for (const brand of BRANDS) {
      const tokens = loadCell(brand, 'hc');
      expect(claimsIn(`${brand}/hc`, tokens), `${brand}/hc asserts a ratio it cannot support`).toEqual([]);
      expect(measure(tokens, 'text.primary', 'surface.canvas')).toBeNull();
    }
  });
});
