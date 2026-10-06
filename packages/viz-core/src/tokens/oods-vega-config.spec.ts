import { describe, expect, it } from 'vitest';
import { resolveOodsVegaConfig } from './oods-vega-config.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

// The a11y-of-chrome tripwire (sprint-144 m03, memo §4). Chrome TEXT contrast is graded by
// NEITHER certify pillar (contrast = series marks only; the equivalence engine reads no
// color), so accessible chrome is a BY-CONSTRUCTION guarantee this arc must self-enforce.
// This asserts every baked chrome text color clears WCAG 1.4.3 (≥ 4.5:1) on the baked
// background. It imports the SOURCE resolver directly (relative, not the @oods/viz-core
// barrel) so a token-choice regression — e.g. repointing axis labels at text-muted (lower emphasis) or text-disabled (fail) — fails HERE at the viz-core unit level, before
// any dist rebuild.
//
// Self-contained WCAG contrast: the check is deliberately INDEPENDENT of certify's grader
// (@oods/a11y-tools) because it enforces a surface certify does not grade. The standard
// sRGB relative-luminance formula below reproduces the memo's verified ratios exactly
// (text-primary 16.16, text-neutral 8.11, current scoped colors).

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = channels.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const WCAG_AA_TEXT = 4.5;
// Chrome text keeps the higher-emphasis primary/neutral roles; muted and disabled
// remain distinct even when a palette revision improves their canvas contrast.
// s222-m01 (#2502 ruling 4): the neutral scale's muted text (#707070) and disabled text (step 9).
const TEXT_MUTED = '#707070';
const TEXT_DISABLED = '#8D8D8D';

// A minimal cartesian IR — chrome is spec-independent (no config.tokens override), so any
// valid spec resolves the same default chrome. `as never` matches the sibling adapter specs.
const CHROME_SPEC = { config: {} } as unknown as NormalizedVizSpec;

describe('resolveOodsVegaConfig — a11y-of-chrome tripwire (s144 m03, memo §4)', () => {
  const config = resolveOodsVegaConfig(CHROME_SPEC);
  const bg = config.background;

  // Every baked chrome TEXT surface, paired with its baked color.
  const textSurfaces: ReadonlyArray<readonly [string, string]> = [
    ['title.color', config.title.color],
    ['axis.titleColor', config.axis.titleColor],
    ['axis.labelColor', config.axis.labelColor],
    ['legend.titleColor', config.legend.titleColor],
    ['legend.labelColor', config.legend.labelColor],
  ];

  // s222-m01 (#2502 ruling 4): the neutral-first canvas, the neutral's step 1 (it was #F9FAFC).
  it('the baked background is the OODS surface-canvas (#FFFFFF) contrast is graded against', () => {
    expect(bg).toBe('#FFFFFF');
  });

  it.each(textSurfaces)('%s clears WCAG AA (≥ 4.5:1) on the baked background', (_name, color) => {
    expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('no chrome text token is parked on the muted or disabled emphasis roles', () => {
    for (const [, color] of textSurfaces) {
      expect(color).not.toBe(TEXT_MUTED);
      expect(color).not.toBe(TEXT_DISABLED);
    }
  });

  // s222-m01 (#2502 ruling 4): the neutral's step 12 and step 11 on its step 1 (they were 16.16 and 8.11 on #F9FAFC).
  it('reproduces the scoped light/A ratios (s222-m01, superseding s197) (text-primary 19.80, text-neutral 7.81)', () => {
    // Pins the specific Derek-locked token choices: titles on text-primary, labels on
    // text-neutral. A regression to a lower-contrast token trips both this and the ≥4.5 gate.
    expect(config.title.color).toBe('#0A0A0A');
    expect(config.axis.labelColor).toBe('#525252');
    expect(contrastRatio('#0A0A0A', bg)).toBeCloseTo(19.8, 1);
    expect(contrastRatio('#525252', bg)).toBeCloseTo(7.81, 1);
  });
});

// F6c rect-only Y-grid guard (s149, memo §2). The horizontal chrome gridlines
// (#E9ECEF) stripe through the CELLS of a MarkRect heatmap because its y-scale is a
// band of dimensions, not a measure. So resolveOodsVegaConfig drops axisY.grid ONLY
// when every mark is a MarkRect; any non-rect mark (or a mixed spec) keeps the default
// horizontal grid. Marks-only specs — the resolver reads nothing else — so these
// minimal IRs exercise the predicate directly at the viz-core unit level.
describe('resolveOodsVegaConfig — F6c rect-only axisY.grid (s149, memo §2)', () => {
  const specWithMarks = (traits: readonly string[]): NormalizedVizSpec =>
    ({ config: {}, marks: traits.map((trait) => ({ trait })) }) as unknown as NormalizedVizSpec;

  it('a rect-only spec (heatmap) suppresses the Y grid so it does not stripe the cells', () => {
    expect(resolveOodsVegaConfig(specWithMarks(['MarkRect'])).axisY.grid).toBe(false);
  });

  it('X grid stays off regardless (horizontal-only rule is unchanged by F6c)', () => {
    expect(resolveOodsVegaConfig(specWithMarks(['MarkRect'])).axisX.grid).toBe(false);
  });

  it('a bar spec keeps the default horizontal Y grid (rect-only tripwire)', () => {
    expect(resolveOodsVegaConfig(specWithMarks(['MarkBar'])).axisY.grid).toBe(true);
  });

  it('a mixed rect+line spec keeps the Y grid (.every, not .some)', () => {
    expect(resolveOodsVegaConfig(specWithMarks(['MarkRect', 'MarkLine'])).axisY.grid).toBe(true);
  });
});
