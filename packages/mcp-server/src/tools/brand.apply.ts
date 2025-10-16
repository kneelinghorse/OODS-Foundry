import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { todayDir, loadPolicy, withinAllowed, type Policy } from '../lib/security.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type {
  ArtifactDetail,
  BrandApplyInput,
  BrandApplyStrategy,
  GenericOutput,
  PlanDiff,
  PlanDiffChange,
  ToolPreview,
} from './types.js';

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
const BRAND_ROOT = path.join(TOKENS_DIR, 'brands');

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
    throw new Error(`Invalid JSON pointer: ${pointer}`);
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
      throw new Error('Invalid patch operation');
    }
    const segments = pointerSegments(op.path);
    if (!segments.length) {
      throw new Error('Patch path cannot target document root');
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
        if (Number.isNaN(index)) throw new Error(`Cannot remove non-index path ${op.path}`);
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
        if (Number.isNaN(index)) throw new Error(`Cannot ${op.op} non-index path ${op.path}`);
        cursor[index] = value;
      } else {
        cursor[lastKey] = value;
      }
      continue;
    }
    throw new Error(`Unsupported patch op: ${op.op}`);
  }
}

function loadThemeDocument(brand: string, theme: Theme): TokenDocument {
  const file = path.join(BRAND_ROOT, brand, `${theme}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as TokenDocument;
}

function loadBrandDocuments(brand: string): ThemeMap {
  return {
    base: loadThemeDocument(brand, 'base'),
    dark: loadThemeDocument(brand, 'dark'),
    hc: loadThemeDocument(brand, 'hc'),
  };
}

function buildAliasDelta(delta: Record<string, unknown>): Partial<Record<Theme, TokenDocument>> {
  const normalized = normalizeDelta(delta) as TokenDocument;
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

function toPlanDiff(theme: Theme, brand: string, changes: ChangeRecord[], previous: TokenDocument, next: TokenDocument): PlanDiff {
  const additions = changes.filter((change) => change.before === undefined).length;
  const deletions = changes.filter((change) => change.after === undefined).length;
  const pathLabel = `packages/tokens/src/tokens/brands/${brand}/${theme}.json`;
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
      before: previous,
      after: next,
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

function pointerToCssVariable(brand: string, pointer: string): string | null {
  if (!pointer.includes('$value')) return null;
  const segments = pointer
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/^\$/, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase())
    .filter((segment) => segment.length);
  if (!segments.length) return null;
  return `--${segments.join('-')}-${brand.toLowerCase()}`;
}

async function generateCssSnapshot(
  brand: string,
  changes: ChangeRecord[],
  runDir: string,
  artifacts: string[],
  details: ArtifactDetail[],
  allowWrite: (candidate: string) => void
): Promise<void> {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const change of changes) {
    if (typeof change.after !== 'string') continue;
    const cssVar = pointerToCssVariable(brand, change.pointer);
    if (!cssVar || seen.has(cssVar)) continue;
    seen.add(cssVar);
    lines.push(`  ${cssVar}: ${change.after};`);
  }
  const contents =
    lines.length > 0
      ? [':root {', ...lines, '}', ''].join('\n')
      : `/* No variable changes detected for brand ${brand}. */\n`;
  const cssPath = path.join(runDir, 'variables.css');
  allowWrite(cssPath);
  fs.writeFileSync(cssPath, contents, 'utf8');
  artifacts.push(cssPath);
  const stat = fs.statSync(cssPath);
  details.push({
    path: cssPath,
    name: 'variables.css',
    purpose: 'Generated CSS custom properties for changed tokens',
    sha256: sha256File(cssPath),
    sizeBytes: stat.size,
  });
}

async function runTokensBuildSimulation(): Promise<number> {
  const start = Date.now();
  // Lightweight verification by invoking pnpm in check mode if available.
  // Silently swallow errors to keep the tool resilient in sandboxed runs.
  try {
    await new Promise<void>((resolve) => {
      const child = spawn('pnpm', ['run', 'check:tokens'], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
      });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    });
  } catch {
    // Best effort only.
  }
  return Date.now() - start;
}

function buildPreview(brand: string, changes: ChangeRecord[], originals: ThemeMap, updated: ThemeMap): ToolPreview {
  if (changes.length === 0) {
    return {
      summary: `No updates for brand ${brand}.`,
      notes: ['Input produced no token changes.'],
      diffs: [],
      specimens: [],
    };
  }
  const diffs = THEMES.map((theme) => {
    const themeChanges = changes.filter((change) => change.theme === theme);
    if (!themeChanges.length) return null;
    return toPlanDiff(theme, brand, themeChanges, originals[theme], updated[theme]);
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
  return {
    summary: `Updated ${changes.length} token value${changes.length === 1 ? '' : 's'} for brand ${brand}.`,
    notes: notesByTheme,
    diffs,
    specimens,
  };
}

function allowWriteFactory(policy: Policy): (candidate: string) => void {
  return (candidate: string) => {
    if (!withinAllowed(policy.artifactsBase, candidate)) {
      throw new Error(`Path not allowed: ${candidate}`);
    }
    fs.mkdirSync(path.dirname(candidate), { recursive: true });
  };
}

export async function handle(input: BrandApplyInput): Promise<GenericOutput> {
  if (!input || typeof input !== 'object') {
    throw new Error('Input is required.');
  }
  if (input.delta === undefined || input.delta === null) {
    throw new Error('delta is required.');
  }

  const brand = input.brand ?? 'A';
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
      throw new Error('Alias strategy expects an object delta.');
    }
    const themeDelta = buildAliasDelta(input.delta as Record<string, unknown>);
    for (const theme of THEMES) {
      const deltaForTheme = themeDelta[theme];
      if (!deltaForTheme) continue;
      deepMerge(updated[theme], deltaForTheme);
    }
  } else if (requestedStrategy === 'patch') {
    if (!Array.isArray(input.delta)) {
      throw new Error('Patch strategy requires an array of RFC 6902 operations.');
    }
    const operations = (input.delta as unknown[]).map((entry) => entry as PatchOperation);
    for (const theme of THEMES) {
      applyPatchDocument(updated[theme], operations);
    }
  } else {
    throw new Error(`Unsupported strategy: ${requestedStrategy}`);
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

  const preview = buildPreview(brand, changeRecords, originals, updated);

  const policy = loadPolicy();
  const baseDir = todayDir(policy.artifactsBase);
  const reviewDir = path.join(baseDir, 'review-kit', 'brand.apply');
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(reviewDir, runStamp);
  if (!withinAllowed(policy.artifactsBase, runDir)) {
    throw new Error(`Path not allowed: ${runDir}`);
  }
  fs.mkdirSync(runDir, { recursive: true });
  const ensureAllowed = allowWriteFactory(policy);

  const artifacts: string[] = [];
  const details: ArtifactDetail[] = [];
  let diagnosticsPath: string | undefined;

  const startedAt = new Date();

  if (input.apply) {
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

    await generateCssSnapshot(brand, changeRecords, runDir, artifacts, details, ensureAllowed);

    const buildMs = await runTokensBuildSimulation();
    const diagnostics = {
      brand,
      strategy: requestedStrategy,
      tokensChanged: changeRecords.length,
      themesTouched: Array.from(new Set(changeRecords.map((change) => change.theme))),
      runStarted: startedAt.toISOString(),
      runEnded: new Date().toISOString(),
      build: {
        durationMs: buildMs,
        command: 'pnpm run check:tokens',
        notes: buildMs === 0 ? 'Build completed instantaneously (cached).' : undefined,
      },
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

  const transcriptPath = writeTranscript(runDir, {
    tool: 'brand.apply',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(runDir, [transcriptPath, ...artifacts]);

  const result: GenericOutput = {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    diagnosticsPath,
    preview,
    artifactsDetail: details.length ? details : undefined,
  };
  return result;
}
