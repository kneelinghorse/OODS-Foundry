import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { tokenPackageRoot, runTokenBuild, refreshTokenBundle, canRunTokenBuild, type TokenBuildReceipt } from '../lib/token-build.js';
import { buildUserBrands, canBuildUserBrands, isUserBrand, shippedTokenRoot, userBrandIds, userBrandsDir } from '../lib/user-brands.js';
import { resetTokensCssCache } from '../render/document.js';
import { todayDir, loadPolicy, withinAllowed, type Policy } from '../lib/security.js';
import { isUnsafeKey } from '../lib/safety.js';
import { brandDocumentsFromFiles, checkBrand, type BrandValidationReport } from '../lib/brand-template.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type {
  ArtifactDetail,
  BrandApplyInput,
  BrandApplyStrategy,
  GenericOutput,
  PlanDiff,
  PlanDiffChange,
  PreviewVerbosity,
  ToolPreview,
} from './types.js';
import { ToolError } from '../errors/tool-error.js';

const THEMES = ['base', 'dark', 'hc'] as const;
type Theme = (typeof THEMES)[number];

type TokenDocument = Record<string, any>;
type ThemeMap = Record<Theme, TokenDocument>;

type PatchOperation = {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
};

type ChangeRecord = {
  theme: Theme;
  pointer: string;
  before: unknown;
  after: unknown;
};

const MCP_SERVER_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REPO_ROOT = path.resolve(MCP_SERVER_DIR, '..', '..');
const TOKENS_DIR = path.join(REPO_ROOT, 'packages', 'tokens', 'src', 'tokens');
export const BRAND_ROOT = path.join(TOKENS_DIR, 'brands');

/**
 * Supported brands are DERIVED from the filesystem, never hard-coded in this file: the shipped token package's
 * brands folder and, since s213-m06, the team's brands folder (OODS_BRANDS_DIR).
 * Read per call rather than memoised: brand.apply is not on a hot path, and a stale
 * allowlist is a worse failure than one readdir.
 */
function listAllowedBrands(): string[] {
  const sourcePath = path.join(shippedTokenRoot(), 'src/tokens/brands');
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    throw new ToolError('OODS-N020', 'brand.apply: canonical brand source is not shipped in this runtime.', {
      tool: 'brand.apply', dependency: 'canonical-brand-source', path: sourcePath,
    });
  }
  return [...fs
    .readdirSync(sourcePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name), ...userBrandIds()];
}

/**
 * Layer 1 of 2. An EXACT-NAME match against the brand directories, and the only layer
 * that can reject `''`, `'.'` and `'A/'` — path.join() collapses all three to a legal,
 * readable path inside BRAND_ROOT, so containment cannot see them. Measured against HEAD
 * before this guard existed: `'A/../B'` and `'A/'` were both ACCEPTED and silently loaded
 * a brand other than the one named; `'..'`, `''`, `'.'` and `'../../../../../../etc'`
 * surfaced as a raw ENOENT, and a numeric brand as a raw TypeError.
 *
 * Runs at the TOP of handle(), which is what closes the two secondary sinks the read
 * guard alone does not cover: the output filename at `tokens.${brand}.${theme}.json`
 * (its ensureAllowed() checks artifactsBase, NOT runDir, so a traversing brand could
 * relocate a snapshot within the artifact tree).
 */
function assertBrandAllowed(brand: unknown): string {
  const allowed = listAllowedBrands();
  const reject = (reason: string): never => {
    throw new ToolError('OODS-V001', `Unknown brand ${JSON.stringify(brand)}: ${reason}`, {
      field: 'brand',
      brand,
      allowed,
    });
  };
  if (typeof brand !== 'string') return reject('brand must be a string');
  if (brand === '' || brand === '.' || brand === '..') return reject('brand must name a brand directory');
  if (!allowed.includes(brand)) return reject(`allowed brands are ${allowed.join(', ')}`);
  return brand;
}

