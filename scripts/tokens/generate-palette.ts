#!/usr/bin/env tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { isInSrgb } from './palette-checks.js';
import {
  brandColorRoles,
  brandDocuments,
  brandFont,
  brandRadius,
  css,
  hex,
  hueScale,
  neutralScale,
  vizTree,
  DEFAULT_STATUS,
  MODES,
} from '../../packages/tokens/src/palette/recipe.mjs';

/** A brand recipe (packages/tokens/src/palette/recipe.mjs). */
export interface BrandRecipe {
  neutralHue: number;
  neutralChroma: number;
  accentHue: number;
  primary: 'neutral' | 'accent';
  radius: number;
  font: string;
  fontMono?: string;
  status?: Partial<Record<'info' | 'success' | 'warning' | 'critical' | 'archive', { hue: number; chroma?: number }>>;
}
export interface PaletteSeeds {
  version: 2;
  /**
   * s222-m01 (#2502 ruling 3): every brand is a recipe; seeds.json holds A and B. s222-m02 (ruling 12): a brand's chart
   * palettes come from its recipe too (recipe.mjs vizPalette), so the seed file no longer names chart hues.
   */
  brands: { A: BrandRecipe; B: BrandRecipe; [brand: string]: BrandRecipe };
  /** s222-m01: each shipped preset is one recipe's colour roles in one mode, over brand A's themes. */
  presets: Record<string, { description: string; mode: 'light' | 'dark'; themes: Partial<Record<'base' | 'dark' | 'hc', 'base' | 'dark' | 'hc'>>; recipe: BrandRecipe }>;
}
type TokenTree = { [key: string]: unknown };
type Oklch = { l: number; c: number; h: number };
export type PaletteGroup = 'reference' | 'light' | 'dark' | 'viz' | 'hc';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SEED_PATH = 'packages/tokens/src/palette/seeds.json';
const TOKEN_ROOT = 'packages/tokens/src/tokens';
const SOURCE = 'generated from palette/seeds.json by generate-palette.ts';

