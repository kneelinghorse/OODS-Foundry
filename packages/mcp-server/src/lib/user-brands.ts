import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { RUNTIME_MANIFEST_FILE } from './runtime-bundle.js';

/**
 * s213-m06 — a team's brands, kept and built outside the runtime.
 *
 * A team's brand lives in its own folder, `OODS_BRANDS_DIR/<id>/{base,dark,hc}.json` (the npm launcher sets
 * ~/.oods-foundry/brands, so brands survive upgrades). The published runtime re-hashes every file it ships before it
 * generates code (codegen/readiness-attestation.ts), so nothing may be built inside it. Instead the shipped token kit
 * (the token package's src, scripts, config and package.json) is copied into a build folder under
 * `OODS_BRANDS_DIR/.build/`, the team's brands are added beside the shipped ones, and the real token build runs there;
 * its node_modules is a link to this server package's own, which carries style-dictionary. `.build/active.json` names
 * the build in use; this server and the preview host both read their tokens from it. A build is keyed by a fingerprint of
 * the kit and of the team's brand files, so a runtime upgrade or a hand edit is rebuilt at the next start.
 */

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const BUILD_DIR = '.build';
const ACTIVE_FILE = 'active.json';
const BRAND_FILES = ['base', 'dark', 'hc'] as const;
/** What the token build reads, copied from the shipped token package. Generated aliases are rebuilt, never copied. */
const KIT_ENTRIES = ['src', 'scripts', 'style-dictionary.config.cjs', 'package.json'] as const;
const KIT_SKIP = new Set(['src/tokens/aliases', 'node_modules', 'dist']);

export interface ActiveUserBuild {
  /** The token package root the build wrote (its dist is what the server and preview read). */
  root: string;
  kit: string;
  /** sha256 of each team brand file the build read, by brand and theme. */
  sources: Record<string, Record<string, string>>;
  builtAt: string;
}

export interface UserBrandBuildReceipt {
  exitCode: number | null;
  durationMs: number;
  root: string;
  brands: string[];
  commands: Array<{ command: string[]; exitCode: number | null; stdout: string; stderr: string }>;
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/** The token package this runtime or checkout ships (operator override: MCP_BRAND_SOURCE_ROOT). */
export function shippedTokenRoot(): string {
  return path.resolve(REPO_ROOT, process.env.MCP_BRAND_SOURCE_ROOT || 'packages/tokens');
}

/** The team's brands folder, when one is set (OODS_BRANDS_DIR; the npm launcher sets ~/.oods-foundry/brands). */
export function userBrandsDir(): string | null {
  const value = process.env.OODS_BRANDS_DIR?.trim();
  return value ? path.resolve(value) : null;
}

/** The team brand ids in the brands folder: its directories, less the build folder and hidden ones. */
export function userBrandIds(): string[] {
  const dir = userBrandsDir();
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort();
}

/** The brand ids the shipped token package carries (its dist/brands.json). */
export function shippedBrandIds(): string[] {
  try {
    return (JSON.parse(fs.readFileSync(path.join(shippedTokenRoot(), 'dist/brands.json'), 'utf8')) as { brands: string[] }).brands;
  } catch {
    return [];
  }
}

/** A team brand's file in the brands folder. */
export function userBrandFile(brand: string, theme: (typeof BRAND_FILES)[number]): string {
  return path.join(userBrandsDir()!, brand, `${theme}.json`);
}

export function isUserBrand(brand: string): boolean {
  return userBrandIds().includes(brand);
}

function kitFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (relative: string) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full) || KIT_SKIP.has(relative)) return;
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) visit(relative ? `${relative}/${name}` : name);
    } else files.push(relative);
  };
  for (const entry of KIT_ENTRIES) visit(entry);
  return files;
}

/**
 * A fingerprint of what a team build is made from: the shipped kit's files, and the runtime itself (where it is unpacked
 * and its manifest). A new runtime version, which the launcher unpacks into a folder of its own, or a changed shipped
 * token means a new build, whose node_modules link is to the runtime in use.
 */
export function kitFingerprint(root = shippedTokenRoot()): string {
  const hash = createHash('sha256');
  hash.update(`runtime\0${SERVER_DIR}\n`);
  const manifest = path.join(REPO_ROOT, RUNTIME_MANIFEST_FILE);
  if (fs.existsSync(manifest)) hash.update(`manifest\0${sha256(fs.readFileSync(manifest))}\n`);
  for (const file of kitFiles(root)) hash.update(`${file}\0${sha256(fs.readFileSync(path.join(root, file)))}\n`);
  return hash.digest('hex');
}

/** Whether this runtime can build a team's brands: the kit ships and the build's own dependency resolves. */
export function canBuildUserBrands(): boolean {
  const root = shippedTokenRoot();
  return ['scripts/build.mjs', 'scripts/build-entry.mjs', 'style-dictionary.config.cjs', 'src/tokens/brands']
    .every(entry => fs.existsSync(path.join(root, entry)))
    && fs.existsSync(path.join(SERVER_DIR, 'node_modules', 'style-dictionary'));
}