/**
 * Layer 2 of 2 — containment, as defence in depth, matching structuredData.fetch.ts:134-135.
 * With the allowlist upstream no input can reach this, which is precisely why it carries its
 * own direct unit test (security.model.spec.ts): a layer no test can turn red is not a layer.
 *
 * DISCLOSED GAP: no realpath() — the repo uses realpath nowhere, and inventing the pattern in
 * one tool would be a lone convention. A symlink INSIDE BRAND_ROOT pointing outward is
 * therefore not covered by either layer.
 */
export function resolveBrandThemeFile(brand: string, theme: Theme): string {
  // A team brand's files are in its brands folder; the shipped brands' in the token package.
  const sourceRoot = isUserBrand(brand) ? userBrandsDir()! : path.join(shippedTokenRoot(), 'src/tokens/brands');
  const file = path.join(sourceRoot, brand, `${theme}.json`);
  if (!withinAllowed(sourceRoot, file)) {
    throw new ToolError('OODS-S015', `Path not allowed: ${file}`, { brand, theme, path: file });
  }
  return file;
}

function cloneJson<T>(value: T): T {
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === 'function') {
    return sc(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeKey(key: string): string {
  if (key === 'value') return '$value';
  if (key === 'description') return '$description';
  if (key === 'type') return '$type';
  if (isUnsafeKey(key)) {
    throw new ToolError('OODS-V113', `Unsafe key "${key}" is not allowed in token deltas.`, { key });
  }
  return key;
}

function normalizeDelta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeDelta);
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      next[normalizeKey(key)] = normalizeDelta(val);
    }
    return next;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: TokenDocument, source: TokenDocument): void {
  for (const [key, value] of Object.entries(source)) {
    if (isUnsafeKey(key)) {
      throw new ToolError('OODS-V113', `Unsafe key "${key}" is not allowed in token deltas.`, { key });
    }
    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key] as TokenDocument, value as TokenDocument);
    } else if (Array.isArray(value)) {
      target[key] = cloneJson(value);
    } else {
      target[key] = value;
    }
  }
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function pointerSegments(pointer: string): string[] {
  if (!pointer.startsWith('/')) {
    throw new ToolError('OODS-V100', `Invalid JSON pointer: ${pointer}`, { pointer });
  }
  return pointer
    .split('/')
    .slice(1)
    .map((item) => normalizeKey(decodePointerSegment(item)));
}

function ensureContainer(parent: any, key: string): TokenDocument {
  if (!isPlainObject(parent[key])) {
    parent[key] = {};
  }
  return parent[key] as TokenDocument;
}

function applyPatchDocument(doc: TokenDocument, operations: PatchOperation[]): void {
  for (const op of operations) {
    if (!op || typeof op.path !== 'string' || typeof op.op !== 'string') {
      throw new ToolError('OODS-V102', 'Invalid patch operation');
    }
    const segments = pointerSegments(op.path);
    if (!segments.length) {
      throw new ToolError('OODS-V103', 'Patch path cannot target document root');
    }
    const lastKey = segments[segments.length - 1];
    let cursor: any = doc;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      cursor = ensureContainer(cursor, key);
    }
    if (op.op === 'remove') {
      if (Array.isArray(cursor)) {
        const index = Number(lastKey);
        if (Number.isNaN(index)) throw new ToolError('OODS-V112', `Cannot remove non-index path ${op.path}`, { path: op.path });
        cursor.splice(index, 1);
      } else {
        delete cursor[lastKey];
      }
      continue;
    }
    const value = normalizeDelta(op.value);
    if (op.op === 'add' || op.op === 'replace') {
      if (Array.isArray(cursor)) {
        const index = Number(lastKey);
        if (Number.isNaN(index)) throw new ToolError('OODS-V105', `Cannot ${op.op} non-index path ${op.path}`, { path: op.path, op: op.op });
        cursor[index] = value;
      } else {
        cursor[lastKey] = value;
      }
      continue;
    }
    throw new ToolError('OODS-V111', `Unsupported patch op: ${op.op}`, { op: op.op });
  }
}

