import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { generatePaletteFiles, loadPaletteSeeds, writePaletteFiles, paletteColor } from '../../scripts/tokens/generate-palette.js';
import { checkPalette, isInSrgb, selectRamp } from '../../scripts/tokens/palette-checks.js';
import { loadDtcgTokens } from '../../src/tooling/tokens/dtcg.js';
import { tokenKeys } from '../../scripts/tokens/semantic-key-contract.js';

const temps: string[] = [];
async function scratch() { const dir = await mkdtemp(path.join(tmpdir(), 's197-palette-')); temps.push(dir); return dir; }
afterEach(async () => { await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('seed-generated palette boundary', () => {
  it('reproduces every byte, detects seed drift, and never repairs files in check mode', async () => {
    const seeds = await loadPaletteSeeds();
    const root = await scratch();
    const original = generatePaletteFiles(seeds);
    // s222-m01: 3 reference files, 6 brand files, 5 theme0 and 4 dark theme files, the chart scales, and 3 presets.
    expect(original.size).toBe(22);
    expect(generatePaletteFiles(seeds)).toEqual(original);
    await writePaletteFiles(original, root);
    expect(await writePaletteFiles(original, root, true)).toEqual([]);
    seeds.brands.A.accentHue += 10;
    const drift = await writePaletteFiles(generatePaletteFiles(seeds), root, true);
    expect(drift).toContain('packages/tokens/src/tokens/base/reference/color.brand.json');
    expect(drift).toContain('packages/tokens/src/tokens/brands/A/base.json');
    for (const [name, bytes] of original) expect(await readFile(path.join(root, name), 'utf8')).toBe(bytes);
  });

  it('fails --check at the process boundary for changed seeds and missing outputs', async () => {
    const root = await scratch();
    const script = path.resolve('scripts/tokens/generate-palette.ts');
    const seedPath = path.join(root, 'seeds.json');
    const seeds = await loadPaletteSeeds();
    await writeFile(seedPath, JSON.stringify(seeds));
    const args = ['--import', 'tsx', script, '--out', root, '--seeds', seedPath];
    expect(spawnSync(process.execPath, [...args, '--check']).status).toBe(1);
    execFileSync(process.execPath, args);
    expect(spawnSync(process.execPath, [...args, '--check']).status).toBe(0);
    seeds.brands.B.accentHue += 15;
    await writeFile(seedPath, JSON.stringify(seeds));
    const result = spawnSync(process.execPath, [...args, '--check'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('brands/B/base.json');
  }, 20_000);

  // s222-m01 (#2502 ruling 3): each brand is a recipe; brand B is its own recipe, not brand A with another hue.
  it.each([
    ['unknown version', (s: any) => { s.version = 1; }],
    ['out of range hue', (s: any) => { s.brands.A.accentHue = -1; }],
    ['missing recipe field', (s: any) => { delete s.brands.A.radius; }],
    ['unknown seed', (s: any) => { s.brands.A.hex = '#ffffff'; }],
    ['saturated neutral', (s: any) => { s.brands.A.neutralChroma = .1; }],
    ['unknown primary', (s: any) => { s.brands.B.primary = 'loud'; }],
  ])('rejects %s rather than silently accepting an unused input', async (_name, mutate) => {
    const seeds = await loadPaletteSeeds();
    mutate(seeds);
    const file = path.join(await scratch(), 'invalid.json');
    await writeFile(file, JSON.stringify(seeds));
    await expect(loadPaletteSeeds(file)).rejects.toThrow('Invalid palette seeds');
  });

  it('keeps every existing reference step and brand semantic name; B shares the method', async () => {
    const files = generatePaletteFiles(await loadPaletteSeeds());
    for (const [file, bytes] of files) {
      const oldKeys = tokenKeys(JSON.parse(await readFile(file, 'utf8')));
      const newKeys = tokenKeys(JSON.parse(bytes));
      for (const key of oldKeys) expect(newKeys, file).toContain(key);
      // The frozen semantic contract separately permits new dark/HC declarations
      // of existing viz names; it still forbids new public names or removals.
    }
    const a = JSON.parse(files.get('packages/tokens/src/tokens/brands/A/base.json')!).color.brand.A;
    const b = JSON.parse(files.get('packages/tokens/src/tokens/brands/B/base.json')!).color.brand.B;
    expect(a.surface.canvas.$value).toBe(b.surface.canvas.$value);
    expect(a.surface.interactive.primary.default.$value).not.toBe(b.surface.interactive.primary.default.$value);
  });

  // s222-m01 (#2502 ruling 2): the scales are calibrated on Radix Colors, so a Radix hue gets Radix's own steps. Brand A's
  // accent is Radix indigo and its status families Radix blue, green, amber and red, in light and dark.
  it('reproduces Radix Colors at Radix hues, every step, light and dark', async () => {
    const calibration = JSON.parse(await readFile('packages/tokens/src/palette/radix-calibration.json', 'utf8'));
    expect(calibration.source).toBe('@radix-ui/colors 3.0.0 (MIT, Copyright (c) 2021 Radix)');
    const { hueScale, hex } = await import('../../packages/tokens/src/palette/recipe.mjs');
    const expected: Record<string, Record<'light' | 'dark', string[]>> = {
      indigo: {
        light: ['#FDFDFE', '#F7F9FF', '#EDF2FE', '#E1E9FF', '#D2DEFF', '#C1D0FF', '#ABBDF9', '#8DA4EF', '#3E63DD', '#3358D4', '#3A5BC7', '#1F2D5C'],
        dark: ['#11131F', '#141726', '#182449', '#1D2E62', '#253974', '#304384', '#3A4F97', '#435DB1', '#3E63DD', '#5472E4', '#9EB1FF', '#D6E1FF'],
      },
      red: {
        light: ['#FFFCFC', '#FFF7F7', '#FEEBEC', '#FFDBDC', '#FFCDCE', '#FDBDBE', '#F4A9AA', '#EB8E90', '#E5484D', '#DC3E42', '#CE2C31', '#641723'],
        dark: ['#191111', '#201314', '#3B1219', '#500F1C', '#611623', '#72232D', '#8C333A', '#B54548', '#E5484D', '#EC5D5E', '#FF9592', '#FFD1D9'],
      },
    };
    const hues = { indigo: calibration.families.indigo.light[8][2], red: calibration.families.red.light[8][2] };
    for (const [family, modes] of Object.entries(expected)) {
      for (const mode of ['light', 'dark'] as const) {
        expect(hueScale(hues[family as keyof typeof hues], mode).map(hex), `${family} ${mode}`).toEqual(modes[mode]);
      }
    }
  });

  // s222-m01 (#2502 rulings 1-2): 12 light and 12 dark steps per family. Light steps fall in lightness and dark steps
  // rise, except amber's solid steps 9-10 (its bright solid, with dark text on it); every step is in sRGB; chroma peaks
  // inside the ramp for the chromatic families; the neutral is one hue.
  it('generates coherent 12-step reference scales from seeds, including gamut and mid-peak chroma', async () => {
    const root = await scratch();
    await writePaletteFiles(generatePaletteFiles(await loadPaletteSeeds(), ['reference']), root);
    const tokens = await loadDtcgTokens(path.join(root, 'packages/tokens/src/tokens/base/reference'));
    for (const family of ['accent', 'neutral', 'info', 'success', 'warning', 'critical', 'archive']) {
      for (const mode of ['light', 'dark'] as const) {
        const name = mode === 'light' ? family : `${family}-dark`;
        const entries = selectRamp(tokens, `ref.color.${name}`);
        expect(entries.map((entry) => entry.path.at(-1)), name).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
        const ordered = family === 'warning' ? entries.filter((entry) => !['9', '10'].includes(entry.path.at(-1)!)) : entries;
        const steps = mode === 'light' ? ordered : [...ordered].reverse();
        const types = ['ramp-monotonicity', 'gamut', ...(family === 'neutral' ? ['neutral-hue'] as const : family === 'warning' ? [] : ['chroma-curve'] as const)] as const;
        for (const type of types) {
          const failures = checkPalette(type, name, type === 'ramp-monotonicity' ? steps : entries, tokens).filter((row) => !row.ok);
          expect(failures, `${name}/${type}`).toEqual([]);
        }
      }
    }
  });

  it('only emits the requested mission group so light work cannot mutate dark early', async () => {
    const files = generatePaletteFiles(await loadPaletteSeeds(), ['reference', 'light']);
    // 3 reference files, the two brand base files, 5 theme0 files and the 3 presets.
    expect(files.size).toBe(13);
    expect([...files.keys()].some((name) => name.endsWith('/dark.json'))).toBe(false);
  });

  it.each([0, 25, 85, 155, 210, 265, 305])('maps hue %s into sRGB without altering lightness or hue', (hue) => {
    for (const l of [.02, .14, .5, .95, .99]) {
      const value = paletteColor(l, .3, hue);
      expect(isInSrgb(value), value).toBe(true);
      expect(value.startsWith(`oklch(${l} `)).toBe(true);
      expect(value.endsWith(` ${hue})`)).toBe(true);
    }
  });
});
