#!/usr/bin/env tsx
/**
 * Token governance diff — the PR gate that reports what a change did to the token graph.
 *
 * ── s169 m03: WHY THIS FILE WAS RESTRUCTURED ──
 * The gate reported **Δ0** for a sprint that modified 63 brand-A token leaves. Two
 * independent defects, both measured:
 *
 *   1. COLLIDING MAP KEYS. The flat map was keyed by dotted token PATH alone. 1140
 *      (file, path) leaf pairs across the source tree collapse into 727 unique paths —
 *      **413 shadowed pairs across 280 collided paths**. Whichever file was walked last
 *      won, so a real edit in one file was erased by an unrelated file declaring the same
 *      path. This was never brand-specific: root `tokens/base.json` shadowed 39 entries of
 *      `base/reference/*`, `tokens/semantic/system.json` shadowed 53 of `base/system/*`,
 *      and `tokens/theme.json` shadowed 53 each of `themes/dark/*` and `themes/theme0/*`.
 *      Keys are now FILE-SCOPED (`<file>::<path>`), which subsumes brand × theme scoping.
 *
 *   2. A DIST FAST-PATH THAT ONLY EXISTED LOCALLY. `tryLoadDistPayload` special-cased the
 *      literal string `'HEAD'` and read the workspace's built `tokens.json`; for any other
 *      ref it ran `git show <ref>:…dist…`, which ALWAYS failed because `dist/` is
 *      gitignored and has never been tracked. So a local `--head HEAD` diffed
 *      dist-against-sources (235 of its 312 "modified" rows were `{ref}` alias strings vs
 *      resolved literals) while CI — which passes commit SHAs for BOTH refs (ci.yml:290-296)
 *      — diffed sources against sources. The two answers disagreed on identical content.
 *      The fast-path is DELETED and every ref, including `HEAD`, now goes through git.
 *
 * TRADE, DISCLOSED: uncommitted local edits are now invisible to a local run, because a
 * local run and the CI job take byte-identically the same path. That is the point.
 *
 * ── WHAT WAS DELIBERATELY NOT TOUCHED ──
 * The RISK RULES (`determineRisk`, `determineNamespace`) are byte-unchanged. Making the
 * gate SEE changes and re-tuning what it thinks of them are two different missions, and
 * doing both at once would make neither reviewable. One consequence is immediate and
 * expected: a truthful gate now genuinely demands the `token-change:breaking` label on
 * token-touching PRs, because `text.*`/`surface.*` segments are high-risk by those
 * untouched rules. That is the gate working.
 */

import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { contrastRatio, normaliseColor } from '@oods/a11y-tools';
import Color from 'colorjs.io';
import { createRequire } from 'node:module';

/** s213-m04: the brands are the brand registry's (the brands folder), read once per run. */
const BRANDS: readonly string[] = createRequire(import.meta.url)('../../packages/tokens/scripts/brand-registry.cjs').readBrandRegistry();

const execFile = promisify(execFileCallback);

type Command = 'diff';

type RiskLevel = 'low' | 'medium' | 'high';

type TokenNamespace = 'brand' | 'alias' | 'base' | 'focus' | 'a11y' | 'system';

interface FlatTokenEntry {
  key: string;
  path: string;
  segments: string[];
  value: string | number;
  cssVariable: string | null;
  description: string | null;
  sourceHint: string;
}

interface TokenChange {
  kind: 'added' | 'removed' | 'modified';
  namespace: TokenNamespace;
  path: string;
  key: string;
  cssVariable: string | null;
  valueBefore: string | number | null;
  valueAfter: string | number | null;
  risk: RiskLevel;
  reasons: string[];
  sourceHint: string;
  /** Only set on removals. See `classifyRemoval`. Reporting only — never feeds risk. */
  removalClass?: 'duplicate-removed' | 'plain';
}

interface OrphanFinding {
  path: string;
  cssVariable: string | null;
  namespace: TokenNamespace;
  searchStrings: string[];
  referencesPackages: string[];
  referencesStories: string[];
}

interface LeakFinding {
  path: string;
  cssVariable: string | null;
  searchStrings: string[];
  referencesPackages: string[];
  referencesStories: string[];
}

interface ContrastFinding {
  group: string;
  brand: string;
  foregroundPath: string;
  backgroundPath: string;
  baseRatio: number | null;
  headRatio: number | null;
  delta: number | null;
  foregroundHead: string | null;
  backgroundHead: string | null;
  foregroundBase: string | null;
  backgroundBase: string | null;
}

interface StoryImpact {
  storyPath: string;
  tokens: string[];
}

interface CodeownersFinding {
  path: string;
  sourceHint: string;
  covered: boolean;
  matchingOwner?: string;
}

interface GovernanceReport {
  brand: string;
  baseRef: string;
  headRef: string;
  generatedAt: string;
  labels: string[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    orphans: number;
    leaks: number;
    duplicateRemoved: number;
  };
  changes: {
    added: TokenChange[];
    removed: TokenChange[];
    modified: TokenChange[];
  };
  orphans: OrphanFinding[];
  leaks: LeakFinding[];
  contrast: ContrastFinding[];
  impactedStories: StoryImpact[];
  codeowners: CodeownersFinding[];
  requiresBreakingLabel: boolean;
  hasBreakingLabel: boolean;
}