function loadThemeDocument(brand: string, theme: Theme): TokenDocument {
  const raw = fs.readFileSync(resolveBrandThemeFile(brand, theme), 'utf8');
  return JSON.parse(raw) as TokenDocument;
}

function loadBrandDocuments(brand: string): ThemeMap {
  return {
    base: loadThemeDocument(brand, 'base'),
    dark: loadThemeDocument(brand, 'dark'),
    hc: loadThemeDocument(brand, 'hc'),
  };
}

/**
 * ── s169 m05: A DELTA MAY NOT ADDRESS A BRAND OTHER THAN THE ONE BEING APPLIED ──
 *
 * The alias path deep-merges a free-form delta into the target brand's document at the
 * DOCUMENT ROOT. Nothing constrained the namespace, so a delta shaped
 * `{ color: { brand: { A: … } } }` applied with `brand: 'B'` did not overwrite brand B —
 * it GRAFTED an entire brand-A subtree INSIDE brand B's files, in all three themes.
 *
 * MEASURED at s168's tip against `packages/tokens/src/presets/dark-minimal.json`, whose
 * payload was brand-A-namespaced: applying it to brand B produced
 * `/color/brand/A: {…}` as an ADDITION in `brands/B/base.json`, `dark.json` and `hc.json`.
 * The tool reported success ("Updated 3 token values for brand B") while brand B's files
 * grew a foreign brand's palette that nothing would ever read.
 *
 * The presets are re-keyed brand-relative in this same mission, which removes the loaded
 * gun. This guard removes the ability to fire one: it is about the SHAPE of any delta, not
 * about presets, because the graft vector was always brand.apply's free-form merge and
 * presets merely happened to be pointed at it.
 *
 * Deliberately narrow: only a `color.brand.<X>` addressed at some OTHER known brand is
 * rejected. Addressing your OWN brand explicitly is legal (redundant, but harmless and
 * previously valid), and a delta naming no brand at all is the normal case.
 */
function assertDeltaTargetsOnlyThisBrand(node: unknown, brand: string, trail: string[] = []): void {
  if (!isPlainObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const here = [...trail, key];
    // The shape we police is `…color.brand.<X>` at any depth (a theme-scoped delta nests it
    // one level deeper, e.g. `{ dark: { color: { brand: { A: … } } } }`).
    if (here.length >= 2 && here[here.length - 2] === 'brand' && here[here.length - 3] === 'color') {
      if (key !== brand && listAllowedBrands().includes(key)) {
        throw new ToolError(
          'OODS-V149',
          `Delta addresses brand "${key}" but brand.apply was called for brand "${brand}". ` +
            `A cross-brand delta does not overwrite the target — it grafts a foreign brand's ` +
            `subtree inside it. Re-key the delta relative to the brand (drop the ` +
            `color.brand.${key} wrapper) or call brand.apply with brand "${key}".`,
          { field: 'delta', brand, deltaBrand: key, path: here.join('.') },
        );
      }
    }
    assertDeltaTargetsOnlyThisBrand(value, brand, here);
  }
}

function buildAliasDelta(delta: Record<string, unknown>, brand: string): Partial<Record<Theme, TokenDocument>> {
  const normalized = normalizeDelta(delta) as TokenDocument;
  assertDeltaTargetsOnlyThisBrand(normalized, brand);
  const scoped: Partial<Record<Theme, TokenDocument>> = {};
  const shared: TokenDocument = {};
  for (const [key, value] of Object.entries(normalized)) {
    const possibleTheme = key as Theme;
    if (THEMES.includes(possibleTheme) && isPlainObject(value)) {
      scoped[possibleTheme] = cloneJson(value as TokenDocument);
    } else {
      shared[key] = cloneJson(value);
    }
  }
  for (const theme of THEMES) {
    const base = cloneJson(shared);
    if (scoped[theme]) {
      deepMerge(base, scoped[theme] as TokenDocument);
      scoped[theme] = base;
    } else if (Object.keys(base).length) {
      scoped[theme] = base;
    }
  }
  return scoped;
}