export async function loadPaletteSeeds(seedPath = path.join(ROOT, SEED_PATH)): Promise<PaletteSeeds> {
  const schema = JSON.parse(await fs.readFile(path.join(ROOT, 'packages/tokens/src/palette/seeds.schema.json'), 'utf8'));
  const seed: unknown = JSON.parse(await fs.readFile(seedPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile<PaletteSeeds>(schema);
  if (!validate(seed)) throw new Error(`Invalid palette seeds: ${ajv.errorsText(validate.errors)}`);
  return seed;
}

/** Preserve hue and lightness; reduce chroma into sRGB without channel clipping. */
export function paletteColor(l: number, c: number, h: number): string {
  const serialize = (chroma: number) => `oklch(${Number(l.toFixed(6))} ${Number(chroma.toFixed(6))} ${Number(h.toFixed(6))})`;
  if (isInSrgb(serialize(c))) return serialize(c);
  let low = 0;
  let high = c;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (isInSrgb(serialize(mid))) low = mid;
    else high = mid;
  }
  return serialize(low);
}

function colorLeaf(value: Oklch, name: string) {
  return { $type: 'color', $value: css(value), $description: `${name}; ${SOURCE}.`, $extensions: { ods: { fallback: hex(value) } } };
}

function put(tree: TokenTree, key: string, leaf: unknown): void {
  const segments = key.split('.');
  let node = tree;
  for (const segment of segments.slice(0, -1)) node = (node[segment] ??= {}) as TokenTree;
  node[segments.at(-1)!] = leaf;
}

/** Brand roles are camelCase (text.onInteractive); the theme layer's slots are kebab-case (text.on-interactive). */
const themeKey = (role: string) => role.split('.').map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('.');

/**
 * The reference layer: brand A's 12 light and 12 dark steps for every family (#2502 ruling 1 replaces the 50-950
 * ramps). `ref.color.<family>.<step>` is light, `ref.color.<family>-dark.<step>` dark.
 */
function referenceTrees(recipe: BrandRecipe): Record<string, TokenTree> {
  const status = { ...DEFAULT_STATUS, ...(recipe.status ?? {}) } as Record<string, { hue: number; chroma?: number }>;
  const scales = (mode: 'light' | 'dark'): Record<string, Oklch[]> => ({
    neutral: neutralScale(recipe.neutralHue, recipe.neutralChroma, mode),
    accent: hueScale(recipe.accentHue, mode),
    ...Object.fromEntries(Object.entries(status).map(([family, seed]) => [family, hueScale(seed.hue, mode, seed.chroma ?? 1)])),
  });
  const trees: Record<string, TokenTree> = { neutral: {}, brand: {}, status: {} };
  for (const mode of MODES as readonly ('light' | 'dark')[]) {
    for (const [family, steps] of Object.entries(scales(mode))) {
      const file = family === 'neutral' ? 'neutral' : family === 'accent' ? 'brand' : 'status';
      const name = mode === 'light' ? family : `${family}-dark`;
      steps.forEach((color, i) => put(trees[file], `ref.color.${name}.${i + 1}`, colorLeaf(color, `ref.color.${name}.${i + 1}`)));
    }
  }
  return trees;
}

/** The unbranded theme layer (`theme.*` at :root, `theme-dark.*`) holds brand A's roles, which every brand scope re-binds. */
function themeTrees(recipe: BrandRecipe, mode: 'light' | 'dark'): Record<string, TokenTree> {
  const { roles, themeOnly } = brandColorRoles(recipe, mode) as { roles: Record<string, Oklch>; themeOnly: Record<string, Oklch> };
  const scope = mode === 'light' ? 'theme' : 'theme-dark';
  const trees: Record<string, TokenTree> = { surface: {}, text: {}, status: {}, focus: {} };
  const file = (role: string) => (role.startsWith('surface.') || role.startsWith('border.') ? 'surface'
    : role.startsWith('text.') ? 'text' : role.startsWith('status.') ? 'status' : role.startsWith('focus.') ? 'focus' : undefined);
  for (const [role, value] of Object.entries({ ...roles, ...themeOnly })) {
    const target = file(role);
    if (target) put(trees[target], `${scope}.${themeKey(role)}`, colorLeaf(value, `${scope}.${themeKey(role)}`));
  }
  // Icons: primary icons take secondary text's step, muted icons muted text's, icons on the primary fill its text colour.
  for (const [icon, role] of Object.entries({ primary: 'text.secondary', muted: 'text.muted', 'on-interactive': 'text.onInteractive' })) {
    put(trees.text, `${scope}.icon.${icon}`, colorLeaf(roles[role], `${scope}.icon.${icon}`));
  }
  put(trees.focus, `${scope}.focus.width`, { $type: 'dimension', $value: '2px', $description: 'Focus ring width, the same in every theme.' });
  if (mode === 'light') {
    const shape: TokenTree = {};
    for (const [role, px] of Object.entries(brandRadius(recipe))) {
      put(shape, `theme.radius.${role}`, { $type: 'dimension', $value: `${px}px`, $description: `theme.radius.${role}; brand A's recipe, which every brand scope re-binds.` });
    }
    for (const [role, stack] of Object.entries(brandFont(recipe))) {
      put(shape, `theme.font.${role}`, { $type: 'fontFamily', $value: stack, $description: `theme.font.${role}; brand A's recipe, which every brand scope re-binds.` });
    }
    trees.shape = shape;
  }
  return trees;
}

/**
 * A shipped preset (src/presets/<id>.json): the recipe's colour roles in its mode, brand-relative (no color.brand.<id>
 * wrapper, so one preset serves any brand), which brand.intake's template lays over the themes the preset names.
 * s224-m01 (#2542 ruling 5): and the recipe's own chart colours in that mode, which vizPalette holds at 3:1 on the
 * recipe's canvas. Until then the template filled a preset's chart slots from brand A's palette for the same theme name,
 * so dark-minimal's light theme (a dark canvas) drew series 3 and 5 at 2.15:1 and 1.74:1.
 */
function presetTree(id: string, preset: PaletteSeeds['presets'][string]): TokenTree {
  const { roles } = brandColorRoles(preset.recipe, preset.mode) as { roles: Record<string, Oklch> };
  const viz = vizTree(preset.recipe, preset.mode) as TokenTree;
  const count = (node: TokenTree): number => ('$value' in node ? 1 : Object.values(node).reduce<number>((sum, child) => sum + count(child as TokenTree), 0));
  const tree: TokenTree = {
    $schema: 'https://design-tokens.org/dtcg/schema.json',
    $description: `${preset.description} It sets all ${Object.keys(roles).length} colour slots and all ${count(viz)} chart slots from one brand recipe (${preset.mode} roles and charts) over brand A's `
      + `${Object.keys(preset.themes).map((theme) => (theme === 'base' ? 'light' : theme)).join(' and ')} theme${Object.keys(preset.themes).length > 1 ? 's' : ''}; `
      + 'every other slot starts from brand A. Load it as a starting point with brand.intake (action "template", from { "preset": '
      + `"${id}" }), then validate and create the brand. Brand-relative: no color.brand.<id> wrapper, so it serves any brand.`,
    $extensions: { ods: { preset: { themes: preset.themes } } },
  };
  for (const [role, value] of Object.entries(roles)) put(tree, role, { $type: 'color', $value: css(value), $description: `${role}; ${SOURCE}.` });
  tree.viz = viz;
  return tree;
}

/** Pure derivation. No generated file is used as input, including its metadata. */
export function generatePaletteFiles(seeds: PaletteSeeds, groups: readonly PaletteGroup[] = ['reference', 'light', 'dark', 'viz', 'hc']): Map<string, string> {
  const files = new Map<string, string>();
  const emit = (name: string, tree: TokenTree) => files.set(`${TOKEN_ROOT}/${name}`, `${JSON.stringify(tree, null, 2)}\n`);
  const a = seeds.brands.A;
  if (groups.includes('reference')) {
    const trees = referenceTrees(a);
    emit('base/reference/color.brand.json', trees.brand);
    emit('base/reference/color.neutral.json', trees.neutral);
    emit('base/reference/color.status.json', trees.status);
  }
  // s213-m04: the seeded brands are the seed file's, in its order; a brand the seed file does not name is never written.
  // s222-m02 (#2502 ruling 12): each brand file carries its own recipe's chart colours (brand-scoped per the token build's
  // load order); viz-scales.json, the shared default every scope loads first, holds brand A's light ones.
  for (const brand of Object.keys(seeds.brands)) {
    const { documents } = brandDocuments(brand, seeds.brands[brand]) as { documents: Record<'base' | 'dark' | 'hc', TokenTree> };
    if (groups.includes('light') || groups.includes('viz')) emit(`brands/${brand}/base.json`, documents.base);
    if (groups.includes('dark') || groups.includes('viz')) emit(`brands/${brand}/dark.json`, documents.dark);
    if (groups.includes('hc') || groups.includes('viz')) emit(`brands/${brand}/hc.json`, documents.hc);
  }
  if (groups.includes('viz')) files.set('packages/tokens/src/viz-scales.json', `${JSON.stringify({ viz: vizTree(a, 'light') }, null, 2)}\n`);
  if (groups.includes('light')) {
    for (const [id, preset] of Object.entries(seeds.presets)) files.set(`packages/tokens/src/presets/${id}.json`, `${JSON.stringify(presetTree(id, preset), null, 2)}\n`);
  }
  if (groups.includes('light')) {
    for (const [name, tree] of Object.entries(themeTrees(a, 'light'))) emit(`themes/theme0/${name}.json`, tree);
  }
  if (groups.includes('dark')) {
    for (const [name, tree] of Object.entries(themeTrees(a, 'dark'))) emit(`themes/dark/${name}.json`, tree);
  }
  return files;
}

export async function writePaletteFiles(files: ReadonlyMap<string, string>, outputRoot: string, check = false): Promise<string[]> {
  const drift: string[] = [];
  for (const [name, expected] of files) {
    const target = path.join(outputRoot, name);
    if (check) {
      try {
        if (await fs.readFile(target, 'utf8') !== expected) drift.push(name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        drift.push(name);
      }
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, expected);
    }
  }
  return drift;
}

async function main() {
  const args = process.argv.slice(2);
  let seedPath = path.join(ROOT, SEED_PATH);
  let outputRoot = ROOT;
  let check = false;
  let groups: PaletteGroup[] = ['reference', 'light', 'dark', 'viz', 'hc'];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--check') { check = true; continue; }
    if (!['--seeds', '--out', '--only'].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Expected value after ${args[i]}`);
    if (args[i] === '--seeds') seedPath = path.resolve(value);
    if (args[i] === '--out') outputRoot = path.resolve(value);
    if (args[i] === '--only') {
      if (!value.split(',').every((group) => ['reference', 'light', 'dark', 'viz', 'hc'].includes(group))) throw new Error(`Invalid palette groups: ${value}`);
      groups = value.split(',') as PaletteGroup[];
    }
    i += 1;
  }
  const files = generatePaletteFiles(await loadPaletteSeeds(seedPath), groups);
  const drift = await writePaletteFiles(files, outputRoot, check);
  if (drift.length) {
    console.error(`Palette drift (${drift.length} files):\n${drift.join('\n')}`);
    process.exitCode = 1;
  } else console.log(`Palette ${check ? 'check passed' : 'generated'}: ${files.size} files.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
