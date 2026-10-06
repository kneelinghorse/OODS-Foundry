import { describe, expect, it } from 'vitest';
import Color from 'colorjs.io';
import { generatePaletteFiles, loadPaletteSeeds } from '../../scripts/tokens/generate-palette.js';
import { isInSrgb } from '../../scripts/tokens/palette-checks.js';
import { tokenKeys } from '../../scripts/tokens/semantic-key-contract.js';
import frozen from './fixtures/semantic-keys.s222.json';

function leaves(node: any): string[] {
  if (node?.$type === 'color') return [node.$value];
  return node && typeof node === 'object' ? Object.values(node).flatMap(leaves) : [];
}
describe('dark palette preserves the hierarchy and semantic contract', () => {
  // s222-m01 (#2502 rulings 2 and 4): dark surfaces are the neutral scale's steps 1-3 (canvas, raised panel, component
  // background), so each raised layer is lighter than the one under it, on the recipe's neutral hue and tint.
  it('climbs from the canvas through raised to subtle on the neutral, for both brands', async () => {
    const seeds = await loadPaletteSeeds();
    const files = generatePaletteFiles(seeds, ['dark']);
    for (const brand of ['A', 'B']) {
      const roles = JSON.parse(files.get(`packages/tokens/src/tokens/brands/${brand}/dark.json`)!).color.brand[brand];
      const [backdrop, canvas, raised, subtle] = ['backdrop', 'canvas', 'raised', 'subtle'].map(role =>
        new Color(roles.surface[role].$value).to('oklch').coords.map(Number));
      expect(backdrop[0]).toBeLessThanOrEqual(canvas[0]);
      expect(raised[0] - canvas[0]).toBeGreaterThan(.04);
      expect(subtle[0] - raised[0]).toBeGreaterThan(.04);
      for (const [, c] of [backdrop, canvas, raised, subtle]) expect(c).toBeLessThanOrEqual(seeds.brands[brand].neutralChroma + 1e-6);
    }
  });
  it('keeps global and brand roles in gamut, with one hue per status and less accent chroma', async () => {
    const seeds = await loadPaletteSeeds();
    const files = generatePaletteFiles(seeds);
    for (const [name, bytes] of files) {
      if (!name.includes('/dark')) continue;
      const tree = JSON.parse(bytes);
      if (tree.viz) delete tree.viz; // m04 owns chart palette generation and coverage.
      for (const color of leaves(tree)) expect(isInSrgb(color), `${name}: ${color}`).toBe(true);
    }
    // s222-m01 (#2502 ruling 2): status families follow Radix's calibrated steps, which turn their hue a little across the
    // scale (blue's text steps lean further from cyan than its tints), so each family stays near its hue, not on it.
    const { DEFAULT_STATUS } = await import('../../packages/tokens/src/palette/recipe.mjs');
    for (const brand of ['A', 'B'] as const) {
      const recipe = seeds.brands[brand];
      const dark = JSON.parse(files.get(`packages/tokens/src/tokens/brands/${brand}/dark.json`)!).color.brand[brand];
      const light = JSON.parse(files.get(`packages/tokens/src/tokens/brands/${brand}/base.json`)!).color.brand[brand];
      for (const [family, roles] of Object.entries(dark.status)) {
        if (family === 'neutral') continue;
        const hue = family === 'accent' ? recipe.accentHue : (DEFAULT_STATUS as Record<string, { hue: number }>)[family].hue;
        for (const value of leaves(roles)) {
          const [, c, h] = new Color(value).to('oklch').coords.map(Number);
          if (c > .03) expect(Math.abs(((h - hue + 540) % 360) - 180), `${brand} ${family} ${value}`).toBeLessThan(30);
        }
      }
      const d = new Color(dark.text.accent.$value).to('oklch').coords.map(Number);
      const l = new Color(light.text.accent.$value).to('oklch').coords.map(Number);
      expect(d[0]).toBeGreaterThan(l[0]); expect(d[1]).toBeLessThan(l[1]);
    }
  });
  it('generates all four shared dark color trees without dropping or inventing semantic names', async () => {
    const files = generatePaletteFiles(await loadPaletteSeeds(), ['dark']);
    for (const [name, bytes] of files) {
      if (!name.includes('/themes/')) continue;
      expect(tokenKeys(JSON.parse(bytes))).toEqual((frozen as Record<string, string[]>)[name]);
    }
    const focus = JSON.parse(files.get('packages/tokens/src/tokens/themes/dark/focus.json')!)['theme-dark'].focus;
    expect(focus.width).toEqual({ $type: 'dimension', $value: '2px', $description: 'Focus ring width, the same in every theme.' });
  });
});