function collectChanges(previous: TokenDocument, next: TokenDocument, prefix = ''): Array<{ path: string; before: unknown; after: unknown }> {
  const changes: Array<{ path: string; before: unknown; after: unknown }> = [];
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})]);
  for (const key of keys) {
    const prevValue = previous ? previous[key] : undefined;
    const nextValue = next ? next[key] : undefined;
    const pointer = `${prefix}/${key}`;
    if (isPlainObject(prevValue) && isPlainObject(nextValue)) {
      changes.push(...collectChanges(prevValue as TokenDocument, nextValue as TokenDocument, pointer));
    } else if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
      if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
        changes.push({ path: pointer, before: prevValue, after: nextValue });
      }
    } else if (prevValue !== nextValue) {
      changes.push({ path: pointer, before: prevValue, after: nextValue });
    }
  }
  return changes;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return 'null';
  return JSON.stringify(value);
}

function toPlanDiff(
  theme: Theme,
  brand: string,
  changes: ChangeRecord[],
  before: TokenDocument,
  after: TokenDocument,
): PlanDiff {
  const additions = changes.filter((change) => change.before === undefined).length;
  const deletions = changes.filter((change) => change.after === undefined).length;
  const file = resolveBrandThemeFile(brand, theme);
  const pathLabel = isUserBrand(brand) ? file : path.relative(REPO_ROOT, file);
  const hunks = changes.map((change, index): { header: string; changes: PlanDiffChange[] } => {
    const header = `@@ theme=${theme} change=${index} @@`;
    const mutation: PlanDiffChange[] = [];
    if (change.before !== undefined) {
      mutation.push({ type: 'remove', value: `${change.pointer}: ${formatValue(change.before)}` });
    }
    if (change.after !== undefined) {
      mutation.push({ type: 'add', value: `${change.pointer}: ${formatValue(change.after)}` });
    }
    if (mutation.length === 0) {
      mutation.push({ type: 'context', value: `${change.pointer}: (no-op)` });
    }
    return { header, changes: mutation };
  });
  return {
    path: pathLabel,
    status: 'modified',
    summary: { additions, deletions },
    hunks,
    structured: {
      type: 'json',
      before,
      after,
    },
  };
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = stableSort(val);
    }
    return result;
  }
  return value;
}

function stringifyStable(value: unknown): string {
  return JSON.stringify(stableSort(value), null, 2);
}

function setDeltaValue(target: TokenDocument, pointer: string, value: unknown): void {
  const segments = pointer.split('/').filter(Boolean);
  if (!segments.length) return;
  let cursor: TokenDocument = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!isPlainObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key] as TokenDocument;
  }
  cursor[segments[segments.length - 1]] = value;
}

function buildStructuredDelta(changes: ChangeRecord[]): { before: TokenDocument; after: TokenDocument } {
  const before: TokenDocument = {};
  const after: TokenDocument = {};
  for (const change of changes) {
    if (change.before !== undefined) {
      setDeltaValue(before, change.pointer, change.before);
    }
    if (change.after !== undefined) {
      setDeltaValue(after, change.pointer, change.after);
    }
  }
  return { before, after };
}

/** Every custom property the token CSS declares, by selector (comments removed, as the build writes it). */
function cssDeclarations(css: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const declarations = blocks.get(selector) ?? new Map<string, string>();
    for (const line of match[2].split(';')) {
      const colon = line.indexOf(':');
      const name = line.slice(0, colon).trim();
      if (colon >= 0 && name.startsWith('--')) declarations.set(name, line.slice(colon + 1).trim());
    }
    blocks.set(selector, declarations);
  }
  return blocks;
}

export interface EmittedChange {
  selector: string;
  variable: string;
  before: string | null;
  after: string | null;
}