interface CliOptions {
  command: Command;
  /**
   * s174 m02 — NO DEFAULT. This used to default to 'main', a branch frozen since sprint-95
   * that does not exist in a PR checkout, so the diff resolved nothing, the subprocess died,
   * and the caller reported green over zero reports. An unresolvable default is worse than
   * no default: it makes a broken gate look like a passing one. Resolution now runs in
   * runDiff — explicit --base, else origin/OODS-pro, else a throw that names the flag.
   */
  baseRef?: string;
  headRef: string;
  brand: string;
  jsonPath?: string;
  commentPath?: string;
  labels: string[];
}

interface TokenReferenceHits {
  packages: Set<string>;
  stories: Set<string>;
}

interface CodeownersEntry {
  pattern: string;
  owners: string[];
  regex: RegExp;
}

const PROJECT_ROOT = process.cwd();
const REQUIRE_BREAKING_LABEL = 'token-change:breaking';

const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.sass',
  '.yml',
  '.yaml',
]);

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.husky',
  '.turbo',
  '.idea',
  '.storybook',
  'node_modules',
  'dist',
  'build',
  'storybook-static',
  'coverage',
  'reports',
  'artifacts',
  '__snapshots__',
  'tmp',
  '.next',
]);

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    switch (options.command) {
      case 'diff':
        await runDiff(options);
        break;
      default:
        throw new Error(`Unsupported command: ${options.command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`⚠︎ tokens-governance failed: ${message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.filter((value, index) => !(value === '--' && index === 0));

  if (args.length === 0) {
    throw new Error('Usage: tokens-governance diff --brand <A|B> [--base <ref>] [--head <ref>] [--json <file>] [--comment <file>] [--labels <label1,label2>]');
  }

  let [commandRaw, ...rest] = args;

  while (commandRaw === '--' && rest.length > 0) {
    [commandRaw, ...rest] = rest;
  }

  const command = commandRaw as Command;
  if (command !== 'diff') {
    throw new Error(`Unsupported command: ${commandRaw}`);
  }

  const options: CliOptions = {
    command,
    headRef: 'HEAD',
    brand: '',
    labels: [],
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const flag = token.slice(2);
    const next = rest[index + 1];

    switch (flag) {
      case 'base':
        ensureValue(flag, next);
        options.baseRef = next;
        index += 1;
        break;
      case 'head':
        ensureValue(flag, next);
        options.headRef = next;
        index += 1;
        break;
      case 'brand':
        ensureValue(flag, next);
        options.brand = BRANDS.find((brand) => brand.toLowerCase() === next.toLowerCase()) ?? '';
        if (!options.brand) {
          throw new Error(`Brand must be one of ${BRANDS.map((brand) => `"${brand}"`).join(', ')} (the brand registry).`);
        }
        index += 1;
        break;
      case 'json':
        ensureValue(flag, next);
        options.jsonPath = path.resolve(PROJECT_ROOT, next);
        index += 1;
        break;
      case 'comment':
        ensureValue(flag, next);
        options.commentPath = path.resolve(PROJECT_ROOT, next);
        index += 1;
        break;
      case 'labels':
        if (next === undefined || next.startsWith('--')) {
          throw new Error(`Expected a value after --${flag}`);
        }
        options.labels = next
          .split(',')
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
        index += 1;
        break;
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
  }

  if (!options.brand) {
    throw new Error('Brand is required (use --brand A or --brand B).');
  }

  return options;
}

function ensureValue(flag: string, value: string | undefined): asserts value {
  if (!value || value.startsWith('--')) {
    throw new Error(`Expected a value after --${flag}`);
  }
}

/**
 * s174 m02 — resolve the base ref, fail-closed.
 *
 * Order: an explicit --base wins; otherwise the repo's real default branch, origin/OODS-pro;
 * otherwise THROW naming the flag. There is deliberately no fallback that "works" without
 * resolving — the whole vacuity this replaces came from a default ref that silently could not
 * be resolved.
 */
const FALLBACK_BASE_REF = 'origin/OODS-pro';

async function resolveBaseRef(explicit: string | undefined): Promise<string> {
  if (explicit) {
    return explicit;
  }
  try {
    await execFile('git', ['rev-parse', '--verify', '--quiet', `${FALLBACK_BASE_REF}^{commit}`], {
      cwd: PROJECT_ROOT,
    });
    return FALLBACK_BASE_REF;
  } catch {
    throw new Error(
      `No --base given and ${FALLBACK_BASE_REF} does not resolve in this checkout. Pass --base <ref> explicitly (in CI, the merge-base of the PR base branch and HEAD).`,
    );
  }
}

async function runDiff(options: CliOptions): Promise<void> {
  const { headRef, brand } = options;
  const baseRef = await resolveBaseRef(options.baseRef);

  const [baseTokens, headTokens] = await Promise.all([
    loadFlatTokens(baseRef),
    loadFlatTokens(headRef),
  ]);

  const baseFiltered = filterTokensForBrand(baseTokens, brand);
  const headFiltered = filterTokensForBrand(headTokens, brand);

  const diff = computeTokenDiff(baseFiltered, headFiltered);

  const searchTokens = collectTokensForSearch(diff);
  const referenceMap = await findTokenReferences(searchTokens);

  const orphans = identifyOrphans(diff.changes.added, referenceMap);
  const leaks = identifyLeaks(diff.changes.removed, referenceMap);
  const impactedStories = collectImpactedStories(referenceMap, diff);
  const contrast = await computeContrastDeltas(diff, baseTokens, headTokens, brand);

  const codeownersEntries = await loadCodeowners();
  const codeownersFindings = evaluateCodeowners(diff, codeownersEntries);

  const hasBreakingLabel = options.labels.some(
    (label) => label.toLowerCase() === REQUIRE_BREAKING_LABEL,
  );
  const requiresBreakingLabel = diff.summary.highRisk > 0;

  if (requiresBreakingLabel && !hasBreakingLabel) {
    process.exitCode = 1;
  }

  const report: GovernanceReport = {
    brand,
    baseRef,
    headRef,
    generatedAt: new Date().toISOString(),
    labels: options.labels,
    summary: {
      ...diff.summary,
      orphans: orphans.length,
      leaks: leaks.length,
    },
    changes: diff.changes,
    orphans,
    leaks,
    contrast,
    impactedStories,
    codeowners: codeownersFindings,
    requiresBreakingLabel,
    hasBreakingLabel,
  };

  renderConsoleSummary(report);

  if (options.jsonPath) {
    await writeJsonReport(options.jsonPath, report);
  }

  if (options.commentPath) {
    await writeComment(options.commentPath, report);
  }
}

/**
 * EVERY ref goes through git — `HEAD` included. See the dist fast-path note in the file
 * header for what this replaced and why the two code paths had to become one.
 */
export async function loadFlatTokens(ref: string): Promise<Map<string, FlatTokenEntry>> {
  const filePaths = await listSourceFilesFromGit(ref);
  const result = new Map<string, FlatTokenEntry>();

  for (const filePath of filePaths) {
    const content = await loadFileFromGit(ref, filePath);
    try {
      const parsed = JSON.parse(content) as DtcgNode;
      collectDtcgTokens(parsed, [], {
        tokens: result,
        filePath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse ${filePath} at ${ref}: ${message}`);
    }
  }

  return result;
}

type DtcgNode = Record<string, unknown>;

/**
 * The map key. FILE-SCOPED so two files declaring the same dotted path are two entries
 * rather than one silently overwriting the other — the defect that produced Δ0.
 *
 * `entry.path`, `entry.key` and `entry.cssVariable` stay UNSCOPED on purpose:
 * `buildSearchStrings` greps the codebase with them, and `packages/…/x.json::color.brand.A…`
 * matches nothing on disk. The scope belongs to the map, not to the token's identity.
 */
export function scopedTokenKey(filePath: string, tokenPath: string): string {
  return `${filePath}::${tokenPath}`;
}

interface CollectState {
  tokens: Map<string, FlatTokenEntry>;
  filePath: string;
}

/**
 * THE UNIVERSE, ALIGNED WITH THE BUILD (s169 m03).
 *
 * The gate used to walk `packages/tokens/src` AND the repo-root `tokens/` directory, but
 * `packages/tokens/scripts/build.mjs` reads NEITHER root-`tokens/` nor `src/presets/`.
 * Governing files the build never compiles produced two kinds of noise: root `tokens/`
 * supplied most of the shadowing described in the file header, and the presets collided
 * with `brands/A` on 21 paths. Narrowing to what actually ships is a scope correction, not
 * a loosening — nothing the build consumes left the universe.
 */
const SOURCE_DIRECTORIES = ['packages/tokens/src'];
const EXCLUDED_SOURCE_PREFIXES = ['packages/tokens/src/presets/'];
const MAX_TOKEN_DEPTH = 32;

export function isGovernedSourceFile(filePath: string): boolean {
  if (!filePath.endsWith('.json')) {
    return false;
  }
  if (!SOURCE_DIRECTORIES.some((directory) => filePath.startsWith(`${directory}/`))) {
    return false;
  }
  return !EXCLUDED_SOURCE_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

export function collectDtcgTokens(
  node: DtcgNode,
  trail: string[],
  state: CollectState,
  depth = 0,
): void {
  if (depth > MAX_TOKEN_DEPTH) {
    throw new Error(`Exceeded maximum token depth in ${state.filePath}`);
  }

  for (const [key, rawValue] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const nested = rawValue as Record<string, unknown>;
      if (isTokenLeaf(nested)) {
        const tokenPath = [...trail, key];
        const valueRaw = nested.$value;
        let value: string | number;
        if (typeof valueRaw === 'string' || typeof valueRaw === 'number') {
          value = valueRaw;
        } else if (valueRaw && typeof valueRaw === 'object') {
          value = JSON.stringify(valueRaw);
        } else {
          throw new Error(`Unsupported token value type in ${tokenPath.join('.')} from ${state.filePath}`);
        }

        const slug = slugSegments(tokenPath);

        const entry: FlatTokenEntry = {
          key: slug,
          path: tokenPath.join('.'),
          segments: tokenPath,
          value,
          cssVariable: `--oods-${slug}`,
          description: typeof nested.$description === 'string' ? nested.$description : null,
          sourceHint: state.filePath,
        };

        state.tokens.set(scopedTokenKey(state.filePath, entry.path), entry);
      } else {
        collectDtcgTokens(nested as DtcgNode, [...trail, key], state, depth + 1);
      }
    }
  }
}

function isTokenLeaf(node: Record<string, unknown>): node is { $value: string | number } {
  return Object.prototype.hasOwnProperty.call(node, '$value');
}

function slugSegments(segments: readonly string[]): string {
  return segments
    .map((segment) =>
      segment
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase(),
    )
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function listSourceFilesFromGit(ref: string): Promise<string[]> {
  const args = ['ls-tree', '-r', ref, '--name-only', '--', ...SOURCE_DIRECTORIES];
  const { stdout } = await execFile('git', args, {
    cwd: PROJECT_ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => isGovernedSourceFile(line))
    .sort();
}

async function loadFileFromGit(ref: string, filePath: string): Promise<string> {
  const { stdout } = await execFile('git', ['show', `${ref}:${filePath}`], {
    cwd: PROJECT_ROOT,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout;
}

export function filterTokensForBrand(map: Map<string, FlatTokenEntry>, brand: string): Map<string, FlatTokenEntry> {
  // A brand segment is a registry id, spelled as the brands folder spells it; the requested brand matches in any case.
  const target = BRANDS.find((id) => id.toLowerCase() === brand.toLowerCase()) ?? brand;
  const brandIds = new Set(BRANDS);
  const result = new Map<string, FlatTokenEntry>();

  for (const [mapKey, entry] of map.entries()) {
    const containsBrandToken = entry.segments.some((segment) => brandIds.has(segment));
    if (containsBrandToken) {
      if (entry.segments.includes(target)) {
        result.set(mapKey, entry);
      }
    } else {
      result.set(mapKey, entry);
    }
  }

  return result;
}

/**
 * DUPLICATE-REMOVED vs PLAIN REMOVED (s169 m03).
 *
 * File-scoped keys make removals legible for the first time, and immediately show that two
 * very different events were being reported identically. A path can disappear from one file
 * while an IDENTICAL path/value pair still exists in another — a de-duplication, where
 * nothing a consumer resolves has changed. That is not the same event as a value vanishing
 * from the graph entirely, and a reviewer reading "39 removed" deserves to know which.
 *
 * MEASURED on the acceptance range: of 39 brand-A removals, exactly **18** are
 * duplicate-removed (`brands/A` `ref.typography.*` entries that survive elsewhere at head).
 * The other 21 — 19 from `base/motion.json`, 2 from `base/shadow.json`, both files deleted
 * in that range — carried `{alias}` string values that survive NOWHERE at head, so they are
 * plain removals. A classifier answering 39/39 or 21/39 is wrong in a way this comment
 * exists to make catchable.
 *
 * Classification is REPORTING ONLY: it does not touch `determineRisk`.
 */
export function classifyRemoval(
  removedEntry: FlatTokenEntry,
  headMap: Map<string, FlatTokenEntry>,
): 'duplicate-removed' | 'plain' {
  for (const survivor of headMap.values()) {
    if (
      survivor.path === removedEntry.path &&
      survivor.sourceHint !== removedEntry.sourceHint &&
      areTokenValuesEqual(survivor.value, removedEntry.value)
    ) {
      return 'duplicate-removed';
    }
  }
  return 'plain';
}

export function computeTokenDiff(
  baseMap: Map<string, FlatTokenEntry>,
  headMap: Map<string, FlatTokenEntry>,
): {
  summary: {
    added: number;
    removed: number;
    modified: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    duplicateRemoved: number;
  };
  changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] };
} {
  const added: TokenChange[] = [];
  const removed: TokenChange[] = [];
  const modified: TokenChange[] = [];

  const processed = new Set<string>();

  for (const [mapKey, headEntry] of headMap.entries()) {
    const baseEntry = baseMap.get(mapKey);
    if (!baseEntry) {
      const change = buildTokenChange('added', null, headEntry);
      added.push(change);
      processed.add(mapKey);
      continue;
    }

    if (!areTokenValuesEqual(baseEntry.value, headEntry.value)) {
      const change = buildTokenChange('modified', baseEntry, headEntry);
      modified.push(change);
    }
    processed.add(mapKey);
  }

  for (const [mapKey, baseEntry] of baseMap.entries()) {
    if (processed.has(mapKey)) {
      continue;
    }
    const change = buildTokenChange('removed', baseEntry, null);
    change.removalClass = classifyRemoval(baseEntry, headMap);
    removed.push(change);
  }

  const summary = buildSummary(added, removed, modified);

  return {
    summary,
    changes: {
      added,
      removed,
      modified,
    },
  };
}

function areTokenValuesEqual(a: string | number, b: string | number): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  return String(a).trim() === String(b).trim();
}

function buildTokenChange(
  kind: TokenChange['kind'],
  baseEntry: FlatTokenEntry | null,
  headEntry: FlatTokenEntry | null,
): TokenChange {
  const reference = headEntry ?? baseEntry;
  if (!reference) {
    throw new Error('Unable to build token change without reference entry.');
  }

  const namespace = determineNamespace(reference.segments);
  const { risk, reasons } = determineRisk(namespace, reference.segments);

  return {
    kind,
    namespace,
    path: reference.path,
    key: reference.key,
    cssVariable: reference.cssVariable,
    valueBefore: baseEntry?.value ?? null,
    valueAfter: headEntry?.value ?? null,
    risk,
    reasons,
    sourceHint: reference.sourceHint,
  };
}

function buildSummary(
  added: TokenChange[],
  removed: TokenChange[],
  modified: TokenChange[],
): {
  added: number;
  removed: number;
  modified: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  duplicateRemoved: number;
} {
  const counts = { added: added.length, removed: removed.length, modified: modified.length };
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;

  const all = [...added, ...removed, ...modified];
  for (const entry of all) {
    if (entry.risk === 'high') {
      highRisk += 1;
    } else if (entry.risk === 'medium') {
      mediumRisk += 1;
    } else {
      lowRisk += 1;
    }
  }

  const duplicateRemoved = removed.filter((entry) => entry.removalClass === 'duplicate-removed').length;

  return { ...counts, highRisk, mediumRisk, lowRisk, duplicateRemoved };
}

function determineNamespace(segments: readonly string[]): TokenNamespace {
  if (segments.includes('focus')) {
    return 'focus';
  }

  if (segments[0] === 'brand') {
    return 'alias';
  }

  if (segments[0] === 'color' && segments[1] === 'brand') {
    return 'brand';
  }

  if (segments.includes('a11y')) {
    return 'a11y';
  }

  if (['theme', 'ref', 'sys'].includes(segments[0])) {
    return 'base';
  }

  return 'system';
}

function determineRisk(namespace: TokenNamespace, segments: readonly string[]): {
  risk: RiskLevel;
  reasons: string[];
} {
  let risk: RiskLevel = 'low';
  const reasons: string[] = [];

  const lowered = segments.map((segment) => segment.toLowerCase());
  const isFocus = namespace === 'focus' || lowered.includes('focus');
  const affectsForeground = lowered.includes('foreground') || lowered.includes('text');
  const affectsBackground = lowered.includes('background') || lowered.includes('surface');

  if (isFocus) {
    risk = 'high';
    reasons.push('focus token change');
  }

  if (affectsForeground || affectsBackground) {
    risk = elevateRisk(risk, 'high');
    reasons.push('foreground/background impact');
  }

  if (namespace === 'base' || namespace === 'a11y') {
    risk = elevateRisk(risk, 'high');
    reasons.push('protected namespace change');
  }

  if (risk === 'low' && namespace === 'brand') {
    risk = 'medium';
    reasons.push('brand color change');
  }

  return { risk, reasons };
}

function elevateRisk(current: RiskLevel, candidate: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['low', 'medium', 'high'];
  return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
}

function collectTokensForSearch(diff: {
  changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] };
}) {
  const tokens = new Map<string, { cssVariable: string | null; key: string; namespace: TokenNamespace }>();
  const collect = (entry: TokenChange) => {
    if (!tokens.has(entry.path)) {
      tokens.set(entry.path, {
        cssVariable: entry.cssVariable,
        key: entry.key,
        namespace: entry.namespace,
      });
    }
  };

  [...diff.changes.added, ...diff.changes.removed, ...diff.changes.modified].forEach(collect);

  return tokens;
}

async function findTokenReferences(
  tokens: Map<string, { cssVariable: string | null; key: string; namespace: TokenNamespace }>,
): Promise<Map<string, TokenReferenceHits>> {
  const files = await collectSearchFiles();
  const referenceMap = new Map<string, TokenReferenceHits>();

  const tokenPatterns: Array<{ path: string; patterns: string[] }> = [];
  for (const [tokenPath, details] of tokens.entries()) {
    const patterns = new Set<string>();
    patterns.add(tokenPath);
    if (details.cssVariable) {
      patterns.add(details.cssVariable);
      patterns.add(details.cssVariable.replace(/^--oods-/, '--'));
    }
    patterns.add(details.key);
    tokenPatterns.push({
      path: tokenPath,
      patterns: Array.from(patterns),
    });
    referenceMap.set(tokenPath, { packages: new Set(), stories: new Set() });
  }

  for (const file of files) {
    const content = await fs.readFile(file.filePath, 'utf8');
    for (const token of tokenPatterns) {
      const ref = referenceMap.get(token.path);
      if (!ref) {
        continue;
      }

      for (const pattern of token.patterns) {
        if (content.includes(pattern)) {
          if (file.category === 'stories') {
            ref.stories.add(file.relativePath);
          } else {
            ref.packages.add(file.relativePath);
          }
          break;
        }
      }
    }
  }

  return referenceMap;
}

interface SearchFileEntry {
  filePath: string;
  relativePath: string;
  category: 'packages' | 'stories';
}

async function collectSearchFiles(): Promise<SearchFileEntry[]> {
  const roots: Array<{ root: string; category: 'packages' | 'stories' }> = [
    { root: path.resolve(PROJECT_ROOT, 'packages'), category: 'packages' },
    { root: path.resolve(PROJECT_ROOT, 'src/stories'), category: 'stories' },
  ];

  const entries: SearchFileEntry[] = [];

  for (const { root, category } of roots) {
    try {
      await traverse(root, category, entries);
    } catch (error) {
      // Ignore missing directories (e.g., src/stories may not exist in all worktrees)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return entries;
}

async function traverse(
  currentPath: string,
  category: 'packages' | 'stories',
  entries: SearchFileEntry[],
  relativeBase = currentPath,
): Promise<void> {
  const stat = await fs.stat(currentPath);
  if (!stat.isDirectory()) {
    return;
  }

  const dirEntries = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of dirEntries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || entry.name === '__fixtures__') {
        continue;
      }
      await traverse(entryPath, category, entries, relativeBase);
    } else if (entry.isFile()) {
      const extension = path.extname(entry.name);
      if (!TEXT_FILE_EXTENSIONS.has(extension)) {
        continue;
      }

      const relativePath = path.relative(PROJECT_ROOT, entryPath);
      entries.push({
        filePath: entryPath,
        relativePath,
        category,
      });
    }
  }
}

/**
 * DEDUPED BY PATH (s169 m03). File-scoped keys mean the same dotted path can now produce
 * several changes — one per declaring file. But an orphan/leak finding is a statement about
 * whether the CODEBASE references that path, and `findTokenReferences` greps by the
 * unscoped path, so every copy would yield a byte-identical finding. Reporting the same
 * "unreferenced token" three times is noise that makes a real list look bigger than it is.
 */
function identifyOrphans(changes: TokenChange[], references: Map<string, TokenReferenceHits>): OrphanFinding[] {
  const orphans: OrphanFinding[] = [];
  const seenPaths = new Set<string>();
  for (const change of changes) {
    if (change.namespace !== 'brand' && change.namespace !== 'alias') {
      continue;
    }
    if (seenPaths.has(change.path)) {
      continue;
    }
    const hits = references.get(change.path);
    if (!hits || (hits.packages.size === 0 && hits.stories.size === 0)) {
      const searchStrings = buildSearchStrings(change);
      seenPaths.add(change.path);
      orphans.push({
        path: change.path,
        cssVariable: change.cssVariable,
        namespace: change.namespace,
        searchStrings,
        referencesPackages: [],
        referencesStories: [],
      });
    }
  }
  return orphans;
}

/** Deduped by path for the same reason as `identifyOrphans` — see there. */
function identifyLeaks(changes: TokenChange[], references: Map<string, TokenReferenceHits>): LeakFinding[] {
  const leaks: LeakFinding[] = [];
  const seenPaths = new Set<string>();
  for (const change of changes) {
    if (change.namespace !== 'brand' && change.namespace !== 'alias') {
      continue;
    }
    if (seenPaths.has(change.path)) {
      continue;
    }
    const hits = references.get(change.path);
    if (!hits) {
      continue;
    }
    if (hits.packages.size > 0 || hits.stories.size > 0) {
      seenPaths.add(change.path);
      leaks.push({
        path: change.path,
        cssVariable: change.cssVariable,
        searchStrings: buildSearchStrings(change),
        referencesPackages: Array.from(hits.packages).sort(),
        referencesStories: Array.from(hits.stories).sort(),
      });
    }
  }
  return leaks;
}

function collectImpactedStories(
  references: Map<string, TokenReferenceHits>,
  diff: { changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] } },
): StoryImpact[] {
  const impacts = new Map<string, Set<string>>();

  const allTokens = [...diff.changes.added, ...diff.changes.removed, ...diff.changes.modified];
  for (const token of allTokens) {
    const hits = references.get(token.path);
    if (!hits) {
      continue;
    }

    for (const story of hits.stories) {
      if (!impacts.has(story)) {
        impacts.set(story, new Set());
      }
      impacts.get(story)?.add(token.path);
    }
  }

  return Array.from(impacts.entries())
    .map(([storyPath, tokens]) => ({
      storyPath,
      tokens: Array.from(tokens).sort(),
    }))
    .sort((a, b) => a.storyPath.localeCompare(b.storyPath));
}

function buildSearchStrings(change: TokenChange): string[] {
  const result = new Set<string>();
  result.add(change.path);
  result.add(change.key);
  if (change.cssVariable) {
    result.add(change.cssVariable);
    result.add(change.cssVariable.replace(/^--oods-/, '--'));
  }
  return Array.from(result);
}

export async function computeContrastDeltas(
  diff: {
    changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] };
  },
  baseTokens: Map<string, FlatTokenEntry>,
  headTokens: Map<string, FlatTokenEntry>,
  brand: string,
): Promise<ContrastFinding[]> {
  // SCOPED, like the map key: a change in `brands/A/base.json` must not mark the
  // same-named token in `brands/A/dark.json` as changed. Before file-scoping there was no
  // way to tell them apart, so this set could not have been anything else.
  const changedKeys = new Set<string>();
  const allChanges = [...diff.changes.added, ...diff.changes.removed, ...diff.changes.modified];
  allChanges.forEach((change) => changedKeys.add(scopedTokenKey(change.sourceHint, change.path)));

  const groups = new Map<string, {
    foregroundHead?: FlatTokenEntry;
    backgroundHead?: FlatTokenEntry;
    foregroundBase?: FlatTokenEntry;
    backgroundBase?: FlatTokenEntry;
  }>();

  const considerToken = (token: FlatTokenEntry, ref: 'base' | 'head') => {
    if (!token) {
      return;
    }
    if (!isTokenEligibleForContrast(token, brand)) {
      return;
    }

    const role = deriveRole(token.segments);
    if (!role) {
      return;
    }

    // CELL-SCOPED (s169 m03). Grouping by dot-prefix alone put `brands/A/base.json`'s
    // `…status.info.text` and `brands/A/dark.json`'s into the SAME group, so a foreground
    // from one cell could be contrast-checked against a background from another — a ratio
    // no rendered surface ever shows. The source file is what distinguishes a cell.
    const groupKey = `${token.sourceHint}::${token.segments.slice(0, -1).join('.')}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {});
    }
    const group = groups.get(groupKey)!;
    if (ref === 'head') {
      if (role === 'foreground') {
        group.foregroundHead = token;
      } else {
        group.backgroundHead = token;
      }
    } else {
      if (role === 'foreground') {
        group.foregroundBase = token;
      } else {
        group.backgroundBase = token;
      }
    }
  };

  for (const token of headTokens.values()) {
    if (changedKeys.has(scopedTokenKey(token.sourceHint, token.path))) {
      considerToken(token, 'head');
    }
  }

  for (const token of baseTokens.values()) {
    if (changedKeys.has(scopedTokenKey(token.sourceHint, token.path))) {
      considerToken(token, 'base');
    }
  }

  const findings: ContrastFinding[] = [];

  for (const [groupKey, entry] of groups.entries()) {
    if (!entry.foregroundHead || !entry.backgroundHead) {
      continue;
    }

    const brandSegment = entry.foregroundHead.segments.find((segment) => segment.length === 1 && /[A-Z]/.test(segment));
    const brandLabel = brandSegment ?? brand;

    const foregroundHeadColor = resolveColor(entry.foregroundHead.value, entry.foregroundHead.key);
    const backgroundHeadColor = resolveColor(entry.backgroundHead.value, entry.backgroundHead.key);
    const foregroundBaseColor = entry.foregroundBase ? resolveColor(entry.foregroundBase.value, entry.foregroundBase.key) : null;
    const backgroundBaseColor = entry.backgroundBase ? resolveColor(entry.backgroundBase.value, entry.backgroundBase.key) : null;

    const headRatio = computeContrastSafe(foregroundHeadColor, backgroundHeadColor);
    const baseRatio = foregroundBaseColor && backgroundBaseColor
      ? computeContrastSafe(foregroundBaseColor, backgroundBaseColor)
      : null;

    const delta = baseRatio !== null && headRatio !== null ? headRatio - baseRatio : null;

    findings.push({
      group: groupKey,
      brand: brandLabel,
      foregroundPath: entry.foregroundHead.path,
      backgroundPath: entry.backgroundHead.path,
      baseRatio,
      headRatio,
      delta,
      foregroundHead: foregroundHeadColor,
      backgroundHead: backgroundHeadColor,
      foregroundBase: foregroundBaseColor,
      backgroundBase: backgroundBaseColor,
    });
  }

  return findings.sort((a, b) => a.group.localeCompare(b.group));
}

function isTokenEligibleForContrast(token: FlatTokenEntry, brand: string): boolean {
  const segments = token.segments;
  const last = segments[segments.length - 1]?.toLowerCase();
  if (!['text', 'foreground', 'surface', 'background'].includes(last ?? '')) {
    return false;
  }
  const brandLetters = new Set(BRANDS);
  if (segments.some((segment) => brandLetters.has(segment))) {
    return segments.includes(brand);
  }
  return true;
}

function deriveRole(segments: readonly string[]): 'foreground' | 'background' | null {
  const last = segments[segments.length - 1]?.toLowerCase();
  if (last === 'text' || last === 'foreground') {
    return 'foreground';
  }
  if (last === 'surface' || last === 'background') {
    return 'background';
  }
  return null;
}

function resolveColor(value: string | number, key: string): string | null {
  if (typeof value === 'number') {
    return null;
  }
  try {
    return normaliseColor(value, key);
  } catch {
    try {
      const colour = new Color(value);
      return colour.to('srgb').toString({ format: 'hex', collapse: false }).toUpperCase();
    } catch {
      return null;
    }
  }
}

function computeContrastSafe(foreground: string | null, background: string | null): number | null {
  if (!foreground || !background) {
    return null;
  }
  try {
    return Number(contrastRatio(foreground, background).toFixed(2));
  } catch {
    return null;
  }
}

async function loadCodeowners(): Promise<CodeownersEntry[]> {
  const codeownersPath = path.resolve(PROJECT_ROOT, '.github/CODEOWNERS');
  const entries: CodeownersEntry[] = [];

  try {
    const content = await fs.readFile(codeownersPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#')) {
        continue;
      }
      const [pattern, ...owners] = trimmed.split(/\s+/);
      if (!pattern || owners.length === 0) {
        continue;
      }
      entries.push({
        pattern,
        owners,
        regex: patternToRegex(pattern),
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries;
}

function evaluateCodeowners(
  diff: { changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] } },
  entries: CodeownersEntry[],
): CodeownersFinding[] {
  const findings: CodeownersFinding[] = [];
  const all = [...diff.changes.added, ...diff.changes.removed, ...diff.changes.modified];

  for (const change of all) {
    const subject = change.sourceHint || change.path;
    const match = entries.find((entry) => entry.regex.test(subject));
    findings.push({
      path: change.path,
      sourceHint: subject,
      covered: Boolean(match),
      matchingOwner: match ? `${match.pattern} -> ${match.owners.join(',')}` : undefined,
    });
  }

  return findings;
}

function patternToRegex(pattern: string): RegExp {
  let expression = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  if (expression.startsWith('/')) {
    expression = `^${expression.slice(1)}$`;
  } else {
    expression = `(^|/)${expression}$`;
  }

  return new RegExp(expression);
}

function renderConsoleSummary(report: GovernanceReport): void {
  const summaryLines = [
    `Token Governance (Brand ${report.brand})`,
    `  base: ${report.baseRef}  →  head: ${report.headRef}`,
    `  changes: +${report.summary.added} / -${report.summary.removed} / Δ${report.summary.modified}`,
    `  removals: ${report.summary.duplicateRemoved} duplicate-removed / ` +
      `${report.summary.removed - report.summary.duplicateRemoved} plain`,
    `  risk: high=${report.summary.highRisk} medium=${report.summary.mediumRisk} low=${report.summary.lowRisk}`,
    `  orphans: ${report.summary.orphans}  leaks: ${report.summary.leaks}`,
  ];

  if (report.requiresBreakingLabel) {
    const labelNote = report.hasBreakingLabel
      ? 'breaking label present'
      : `missing required label "${REQUIRE_BREAKING_LABEL}"`;
    summaryLines.push(`  label: ${labelNote}`);
  }

  console.log(summaryLines.join('\n'));

  if (report.contrast.length > 0) {
    console.log('\nContrast deltas:');
    for (const entry of report.contrast) {
      const base = entry.baseRatio !== null ? `${entry.baseRatio.toFixed(2)}:1` : '—';
      const head = entry.headRatio !== null ? `${entry.headRatio.toFixed(2)}:1` : '—';
      const delta = entry.delta !== null ? entry.delta.toFixed(2) : '—';
      console.log(
        `  ${entry.group} · brand ${entry.brand} · base ${base} → head ${head} (Δ ${delta})`,
      );
    }
  }

  if (report.summary.highRisk > 0) {
    console.log('\nHigh-risk tokens:');
    const highRiskTokens = [...report.changes.added, ...report.changes.removed, ...report.changes.modified]
      .filter((token) => token.risk === 'high');
    for (const token of highRiskTokens) {
      console.log(`  ${token.kind.toUpperCase()} ${token.path} (${token.reasons.join(', ')})`);
    }
  }
}

async function writeJsonReport(targetPath: string, report: GovernanceReport): Promise<void> {
  const payload = JSON.stringify(report, null, 2);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${payload}\n`, 'utf8');
}

async function writeComment(targetPath: string, report: GovernanceReport): Promise<void> {
  const lines: string[] = [];
  lines.push(`## Token Governance — Brand ${report.brand}`);
  lines.push('');
  lines.push(`Refs: \`${report.baseRef}\` → \`${report.headRef}\``);
  lines.push('');
  lines.push(
    [
      `• Changes: +${report.summary.added} / -${report.summary.removed} / Δ${report.summary.modified}`,
      // The split belongs in the PR comment, not just the console: the comment is what a
      // reviewer actually reads, and "-39" means something different when 18 of them are
      // de-duplications that changed nothing a consumer resolves.
      `• Removals: ${report.summary.duplicateRemoved} duplicate-removed, ` +
        `${report.summary.removed - report.summary.duplicateRemoved} plain`,
      `• Risk: high ${report.summary.highRisk}, medium ${report.summary.mediumRisk}, low ${report.summary.lowRisk}`,
      `• Orphans: ${report.summary.orphans}`,
      `• Leaks: ${report.summary.leaks}`,
    ].join(' · '),
  );

  if (report.summary.highRisk > 0) {
    const list = [...report.changes.added, ...report.changes.removed, ...report.changes.modified]
      .filter((token) => token.risk === 'high')
      .map((token) => `- \`${token.path}\` (${token.kind}; ${token.reasons.join(', ')})`);
    lines.push('');
    lines.push('### High-Risk Tokens');
    lines.push(...list);
  }

  if (report.impactedStories.length > 0) {
    lines.push('');
    lines.push('### Impacted Stories');
    for (const impact of report.impactedStories) {
      lines.push(`- \`${impact.storyPath}\` → ${impact.tokens.map((token) => `\`${token}\``).join(', ')}`);
    }
  }

  if (report.requiresBreakingLabel) {
    lines.push('');
    if (report.hasBreakingLabel) {
      lines.push(`✅ Label \`${REQUIRE_BREAKING_LABEL}\` present; CI may proceed.`);
    } else {
      lines.push(`⚠️ Add the \`${REQUIRE_BREAKING_LABEL}\` label to acknowledge high-risk token changes.`);
    }
  }

  if (report.contrast.length > 0) {
    lines.push('');
    lines.push('### Contrast Deltas');
    for (const entry of report.contrast) {
      const base = entry.baseRatio !== null ? `${entry.baseRatio.toFixed(2)}:1` : '—';
      const head = entry.headRatio !== null ? `${entry.headRatio.toFixed(2)}:1` : '—';
      const delta = entry.delta !== null ? entry.delta.toFixed(2) : '—';
      lines.push(
        `- \`${entry.group}\` (brand ${entry.brand}): base ${base} → head ${head} (Δ ${delta})`,
      );
    }
  }

  if (report.codeowners.length > 0) {
    const uncovered = report.codeowners.filter((entry) => !entry.covered);
    if (uncovered.length > 0) {
      lines.push('');
      lines.push('### CODEOWNERS Coverage');
      lines.push(
        ...uncovered.map(
          (entry) =>
            `- ⚠️ \`${entry.path}\` (${entry.sourceHint}) not covered by CODEOWNERS patterns`,
        ),
      );
    }
  }

  const comment = `${lines.join('\n')}\n`;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, comment, 'utf8');
}

/**
 * ENTRY GUARD (s169 m03). This used to be a bare top-level `await main()`, which meant
 * `import`ing the module RAN THE CLI — so the pure functions above could not be unit-tested
 * at all. That is why a tool whose entire job is policing token changes shipped with zero
 * tests. CLI behaviour is byte-identical: invoked as a script, `process.argv[1]` is this
 * file and `main()` runs exactly as before.
 */
const invokedPath = process.argv[1];
// s176 m04 (#1250 — decision #1506's carried edge): compare REAL paths, not lexical ones.
// The package bin table maps `tokens-governance` to this file, and a bin shim is a
// SYMLINK — invoked through it, argv[1] carries the symlink path, so the s169 lexical
// path.resolve comparison misses and the CLI silently no-ops. realpath resolves the
// symlink; the catch falls back to the lexical resolve (argv[1] may name nothing on
// disk under embedding), preserving the s169 semantics for every non-symlink case.
const realOrResolvedPath = (candidate: string): string => {
  try {
    return realpathSync(candidate);
  } catch {
    return path.resolve(candidate);
  }
};
const isDirectInvocation =
  typeof invokedPath === 'string' &&
  realOrResolvedPath(fileURLToPath(import.meta.url)) === realOrResolvedPath(invokedPath);

if (isDirectInvocation || pathToFileURL(invokedPath ?? '').href === import.meta.url) {
  await main();
}
