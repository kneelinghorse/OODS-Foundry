/**
 * s197 supersedes #1158's byte-inequality proxy: status identity now comes from
 * shared authored seeds, and Brand B varies only its primary hue. Equal generated
 * values are intended. Verify provenance directly so hand-copied or independently
 * nudged status values still fail, without manufacturing hue drift for identity.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generatePaletteFiles, loadPaletteSeeds } from '../../scripts/tokens/generate-palette.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_SRC = path.resolve(moduleDir, '../../packages/tokens/src/tokens');

type Leaves = Map<string, string>;

function leaves(node: unknown, prefix: string[] = [], out: Leaves = new Map()): Leaves {
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if ('$value' in record) {
      out.set(prefix.join('.'), String(record.$value));
      return out;
    }
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith('$')) continue;
      leaves(value, [...prefix, key], out);
    }
  }
  return out;
}

function loadLeaves(relativePath: string): Leaves {
  return leaves(JSON.parse(readFileSync(path.join(TOKENS_SRC, relativePath), 'utf8')));
}

const themeStatus = {
  theme0: loadLeaves('themes/theme0/status.json'),
  dark: loadLeaves('themes/dark/status.json'),
};

function brandStatusLeaves(brand: 'A' | 'B', theme: 'base' | 'dark'): Leaves {
  const all = loadLeaves(`brands/${brand}/${theme}.json`);
  return new Map([...all].filter(([key]) => key.includes('status')));
}

function byteCopies(brandLeaves: Leaves, themeLayer: Leaves): string[] {
  const themeValues = new Set(themeLayer.values());
  return [...brandLeaves]
    .filter(([, value]) => themeValues.has(value))
    .map(([key]) => key)
    .sort();
}

const CASES = [
  { brand: 'A', theme: 'base', own: 'theme0', cross: 'dark' },
  { brand: 'A', theme: 'dark', own: 'dark', cross: 'theme0' },
  { brand: 'B', theme: 'base', own: 'theme0', cross: 'dark' },
  { brand: 'B', theme: 'dark', own: 'dark', cross: 'theme0' },
] as const;

describe('brand status literal provenance (#1158)', () => {
  // s206-m04: six status families since Sprint 206 m01 added accent (surface, border, text, icon each), so 24 (was 20).
  // s222-m01 (#2502 ruling 11): each family also has a solid fill and its text, so 36.
  it('every brand file declares exactly 36 status literals', () => {
    for (const { brand, theme } of CASES) {
      expect(brandStatusLeaves(brand, theme).size, `${brand}/${theme}`).toBe(36);
    }
  });

  for (const { brand, theme } of CASES) {
    it(`${brand}/${theme} is derived from the authored seeds`, async () => {
      const file = `packages/tokens/src/tokens/brands/${brand}/${theme}.json`;
      const expected = leaves(JSON.parse(generatePaletteFiles(await loadPaletteSeeds()).get(file)!));
      expect(brandStatusLeaves(brand, theme)).toEqual(new Map([...expected].filter(([key]) => key.includes('status'))));
    });
  }

  // s222-m01 (#2502 ruling 3): each brand is its own recipe, so a status hue in brand A's recipe reaches brand A and the
  // unbranded theme layer (which holds A's roles) and leaves brand B and every other family alone.
  it('a status hue change in a recipe reaches that brand and the shared theme layer, and nothing else', async () => {
    const seeds = await loadPaletteSeeds();
    const before = generatePaletteFiles(seeds);
    seeds.brands.A.status = { ...(seeds.brands.A.status ?? {}), success: { hue: 157.7 + 12 } };
    const after = generatePaletteFiles(seeds);
    const changedIn = (file: string) => {
      const previous = leaves(JSON.parse(before.get(file)!));
      const current = leaves(JSON.parse(after.get(file)!));
      return [...current].filter(([key, value]) => value !== previous.get(key)).map(([key]) => key);
    };
    for (const file of ['brands/A/base.json', 'brands/A/dark.json', 'themes/dark/status.json', 'themes/theme0/status.json']) {
      const changed = changedIn(`packages/tokens/src/tokens/${file}`);
      expect(changed.length, file).toBeGreaterThanOrEqual(4);
      expect(changed.every(key => key.includes('.status.success.')), file).toBe(true);
    }
    for (const file of ['brands/B/base.json', 'brands/B/dark.json']) expect(changedIn(`packages/tokens/src/tokens/${file}`), file).toEqual([]);
  });

  // s222-m01 (#2502 ruling 2): a Radix scale's solid step 9 is the same colour in light and dark, so a family's solid, the
  // text on it and an icon that takes step 9 legitimately match across modes; its tinted surface, border and text never do.
  const tinted = (source: Leaves): Leaves => new Map([...source].filter(([key]) => /\.(surface|border|text)$/.test(key)));
  for (const { brand, theme, cross } of CASES) {
    it(`${brand}/${theme} has zero CROSS-SET copies of its tinted roles (vs the ${cross} status layer)`, () => {
      expect(byteCopies(tinted(brandStatusLeaves(brand, theme)), tinted(themeStatus[cross]))).toEqual([]);
    });
  }
});