/** What the token build emitted differently: the CSS variables, under the selectors the build writes them in. */
function emittedChanges(before: string, after: string): EmittedChange[] {
  const previous = cssDeclarations(before);
  const next = cssDeclarations(after);
  const changes: EmittedChange[] = [];
  for (const selector of new Set([...previous.keys(), ...next.keys()])) {
    const was = previous.get(selector) ?? new Map<string, string>();
    const now = next.get(selector) ?? new Map<string, string>();
    for (const variable of new Set([...was.keys(), ...now.keys()])) {
      if (was.get(variable) !== now.get(variable)) {
        changes.push({ selector, variable, before: was.get(variable) ?? null, after: now.get(variable) ?? null });
      }
    }
  }
  return changes;
}

/** variables.css: the emitted changes as the rules a page could add to take them without the new build. */
function emittedCss(brand: string, changes: EmittedChange[]): string {
  if (changes.length === 0) return `/* The token build emitted no changed variables for brand ${brand}. */\n`;
  const bySelector = new Map<string, EmittedChange[]>();
  for (const change of changes) bySelector.set(change.selector, [...(bySelector.get(change.selector) ?? []), change]);
  return [...bySelector].map(([selector, entries]) =>
    `${selector} {\n${entries.filter(entry => entry.after !== null).map(entry => `  ${entry.variable}: ${entry.after};`).join('\n')}\n}\n`).join('\n');
}

function buildPreview(
  brand: string,
  changes: ChangeRecord[],
  verbosity: PreviewVerbosity,
): ToolPreview {
  if (changes.length === 0) {
    return {
      summary: `No updates for brand ${brand}.`,
      notes: ['Input produced no token changes.'],
      diffs: [],
      ...(verbosity === 'full' ? { specimens: [] } : {}),
    };
  }
  const diffs = THEMES.map((theme) => {
    const themeChanges = changes.filter((change) => change.theme === theme);
    if (!themeChanges.length) return null;
    const structured = buildStructuredDelta(themeChanges);
    return toPlanDiff(theme, brand, themeChanges, structured.before, structured.after);
  }).filter(Boolean) as PlanDiff[];

  const specimens = changes.slice(0, 12).map((change) =>
    `data:application/json,${encodeURIComponent(
      JSON.stringify({
        theme: change.theme,
        path: change.pointer,
        before: change.before,
        after: change.after,
      })
    )}`
  );

  const notesByTheme: string[] = [];
  for (const theme of THEMES) {
    const themeCount = changes.filter((change) => change.theme === theme).length;
    if (themeCount > 0) {
      notesByTheme.push(`${theme}: ${themeCount} updated token${themeCount === 1 ? '' : 's'}`);
    }
  }
  // s213-m05: the summary counts values; a changed $description or $extensions is metadata, named apart.
  const values = changes.filter((change) => isValueChange(change)).length;
  const metadata = changes.length - values;
  const compactDiffs =
    verbosity === 'compact'
      ? diffs.map(({ structured, ...rest }) => rest)
      : diffs;

  return {
    summary: `Updated ${values} token value${values === 1 ? '' : 's'} for brand ${brand}${metadata > 0 ? ` and ${metadata} description or metadata entr${metadata === 1 ? 'y' : 'ies'}` : ''}.`,
    notes: notesByTheme,
    diffs: compactDiffs,
    ...(verbosity === 'full' ? { specimens } : {}),
  };
}

function allowWriteFactory(policy: Policy): (candidate: string) => void {
  return (candidate: string) => {
    if (!withinAllowed(policy.artifactsBase, candidate)) {
      throw new ToolError('OODS-S015', `Path not allowed: ${candidate}`);
    }
    fs.mkdirSync(path.dirname(candidate), { recursive: true });
  };
}

