import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import tokensBundle from '@oods/tokens';
import { ToolError } from '../errors/tool-error.js';
import { tokenPackageRoot } from './token-build.js';
import { lastUserBrandPreparation, shippedTokenRoot, userBrandFile, userBrandIds, userBrandsDir } from './user-brands.js';

/**
 * s213-m04 — the brands this server can use, read from the token build instead of written into code.
 *
 * The token build reads the brands folder (`packages/tokens/src/tokens/brands/<id>/{base,dark,hc}.json`, see
 * packages/tokens/scripts/brand-registry.cjs), builds every brand it finds and writes the list to `dist/brands.json`.
 * A brand is usable here when this process holds its scoped values for all three themes: tool inputs, charts,
 * certification and the renderers all read that same in-memory bundle, which `refreshTokenBundle` updates after a
 * build. `brandRegistryReport` also reads the folder, so health can say when a brand's files were added or changed
 * after the build, or built after this server started.
 */

/** Brand A is the default scope: the bare `:root` block and every tool's default brand. */
export const DEFAULT_BRAND = 'A';
const THEMES = ['light', 'dark', 'hc'] as const;
const BRAND_FILES = ['base', 'dark', 'hc'] as const;
const BRANDS_DIR = 'src/tokens/brands';

type ScopedBundle = Record<string, Partial<Record<(typeof THEMES)[number], Record<string, string>>>>;

/** The brands this process can render, in the build's order (sorted ids). */
export function knownBrands(): string[] {
  const scopes = tokensBundle.cssVariablesByScope as ScopedBundle;
  return Object.keys(scopes).filter(brand => THEMES.every(theme => scopes[brand]?.[theme])).sort();
}

export function isKnownBrand(value: unknown): value is string {
  return typeof value === 'string' && knownBrands().includes(value);
}

/** What an agent reads when it names a brand this server does not have. */
export function unknownBrandMessage(value: unknown, where?: string): string {
  return `Unknown brand ${JSON.stringify(value)}${where ? ` at ${where}` : ''}; known brands are ${knownBrands().join(', ')}.`;
}

/** The brand when it is known, else the typed input error every tool gives (OODS-V001 with the known brands). */
export function assertKnownBrand(value: unknown, where?: string): string {
  if (isKnownBrand(value)) return value;
  throw new ToolError('OODS-V001', unknownBrandMessage(value, where), { brand: value, knownBrands: knownBrands(), ...(where ? { at: where } : {}) });
}

export type BrandRegistryIssue = {
  brand: string | null;
  kind: 'no-brand-list' | 'not-built' | 'changed-since-build' | 'built-after-start' | 'no-source-folder' | 'team-build-failed';
  message: string;
};

export type BrandRegistryReport = {
  /** Usable in this process. */
  brands: string[];
  default: string;
  /** The shipped token package's brands folder. */
  folder: string;
  /** s213-m06: the team's brands folder (OODS_BRANDS_DIR), whose brands are built outside the runtime; null when unset. */
  teamFolder: string | null;
  issues: BrandRegistryIssue[];
};

type BrandList = { brands: string[]; sources: Record<string, Record<string, string>> };

const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * The registry with the brand folders checked against the build: the shipped package's and, when set, the team's. Every
 * mismatch is an issue, none is skipped.
 */
export function brandRegistryReport(): BrandRegistryReport {
  const root = tokenPackageRoot();
  const folder = path.join(shippedTokenRoot(), BRANDS_DIR);
  const teamFolder = userBrandsDir();
  const team = userBrandIds();
  const brands = knownBrands();
  const issues: BrandRegistryIssue[] = [];
  const preparation = lastUserBrandPreparation();
  if (preparation?.action === 'failed') {
    issues.push({ brand: null, kind: 'team-build-failed', message: `The team brands in ${teamFolder} could not be built at start (${preparation.error}); the brands OODS Foundry ships are in use.` });
  }
  let built: BrandList | null = null;
  try {
    built = JSON.parse(fs.readFileSync(path.join(root, 'dist/brands.json'), 'utf8')) as BrandList;
  } catch {
    issues.push({ brand: null, kind: 'no-brand-list', message: `The token build wrote no brand list (${path.join(root, 'dist/brands.json')}); run the token build.` });
  }
  for (const brand of built?.brands ?? []) {
    if (!brands.includes(brand)) {
      issues.push({ brand, kind: 'built-after-start', message: `Brand ${brand} was built after this server started; restart the server to use it.` });
    }
  }
  if (!fs.existsSync(folder)) {
    issues.push({ brand: null, kind: 'no-source-folder', message: `The brands folder ${folder} is missing.` });
    return { brands, default: DEFAULT_BRAND, folder, teamFolder, issues };
  }
  const shipped = fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const source = (brand: string, file: (typeof BRAND_FILES)[number]) => team.includes(brand) ? userBrandFile(brand, file) : path.join(folder, brand, `${file}.json`);
  const folders = [...shipped, ...team.filter(brand => !shipped.includes(brand))];
  for (const brand of folders) {
    const sources = built?.sources?.[brand];
    if (!built || !built.brands.includes(brand) || !sources) {
      if (built) issues.push({ brand, kind: 'not-built', message: `Brand ${brand} has a folder but is not in the token build; run the token build, which names anything wrong with the folder.` });
      continue;
    }
    const changed = BRAND_FILES.filter(file => !fs.existsSync(source(brand, file)) || sha256(source(brand, file)) !== sources[file]);
    if (changed.length > 0) {
      issues.push({ brand, kind: 'changed-since-build', message: `Brand ${brand}'s ${changed.map(file => `${file}.json`).join(', ')} changed after the token build; run the token build.` });
    }
  }
  for (const brand of built?.brands ?? []) {
    if (!folders.includes(brand)) issues.push({ brand, kind: 'no-source-folder', message: `Brand ${brand} is built but its folder ${team.includes(brand) || teamFolder ? path.join(teamFolder ?? folder, brand) : path.join(folder, brand)} is gone.` });
  }
  return { brands, default: DEFAULT_BRAND, folder, teamFolder, issues };
}