function currentSources(): Record<string, Record<string, string>> {
  return Object.fromEntries(userBrandIds().map(brand => [brand, Object.fromEntries(BRAND_FILES.map(theme => {
    const file = userBrandFile(brand, theme);
    return [theme, fs.existsSync(file) ? sha256(fs.readFileSync(file)) : ''];
  }))]));
}

function activeFile(): string | null {
  const dir = userBrandsDir();
  return dir ? path.join(dir, BUILD_DIR, ACTIVE_FILE) : null;
}

/** The build named in active.json, when it exists and was made from this kit. */
export function activeUserBuild(): ActiveUserBuild | null {
  const file = activeFile();
  if (!file || !fs.existsSync(file)) return null;
  try {
    const active = JSON.parse(fs.readFileSync(file, 'utf8')) as ActiveUserBuild;
    if (!fs.existsSync(path.join(active.root, 'dist/css-variables-by-scope.json'))) return null;
    return active;
  } catch {
    return null;
  }
}

/** Why the active build does not match what the brands folder and the kit hold now, or null when it does. */
export function userBuildStaleness(): string | null {
  const ids = userBrandIds();
  const active = activeUserBuild();
  if (ids.length === 0) return active ? 'the brands folder no longer holds a team brand' : null;
  if (!active) return 'no team brand build exists yet';
  if (active.kit !== kitFingerprint()) return 'the runtime changed (a new version, or its token kit)';
  if (JSON.stringify(active.sources) !== JSON.stringify(currentSources())) return 'a team brand\'s files changed after the build';
  return null;
}

/** The token build this server reads: the team build when one is active, else the shipped token package. */
export function activeTokenRoot(): string {
  return (userBrandsDir() && userBrandIds().length > 0 ? activeUserBuild()?.root : undefined) ?? shippedTokenRoot();
}

function copyKit(from: string, to: string): void {
  for (const file of kitFiles(from)) {
    const target = path.join(to, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, file), target);
  }
}