export interface BrandApplyReceipt {
  sourceWritten: boolean;
  sourceFiles: Array<{ path: string; sha256Before: string; sha256After: string; bytesBefore: number; bytesAfter: number }>;
  build: TokenBuildReceipt | null;
  /** Present only when this runtime cannot rebuild tokens (the portable bundle): the host-only steps it skipped. */
  portable?: { sourceWrites: 'skipped'; tokenBuild: 'skipped'; reason: string };
  /** s213-m05: every slot whose value changes, by theme. */
  changes: Array<{ theme: Theme; slot: string; before: unknown; after: unknown }>;
  /** Changed $description or $extensions entries, which change no value. */
  metadataChanges: number;
  /** The brand as it would be, checked like brand.intake validate; apply writes nothing unless it is valid. */
  validation: BrandValidationReport;
  /** After a successful build: every CSS variable the build emitted differently, under its selector (variables.css). */
  emitted?: EmittedChange[];
}

const PORTABLE_APPLY_REASON =
  'This runtime ships built token output and cannot rebuild it; shipped brand source and dist stay unchanged, and the review kit carries the applied documents. It has no variables.css: only a token build says which CSS variables change.';

const isValueChange = (change: ChangeRecord) => /\/\$value$/.test(change.pointer);

/** `/color/brand/C/text/primary/$value` → `text.primary`; `/viz/scale/categorical/01/$value` → `viz.scale.categorical.01`. */
function slotOf(brand: string, pointer: string): string {
  const segments = pointer.split('/').filter(Boolean).slice(0, -1);
  return (segments[0] === 'color' && segments[1] === 'brand' && segments[2] === brand ? segments.slice(3) : segments).join('.');
}

