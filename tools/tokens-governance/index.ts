#!/usr/bin/env tsx

import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { contrastRatio, normaliseColor } from '@oods/a11y-tools';
import Color from 'colorjs.io';

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
  baseRef: string;
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
const TOKEN_DIST_PATH = 'packages/tokens/dist/tailwind/tokens.json';
const STATUS_MAP_PATH = 'tokens/maps/saas-billing.status-map.json';
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
    baseRef: 'main',
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
        options.brand = next.toUpperCase();
        if (!['A', 'B'].includes(options.brand)) {
          throw new Error('Brand must be either "A" or "B".');
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
        ensureValue(flag, next);
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

async function runDiff(options: CliOptions): Promise<void> {
  const { baseRef, headRef, brand } = options;

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

async function loadFlatTokens(ref: string): Promise<Map<string, FlatTokenEntry>> {
  const distPayload = await tryLoadDistPayload(ref);
  if (distPayload) {
    return buildFlatTokenMapFromDist(distPayload);
  }

  return loadTokensFromSources(ref);
}

async function tryLoadDistPayload(ref: string): Promise<Record<string, unknown> | null> {
  if (ref === 'HEAD') {
    const headPath = path.resolve(PROJECT_ROOT, TOKEN_DIST_PATH);
    try {
      const raw = await fs.readFile(headPath, 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Fall back to git history if workspace artefact missing.
    }
  }

  try {
    const json = await loadJsonFromGit(ref, TOKEN_DIST_PATH);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
  } catch {
    // Ignore; we will fall back to source files.
  }

  return null;
}

function buildFlatTokenMapFromDist(payload: Record<string, unknown>): Map<string, FlatTokenEntry> {
  const flat = payload.flat;
  if (!flat || typeof flat !== 'object') {
    throw new Error('Malformed token dist payload: missing flat map.');
  }

  const entries = flat as Record<string, FlatTokenRawEntry>;
  const result = new Map<string, FlatTokenEntry>();

  for (const [key, rawEntry] of Object.entries(entries)) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }
    const pathSegments = rawEntry.path;
    if (!Array.isArray(pathSegments) || pathSegments.some((segment) => typeof segment !== 'string')) {
      continue;
    }

    const entry: FlatTokenEntry = {
      key,
      path: pathSegments.join('.'),
      segments: pathSegments,
      value: rawEntry.value,
      cssVariable: rawEntry.cssVariable ?? null,
      description: typeof rawEntry.description === 'string' ? rawEntry.description : null,
      sourceHint: approximateSourceHint(pathSegments),
    };

    result.set(entry.path, entry);
  }

  return result;
}

async function loadTokensFromSources(ref: string): Promise<Map<string, FlatTokenEntry>> {
  const filePaths = ref === 'HEAD'
    ? await listSourceFilesFromWorkspace()
    : await listSourceFilesFromGit(ref);

  const result = new Map<string, FlatTokenEntry>();

  for (const filePath of filePaths) {
    const content = await readSourceFile(ref, filePath);
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

interface FlatTokenRawEntry {
  name?: string;
  value: string | number;
  path: string[];
  cssVariable?: string;
  originalValue?: string | number;
  description?: string;
}

type DtcgNode = Record<string, unknown>;

interface CollectState {
  tokens: Map<string, FlatTokenEntry>;
  filePath: string;
}

const SOURCE_DIRECTORIES = ['packages/tokens/src', 'tokens'];
const MAX_TOKEN_DEPTH = 32;

function collectDtcgTokens(
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

        state.tokens.set(entry.path, entry);
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

async function listSourceFilesFromWorkspace(): Promise<string[]> {
  const files: string[] = [];
  for (const directory of SOURCE_DIRECTORIES) {
    const absolute = path.resolve(PROJECT_ROOT, directory);
    try {
      await walkWorkspaceDirectory(absolute, (filePath) => {
        if (filePath.endsWith('.json')) {
          files.push(path.relative(PROJECT_ROOT, filePath));
        }
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return files.sort();
}

async function walkWorkspaceDirectory(
  currentPath: string,
  onFile: (filePath: string) => void,
): Promise<void> {
  const stats = await fs.stat(currentPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  });
  if (!stats) {
    return;
  }
  if (!stats.isDirectory()) {
    return;
  }

  const contents = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of contents) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || entry.name === '__fixtures__') {
        continue;
      }
      await walkWorkspaceDirectory(entryPath, onFile);
    } else if (entry.isFile()) {
      onFile(entryPath);
    }
  }
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
    .filter((line) => line.endsWith('.json'))
    .sort();
}

async function readSourceFile(ref: string, filePath: string): Promise<string> {
  if (ref === 'HEAD') {
    const absolute = path.resolve(PROJECT_ROOT, filePath);
    return fs.readFile(absolute, 'utf8');
  }
  const content = await loadFileFromGit(ref, filePath);
  return content;
}

async function loadFileFromGit(ref: string, filePath: string): Promise<string> {
  const { stdout } = await execFile('git', ['show', `${ref}:${filePath}`], {
    cwd: PROJECT_ROOT,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout;
}

async function loadJsonFromGit(ref: string, filePath: string): Promise<unknown> {
  try {
    const { stdout } = await execFile('git', ['show', `${ref}:${filePath}`], {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load ${filePath} from ${ref}: ${message}`);
  }
}

function filterTokensForBrand(map: Map<string, FlatTokenEntry>, brand: string): Map<string, FlatTokenEntry> {
  const brandUpper = brand.toUpperCase();
  const brandLetters = new Set(['A', 'B']);
  const result = new Map<string, FlatTokenEntry>();

  for (const [pathString, entry] of map.entries()) {
    const containsBrandToken = entry.segments.some((segment) => brandLetters.has(segment));
    if (containsBrandToken) {
      if (entry.segments.includes(brandUpper)) {
        result.set(pathString, entry);
      }
    } else {
      result.set(pathString, entry);
    }
  }

  return result;
}

function computeTokenDiff(
  baseMap: Map<string, FlatTokenEntry>,
  headMap: Map<string, FlatTokenEntry>,
): {
  summary: { added: number; removed: number; modified: number; highRisk: number; mediumRisk: number; lowRisk: number };
  changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] };
} {
  const added: TokenChange[] = [];
  const removed: TokenChange[] = [];
  const modified: TokenChange[] = [];

  const processed = new Set<string>();

  for (const [path, headEntry] of headMap.entries()) {
    const baseEntry = baseMap.get(path);
    if (!baseEntry) {
      const change = buildTokenChange('added', null, headEntry);
      added.push(change);
      processed.add(path);
      continue;
    }

    if (!areTokenValuesEqual(baseEntry.value, headEntry.value)) {
      const change = buildTokenChange('modified', baseEntry, headEntry);
      modified.push(change);
    }
    processed.add(path);
  }

  for (const [path, baseEntry] of baseMap.entries()) {
    if (processed.has(path)) {
      continue;
    }
    const change = buildTokenChange('removed', baseEntry, null);
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
): { added: number; removed: number; modified: number; highRisk: number; mediumRisk: number; lowRisk: number } {
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

  return { ...counts, highRisk, mediumRisk, lowRisk };
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

function approximateSourceHint(segments: readonly string[]): string {
  const [first, second] = segments;
  if (first === 'brand' && typeof second === 'string') {
    return `packages/tokens/src/tokens/aliases/brand-${second}.json`;
  }
  if (first === 'color' && segments[1] === 'brand' && typeof segments[2] === 'string') {
    return `packages/tokens/src/tokens/brands/${segments[2]}`;
  }
  if (first === 'theme') {
    return 'packages/tokens/src/tokens/theme.json';
  }
  if (first === 'sys') {
    return 'packages/tokens/src/tokens/base/system';
  }
  if (first === 'ref') {
    return 'packages/tokens/src/tokens/base/reference';
  }
  return 'packages/tokens/src/tokens';
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

function identifyOrphans(changes: TokenChange[], references: Map<string, TokenReferenceHits>): OrphanFinding[] {
  const orphans: OrphanFinding[] = [];
  for (const change of changes) {
    if (change.namespace !== 'brand' && change.namespace !== 'alias') {
      continue;
    }
    const hits = references.get(change.path);
    if (!hits || (hits.packages.size === 0 && hits.stories.size === 0)) {
      const searchStrings = buildSearchStrings(change);
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

function identifyLeaks(changes: TokenChange[], references: Map<string, TokenReferenceHits>): LeakFinding[] {
  const leaks: LeakFinding[] = [];
  for (const change of changes) {
    if (change.namespace !== 'brand' && change.namespace !== 'alias') {
      continue;
    }
    const hits = references.get(change.path);
    if (!hits) {
      continue;
    }
    if (hits.packages.size > 0 || hits.stories.size > 0) {
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

async function computeContrastDeltas(
  diff: {
    changes: { added: TokenChange[]; removed: TokenChange[]; modified: TokenChange[] };
  },
  baseTokens: Map<string, FlatTokenEntry>,
  headTokens: Map<string, FlatTokenEntry>,
  brand: string,
): Promise<ContrastFinding[]> {
  const changedPaths = new Set<string>();
  const allChanges = [...diff.changes.added, ...diff.changes.removed, ...diff.changes.modified];
  allChanges.forEach((change) => changedPaths.add(change.path));

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

    const groupKey = token.segments.slice(0, -1).join('.');
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
    if (changedPaths.has(token.path)) {
      considerToken(token, 'head');
    }
  }

  for (const token of baseTokens.values()) {
    if (changedPaths.has(token.path)) {
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
  const brandLetters = new Set(['A', 'B']);
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

await main();