async function runScript(root: string, script: string): Promise<UserBrandBuildReceipt['commands'][number]> {
  const command = [process.execPath, path.join(root, 'scripts', script)];
  return new Promise(resolve => {
    const result = { command, exitCode: null as number | null, stdout: '', stderr: '' };
    const child = spawn(command[0]!, command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { result.stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { result.stderr += chunk.toString(); });
    child.on('error', error => { result.stderr += error.message; resolve(result); });
    child.on('close', code => { result.exitCode = code; resolve(result); });
  });
}

/** Compile the shipped kit and team sources using this server's dependencies, only in the caller's writable folder. */
export async function compileTokenKit(root: string): Promise<UserBrandBuildReceipt['commands']> {
  const brands = userBrandIds();
  const shipped = shippedBrandIds();
  const clash = brands.filter(brand => shipped.some(id => id.toLowerCase() === brand.toLowerCase()));
  if (clash.length) throw new Error(`${clash.join(', ')} shadows a shipped brand; rename the team folder.`);
  const commands: UserBrandBuildReceipt['commands'] = [];
  copyKit(shippedTokenRoot(), root);
  for (const brand of brands) {
    fs.mkdirSync(path.join(root, 'src/tokens/brands', brand), { recursive: true });
    for (const theme of BRAND_FILES) {
      const file = userBrandFile(brand, theme);
      if (fs.existsSync(file)) fs.copyFileSync(file, path.join(root, 'src/tokens/brands', brand, `${theme}.json`));
    }
  }
  fs.symlinkSync(path.join(SERVER_DIR, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  for (const script of ['build.mjs', 'build-entry.mjs']) {
    const result = await runScript(root, script);
    commands.push(result);
    if (result.exitCode !== 0) break;
  }
  return commands;
}

/**
 * Build the team's brands beside the shipped ones, in a new folder under the brands folder, and make it the active
 * build only when both token-build stages pass. A failed build leaves the previous active build in use and removes its
 * own folder. A brand folder named like a shipped brand is refused before anything is built.
 */
export async function buildUserBrands(): Promise<UserBrandBuildReceipt> {
  const dir = userBrandsDir();
  if (!dir) throw new Error('No brands folder is set (OODS_BRANDS_DIR).');
  const start = Date.now();
  const brands = userBrandIds();
  const shipped = shippedBrandIds();
  const clash = brands.filter(brand => shipped.some(id => id.toLowerCase() === brand.toLowerCase()));
  if (clash.length > 0) throw new Error(`${clash.join(', ')} in ${dir} ${clash.length === 1 ? 'is' : 'are'} named like a brand OODS Foundry ships; rename the folder.`);
  const builds = path.join(dir, BUILD_DIR);
  fs.mkdirSync(builds, { recursive: true });
  const staging = path.join(builds, `.staging-${randomBytes(6).toString('hex')}`);
  const kit = kitFingerprint();
  const sources = currentSources();
  const receipt: UserBrandBuildReceipt = { exitCode: 0, durationMs: 0, root: staging, brands, commands: [] };
  try {
    receipt.commands = await compileTokenKit(staging);
    receipt.exitCode = receipt.commands.at(-1)?.exitCode ?? 1;
    if (receipt.exitCode !== 0) {
      fs.rmSync(staging, { recursive: true, force: true });
      return { ...receipt, durationMs: Date.now() - start };
    }
    const root = path.join(builds, `${kit.slice(0, 12)}-${sha256(JSON.stringify(sources)).slice(0, 12)}`);
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(staging, root);
    const active: ActiveUserBuild = { root, kit, sources, builtAt: new Date().toISOString() };
    const pointer = path.join(builds, `.${ACTIVE_FILE}.partial`);
    fs.writeFileSync(pointer, `${JSON.stringify(active, null, 2)}\n`);
    fs.renameSync(pointer, path.join(builds, ACTIVE_FILE));
    // Earlier builds are no longer read by anything.
    for (const entry of fs.readdirSync(builds)) {
      const full = path.join(builds, entry);
      if (full !== root && entry !== ACTIVE_FILE && fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true, force: true });
    }
    return { ...receipt, root, durationMs: Date.now() - start };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

/**
 * At start: bring the team build up to date with the brands folder and the kit, or stop using it when the folder holds
 * no team brand. Returns what was done, for health and the log.
 */
export type UserBrandPreparation = { action: 'none' | 'reused' | 'built' | 'cleared' | 'failed'; reason?: string; receipt?: UserBrandBuildReceipt; error?: string };
let lastPreparation: UserBrandPreparation | null = null;

/** What prepareUserBrands did at this server's start, for health. */
export function lastUserBrandPreparation(): UserBrandPreparation | null {
  return lastPreparation;
}

export async function prepareUserBrands(): Promise<UserBrandPreparation> {
  lastPreparation = await prepare();
  return lastPreparation;
}

async function prepare(): Promise<UserBrandPreparation> {
  const dir = userBrandsDir();
  if (!dir) return { action: 'none' };
  const stale = userBuildStaleness();
  if (!stale) return { action: userBrandIds().length > 0 ? 'reused' : 'none' };
  if (userBrandIds().length === 0) {
    fs.rmSync(path.join(dir, BUILD_DIR), { recursive: true, force: true });
    return { action: 'cleared', reason: stale };
  }
  // A build made from another kit (an earlier runtime version) would serve that version's shipped tokens: if it cannot be
  // rebuilt, stop using it, and the shipped brands are served until it can.
  const retire = () => {
    const active = activeUserBuild();
    if (active && active.kit !== kitFingerprint()) fs.rmSync(path.join(dir, BUILD_DIR, ACTIVE_FILE), { force: true });
  };
  if (!canBuildUserBrands()) {
    retire();
    return { action: 'failed', reason: stale, error: 'this runtime cannot build a team\'s brands' };
  }
  try {
    const receipt = await buildUserBrands();
    if (receipt.exitCode === 0) return { action: 'built', reason: stale, receipt };
    retire();
    return { action: 'failed', reason: stale, receipt, error: 'the token build failed' };
  } catch (error) {
    retire();
    return { action: 'failed', reason: stale, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * A brand's stylesheet for a generated app, when the app's @oods/tokens does not carry the brand (a team's brand): the
 * brand's own variables from the build's `:root` and every block scoped to it, read from the active token build. The
 * shipped brands return null, so an app for one of them is unchanged.
 */
export function brandStylesheet(brand: string): { file: string; contents: string } | null {
  if (shippedBrandIds().includes(brand)) return null;
  const cssFile = path.join(activeTokenRoot(), 'dist/css/tokens.css');
  if (!fs.existsSync(cssFile)) return null;
  const lower = brand.toLowerCase();
  const variables: string[] = [];
  const blocks: string[] = [];
  const declarations = (body: string) => body.split(';').map(line => line.trim()).filter(line => line.startsWith('--'));
  for (const match of fs.readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1]!.split(',').map(selector => selector.trim().replace(/\s+/g, ' '));
    if (selectors.some(selector => selector.includes(`[data-brand='${brand}']`))) {
      blocks.push(`${selectors.join(',\n')} {\n${declarations(match[2]!).map(line => `  ${line};`).join('\n')}\n}`);
    } else if (selectors.includes(':root')) {
      variables.push(...declarations(match[2]!).filter(line => line.slice(0, line.indexOf(':')).includes(`-brand-${lower}-`)));
    }
  }
  if (blocks.length === 0) return null;
  const header = `/* Brand ${brand}, from the OODS Foundry token build: this app's @oods/tokens carries the brands OODS Foundry ships, and this file adds ${brand}'s variables and its light, dark and high-contrast scopes. */`;
  return { file: `oods-brand-${lower}.css`, contents: `${header}\n:root {\n${variables.map(line => `  ${line};`).join('\n')}\n}\n\n${blocks.join('\n\n')}\n` };
}
