import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DtcgToken } from '../../src/tooling/tokens/dtcg.js';
import { checkPalette, PALETTE_CHECK_TYPES } from '../../scripts/tokens/palette-checks.js';
import { loadGuardrails } from '../../scripts/tokens/color-guardrails.js';
import { collectVizScaleCollections, validateVizScaleCollections } from '../../scripts/tokens/validate-viz-scales.js';

const token = (key: string, value: string): DtcgToken => ({ path: key.split('.'), value, type: 'color', source: 'synthetic' });
const ramp = (values = ['oklch(0.9 0.01 265)', 'oklch(0.6 0.05 265)', 'oklch(0.3 0.01 265)']) =>
  values.map((value, i) => token(`ref.color.primary.${i}`, value));
const passes = (checks: { ok: boolean }[]) => checks.every((check) => check.ok);

describe('palette coherence guardrails reject plausible but incoherent color sets', () => {
  it('declares all six new check types in the CSV while retaining the six original checks', async () => {
    const rows = await loadGuardrails(path.resolve('tools/a11y/guardrails/relative-color.csv'));
    expect(rows.filter((row) => row.checkType === 'relative-color')).toHaveLength(6);
    for (const type of PALETTE_CHECK_TYPES) expect(rows.some((row) => row.checkType === type), type).toBe(true);
  });
  it('rejects reversed or flat lightness steps', () => {
    expect(passes(checkPalette('ramp-monotonicity', 'test', ramp()))).toBe(true);
    for (const value of ['oklch(0.95 0.05 265)', 'oklch(0.9 0.05 265)']) {
      const colors = ramp(); colors[1].value = value;
      expect(passes(checkPalette('ramp-monotonicity', 'test', colors))).toBe(false);
    }
  });
  it('checks hue circularly and rejects a drifting family', () => {
    const colors = ramp(['oklch(0.9 0.01 359.8)', 'oklch(0.6 0.05 0.2)', 'oklch(0.3 0.01 0)']);
    expect(passes(checkPalette('family-hue', 'test', colors))).toBe(true);
    colors[1].value = 'oklch(0.6 0.05 5)';
    expect(passes(checkPalette('family-hue', 'test', colors))).toBe(false);
  });
  // s222-m01 (#2502 ruling 3): a recipe picks its neutral's hue, so a warm neutral is a neutral; a saturated one is not.
  it('accepts a neutral of any single hue at low chroma, and rejects a saturated or drifting one', () => {
    const colors = ramp(['oklch(0.9 0.004 265)', 'oklch(0.6 0.012 265)', 'oklch(0.3 0.006 265)']); colors.unshift(token('ref.color.neutral.0', 'oklch(1 0 0)'));
    expect(passes(checkPalette('neutral-hue', 'test', colors))).toBe(true);
    expect(passes(checkPalette('neutral-hue', 'test', colors.map((t) => ({ ...t, value: String(t.value).replace('265', '60') }))))).toBe(true);
    expect(passes(checkPalette('neutral-hue', 'test', ramp()))).toBe(false);
    const drifting = ramp(['oklch(0.9 0.004 265)', 'oklch(0.6 0.012 60)', 'oklch(0.3 0.006 265)']);
    expect(passes(checkPalette('neutral-hue', 'test', drifting))).toBe(false);
  });
  it.each([
    [0.01, .03, .05], [.05, .03, .01], [.01, .04, .02, .05, .01], [.01, .05, .02, .04, .01], [.02, .02, .02],
  ])('rejects endpoint peaks, dips, rebounds, and flat chroma (%j)', (...cs) => {
    const colors = cs.map((c, i) => token(`ref.color.primary.${i}`, `oklch(${.9 - i * .1} ${c} 265)`));
    expect(passes(checkPalette('chroma-curve', 'test', ramp()))).toBe(true);
    expect(passes(checkPalette('chroma-curve', 'test', colors))).toBe(false);
  });
  it('rejects out-of-gamut input before a serializer can hide it', () => {
    expect(passes(checkPalette('gamut', 'test', ramp()))).toBe(true);
    expect(passes(checkPalette('gamut', 'test', [token('viz.scale.sequential.09', 'oklch(0.14 0.15 250)')]))).toBe(false);
  });
  it('requires each explicit dark override and fails closed for empty requirements', () => {
    const colors = ramp(); const keys = colors.map((t) => t.path.join('.'));
    expect(passes(checkPalette('dark-coverage', 'test', colors, colors, keys))).toBe(true);
    expect(checkPalette('dark-coverage', 'test', colors.slice(1), colors, keys).filter((r) => !r.ok)).toHaveLength(1);
    expect(passes(checkPalette('dark-coverage', 'test', colors))).toBe(false);
    colors[0].type = 'dimension';
    expect(passes(checkPalette('dark-coverage', 'test', colors, colors, keys))).toBe(false);
    colors[0].type = 'color'; colors[0].value = '{missing.light.fallback}';
    expect(passes(checkPalette('dark-coverage', 'test', colors, colors, keys))).toBe(false);
  });
  it('does not turn missing matches, alias cycles, or unresolved references into a green check', () => {
    for (const colors of [[], [token('a', '{b}')], [token('a', '{b}'), token('b', '{a}')]]) {
      expect(passes(checkPalette('gamut', 'test', colors))).toBe(false);
    }
    const colors = [token('a', '{b}'), token('b', 'oklch(0.5 0.01 265)')];
    expect(passes(checkPalette('gamut', 'test', colors))).toBe(true);
  });
  it('wires gamut, sequential chroma and diverging chroma symmetry into viz validation', () => {
    const tokens = Array.from({ length: 9 }, (_, i) => token(`viz.scale.sequential.${String(i + 1).padStart(2, '0')}`, `oklch(${.95 - i * .1} ${i === 8 ? .15 : .03} 250)`));
    tokens.push(token('viz.scale.diverging.neg-01', 'oklch(0.8 0.02 200)'), token('viz.scale.diverging.pos-01', 'oklch(0.8 0.05 25)'));
    const failed = validateVizScaleCollections(collectVizScaleCollections(tokens)).filter((r) => !r.ok);
    for (const type of ['gamut', 'chroma-curve', 'chroma-symmetry']) expect(failed.some((r) => r.type === type), type).toBe(true);
  });
});
