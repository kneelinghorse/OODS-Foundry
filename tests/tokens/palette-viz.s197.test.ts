import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generatePaletteFiles, loadPaletteSeeds, writePaletteFiles } from '../../scripts/tokens/generate-palette.js';
import { runVizScaleValidation } from '../../scripts/tokens/validate-viz-scales.js';
import { evaluateCategoricalRoleA, evaluateCategoricalRoleC } from '../../packages/mcp-server/src/tools/certify-contrast.js';
import { normaliseColor } from '@oods/a11y-tools';
import Color from 'colorjs.io';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
describe('s197 chart palette is scoped, coherent and distinguishable', () => {
  // s222-m02 (#2502 ruling 12): each brand's charts take its own recipe's palette. The first series is the accent's step 9;
  // the rest are hues 60° apart from it; certify's role C (3:1 on the brand's canvas) and the s197 role-A target
  // (CIEDE2000 12, min over normal vision and three dichromacies) hold in light and dark for every brand.
  it('every brand\'s six series follow its recipe and clear the certification targets on its own canvas', async () => {
    const seeds = await loadPaletteSeeds(), files = generatePaletteFiles(seeds);
    const { CATEGORICAL_OFFSETS, hueScale, css } = await import('../../packages/tokens/src/palette/recipe.mjs');
    for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark'] as const) {
      const file = JSON.parse(files.get(`packages/tokens/src/tokens/brands/${brand}/${theme === 'light' ? 'base' : 'dark'}.json`)!);
      const values = Object.values(file.viz.scale.categorical).map((leaf: any) => leaf.$value as string);
      expect(values).toHaveLength(6);
      const paints = values.map(value => normaliseColor(value));
      expect(evaluateCategoricalRoleA(paints).minimumDeltaE, `${brand}/${theme}`).toBeGreaterThanOrEqual(12);
      expect(values[0], `${brand}/${theme} first series`).toBe(css(hueScale(seeds.brands[brand].accentHue, theme)[8]));
      expect(file.viz.mark.single.$value).toBe(values[0]);
      const canvas = normaliseColor(file.color.brand[brand].surface.canvas.$value);
      for (let i = 0; i < values.length; i++) {
        const [, c, h] = new Color(values[i]).to('oklch').coords.map(Number);
        expect(c).toBeGreaterThanOrEqual(.045);
        expect(h, `${brand}/${theme} slot ${i + 1}`).toBeCloseTo((seeds.brands[brand].accentHue + CATEGORICAL_OFFSETS[i]) % 360, 6);
        expect(evaluateCategoricalRoleC([paints[i]], {}, canvas).verdict, `${brand}/${theme} slot ${i + 1}`).toBe('pass');
      }
    }
    // Brands differ: A and B share a neutral, so without the recipe their charts were the same.
    const first = (brand: string) => JSON.parse(files.get(`packages/tokens/src/tokens/brands/${brand}/base.json`)!).viz.scale.categorical['01'].$value;
    expect(first('A')).not.toBe(first('B'));
  });
  it('validates dark shape as well as coverage and catches a dark-only asymmetry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'oods-s197-viz-')); dirs.push(root);
    await writePaletteFiles(generatePaletteFiles(await loadPaletteSeeds()), root);
    const source = path.join(root, 'packages/tokens/src/viz-scales.json');
    expect((await runVizScaleValidation(source)).filter(row => !row.ok)).toEqual([]);
    const dark = path.join(root, 'packages/tokens/src/tokens/brands/B/dark.json');
    const doc = JSON.parse(await readFile(dark, 'utf8'));
    doc.viz.scale.diverging['pos-03'].$value = 'oklch(.5 .01 17.5)';
    await writeFile(dark, JSON.stringify(doc));
    expect((await runVizScaleValidation(source)).some(row => !row.ok && row.scope.startsWith('B/dark/diverging/chroma-'))).toBe(true);
    delete doc.viz.scale.sequential['03']; await writeFile(dark, JSON.stringify(doc));
    expect((await runVizScaleValidation(source)).some(row => !row.ok && row.type === 'dark-coverage' && row.scope.includes('B/dark'))).toBe(true);
  });
  it('names no chart hue in the seed file: a brand\'s charts come from its recipe (s222-m02)', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'oods-s197-seeds-')); dirs.push(root);
    const seeds = await loadPaletteSeeds();
    const source = path.join(root, 'seeds.json');
    await writeFile(source, JSON.stringify({ ...seeds, viz: { categorical: { hueOffset: 17.5 } } }));
    await expect(loadPaletteSeeds(source)).rejects.toThrow('Invalid palette seeds');
  });
});