export async function handle(input: BrandApplyInput): Promise<GenericOutput & { receipt: BrandApplyReceipt }> {
  if (!input || typeof input !== 'object') {
    throw new ToolError('OODS-V003', 'Input is required.');
  }
  if (input.delta === undefined || input.delta === null) {
    throw new ToolError('OODS-V003', 'delta is required.', { field: 'delta' });
  }

  // Validate the brand FIRST — before it reaches the token read or the snapshot filename.
  // Callers that reach this handler by direct import (the whole
  // in-repo surface, including security.model.spec.ts) never pass through the ajv enum at
  // index.ts:257, so this is the only enforcement they get.
  const brand = assertBrandAllowed(input.brand ?? 'A');
  const requestedStrategy: BrandApplyStrategy =
    input.strategy ?? (Array.isArray(input.delta) ? 'patch' : 'alias');

  const originals = loadBrandDocuments(brand);
  const updated: ThemeMap = {
    base: cloneJson(originals.base),
    dark: cloneJson(originals.dark),
    hc: cloneJson(originals.hc),
  };

  if (requestedStrategy === 'alias') {
    if (Array.isArray(input.delta)) {
      throw new ToolError('OODS-V001', 'Alias strategy expects an object delta.', { strategy: 'alias' });
    }
    const themeDelta = buildAliasDelta(input.delta as Record<string, unknown>, brand);
    for (const theme of THEMES) {
      const deltaForTheme = themeDelta[theme];
      if (!deltaForTheme) continue;
      deepMerge(updated[theme], deltaForTheme);
    }
  } else if (requestedStrategy === 'patch') {
    if (!Array.isArray(input.delta)) {
      throw new ToolError('OODS-V001', 'Patch strategy requires an array of RFC 6902 operations.', { strategy: 'patch' });
    }
    const operations = (input.delta as unknown[]).map((entry) => entry as PatchOperation);
    for (const theme of THEMES) {
      applyPatchDocument(updated[theme], operations);
    }
  } else {
    throw new ToolError('OODS-V001', `Unsupported strategy: ${requestedStrategy}`, { strategy: requestedStrategy });
  }

  const changeRecords: ChangeRecord[] = [];
  for (const theme of THEMES) {
    const previous = originals[theme];
    const next = updated[theme];
    const partialChanges = collectChanges(previous, next)
      .filter((change) => change.before !== change.after)
      .map((change) => ({
        theme,
        pointer: change.path,
        before: change.before,
        after: change.after,
      }));
    changeRecords.push(...partialChanges);
  }

  const previewVerbosity: PreviewVerbosity = input.preview?.verbosity ?? 'full';
  const preview = buildPreview(brand, changeRecords, previewVerbosity);

  // s213-m05: the brand as the change would leave it passes brand.intake's checks (slots, colours, the fixed slots,
  // the brand contrast rules) or nothing is written: a value the build or the contrast rules would refuse never
  // reaches the source.
  const validation = checkBrand({ brandId: brand, existing: brand, documents: brandDocumentsFromFiles(brand, updated) }).report;
  if (input.apply && !validation.valid) {
    throw new ToolError('OODS-V216',
      `brand.apply would leave brand ${brand} with ${validation.issues.length} problem${validation.issues.length === 1 ? '' : 's'}, so nothing was written. ${validation.issues.slice(0, 3).map(issue => issue.message).join(' ')}${validation.issues.length > 3 ? ' …' : ''}`,
      { validation });
  }

  const policy = loadPolicy();
  const baseDir = todayDir(policy.artifactsBase, input.apply === true);
  const reviewDir = path.join(baseDir, 'review-kit', 'brand.apply');
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(reviewDir, runStamp);
  if (!withinAllowed(policy.artifactsBase, runDir)) {
    throw new ToolError('OODS-S015', `Path not allowed: ${runDir}`, { path: runDir });
  }
  if (input.apply) fs.mkdirSync(runDir, { recursive: true });
  const ensureAllowed = allowWriteFactory(policy);

  const artifacts: string[] = [];
  const details: ArtifactDetail[] = [];
  let diagnosticsPath: string | undefined;

  const startedAt = new Date();
  const receipt: BrandApplyReceipt = {
    sourceWritten: false,
    sourceFiles: [],
    build: null,
    changes: changeRecords.filter(isValueChange).map(change => ({ theme: change.theme, slot: slotOf(brand, change.pointer), before: change.before, after: change.after })),
    metadataChanges: changeRecords.filter(change => !isValueChange(change)).length,
    validation,
  };
  const sourceHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  // Source writes and the token build are host-repository steps. A runtime that ships built
  // token output (the portable bundle) keeps its brand source and dist immutable and still
  // emits the review kit, so a bundle user gets the applied documents and the CSS overlay.
  // s213-m06: a team brand is written in its own folder and built outside the runtime, from npm too.
  const teamBrand = isUserBrand(brand);
  const hostBuild = teamBrand ? canBuildUserBrands() : canRunTokenBuild();

  if (input.apply) {
    for (const theme of hostBuild ? THEMES.filter(theme => changeRecords.some(change => change.theme === theme)) : []) {
      const file = resolveBrandThemeFile(brand, theme);
      const before = fs.readFileSync(file);
      fs.writeFileSync(file, stringifyStable(updated[theme]) + '\n', 'utf8');
      const after = fs.readFileSync(file);
      receipt.sourceWritten = true;
      receipt.sourceFiles.push({ path: file, sha256Before: sourceHash(before), sha256After: sourceHash(after), bytesBefore: before.length, bytesAfter: after.length });
    }
    for (const theme of THEMES) {
      const snapshotPath = path.join(runDir, `tokens.${brand}.${theme}.json`);
      ensureAllowed(snapshotPath);
      fs.writeFileSync(snapshotPath, stringifyStable(updated[theme]), 'utf8');
      artifacts.push(snapshotPath);
      const stat = fs.statSync(snapshotPath);
      details.push({
        path: snapshotPath,
        name: path.basename(snapshotPath),
        purpose: `Snapshot of ${brand} ${theme} tokens after apply.`,
        sha256: sha256File(snapshotPath),
        sizeBytes: stat.size,
      });
    }

    const specimenPayload = changeRecords.map((record) => ({
      theme: record.theme,
      path: record.pointer,
      before: record.before,
      after: record.after,
    }));
    const specimensPath = path.join(runDir, 'specimens.json');
    ensureAllowed(specimensPath);
    fs.writeFileSync(specimensPath, stringifyStable(specimenPayload), 'utf8');
    artifacts.push(specimensPath);
    const specimensStat = fs.statSync(specimensPath);
    details.push({
      path: specimensPath,
      name: 'specimens.json',
      purpose: 'Before/after specimen metadata for review kit.',
      sha256: sha256File(specimensPath),
      sizeBytes: specimensStat.size,
    });

    if (hostBuild) {
      const cssFile = () => path.join(tokenPackageRoot(), 'dist/css/tokens.css');
      const cssBefore = fs.existsSync(cssFile()) ? fs.readFileSync(cssFile(), 'utf8') : '';
      if (teamBrand) {
        const team = await buildUserBrands();
        receipt.build = { exitCode: team.exitCode, commands: team.commands, durationMs: team.durationMs };
      } else {
        receipt.build = await runTokenBuild();
      }
      if (receipt.build.exitCode === 0) {
        await refreshTokenBundle();
        resetTokensCssCache();
        // The review kit's variables.css names what the build emitted, read from the build's own CSS before and after.
        // A team build is written to a new folder, so the stylesheet after is read from the build now active.
        receipt.emitted = emittedChanges(cssBefore, fs.readFileSync(cssFile(), 'utf8'));
        const cssPath = path.join(runDir, 'variables.css');
        ensureAllowed(cssPath);
        fs.writeFileSync(cssPath, emittedCss(brand, receipt.emitted), 'utf8');
        artifacts.push(cssPath);
        details.push({
          path: cssPath,
          name: 'variables.css',
          purpose: 'The CSS variables the token build emitted differently, under the selectors it writes them in.',
          sha256: sha256File(cssPath),
          sizeBytes: fs.statSync(cssPath).size,
        });
      }
    } else {
      receipt.portable = { sourceWrites: 'skipped', tokenBuild: 'skipped', reason: PORTABLE_APPLY_REASON };
    }
    const diagnostics = {
      brand,
      strategy: requestedStrategy,
      tokensChanged: changeRecords.length,
      themesTouched: Array.from(new Set(changeRecords.map((change) => change.theme))),
      runStarted: startedAt.toISOString(),
      runEnded: new Date().toISOString(),
      receipt,
    };
    const diagnosticsFile = path.join(runDir, 'diagnostics.json');
    ensureAllowed(diagnosticsFile);
    fs.writeFileSync(diagnosticsFile, stringifyStable(diagnostics), 'utf8');
    diagnosticsPath = diagnosticsFile;
    artifacts.push(diagnosticsFile);
    const diagStat = fs.statSync(diagnosticsFile);
    details.push({
      path: diagnosticsFile,
      name: 'diagnostics.json',
      purpose: 'Run diagnostics and build metrics.',
      sha256: sha256File(diagnosticsFile),
      sizeBytes: diagStat.size,
    });
  }

  const transcriptPath = input.apply ? writeTranscript(runDir, {
    tool: 'brand.apply',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
    exitCode: receipt.build?.exitCode ?? 0,
  }) : undefined;
  const bundleIndexPath = transcriptPath ? writeBundleIndex(runDir, [transcriptPath, ...artifacts]) : undefined;

  if (receipt.build && receipt.build.exitCode !== 0) {
    const tail = receipt.build.commands.map(command => command.stdout + command.stderr).join('\n').split('\n').slice(-40).join('\n');
    throw new ToolError('OODS-S019', `Token build failed (exit ${receipt.build.exitCode}); source writes remain in place.\n${tail}`, { receipt, diagnosticsPath, transcriptPath, bundleIndexPath });
  }
  const result = {
    receipt,
    artifacts,
    ...(transcriptPath ? { transcriptPath, bundleIndexPath } : {}),
    diagnosticsPath,
    preview,
    artifactsDetail: details.length ? details : undefined,
  };
  return result;
}
