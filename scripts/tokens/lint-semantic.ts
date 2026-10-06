#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';

type Violation = {
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  reason: string;
};

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const ROOT_DIRECTORIES = ['apps/explorer/src'];
const IGNORE_SUBSTRINGS = [
  `${path.sep}utils`,
  `${path.sep}stories${path.sep}docs`,
  `${path.sep}stories${path.sep}fixtures`
];
const IGNORE_FILES = new Set([
  path.join('apps', 'explorer', 'src', 'styles', 'tokens.css'),
  path.join('apps', 'explorer', 'src', 'styles', 'brand.css'),
  path.join('apps', 'explorer', 'src', 'utils', 'tokenResolver.ts')
]);

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}/g;
const FUNCTION_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'rgb()', regex: /\brgb\s*\(/g },
  { label: 'rgba()', regex: /\brgba\s*\(/g },
  { label: 'hsl()', regex: /\bhsl\s*\(/g },
  { label: 'hsla()', regex: /\bhsla\s*\(/g }
];

// sprint-125 m04: entry-granular baseline of KNOWN literal-colour usages so the
// gate passes on pre-existing debt while still failing on any NEW literal.
const BASELINE_PATH = path.resolve(process.cwd(), 'scripts/tokens/lint-semantic-baseline.json');

type BaselineEntry = { file: string; snippet: string; reason: string };

// Stable identity: file + trimmed source line. Deliberately NOT line/column
// (those drift on edit); a new literal on a new line yields a new snippet and
// is therefore NOT matched, so it still fails.
function baselineKey(filePath: string, snippet: string): string {
  return `${filePath}\u0000${snippet.trim()}`;
}

function baselineReasonFor(filePath: string): string {
  if (filePath.includes('stories')) {
    return 'Literal colour in an explorer proof/demo story preview; pre-existing, baselined sprint-125 m04. New literals still fail.';
  }
  return 'Literal colour used as a var() fallback or color-mix input in an explorer style; pre-existing, baselined sprint-125 m04. New literals still fail.';
}

async function loadBaselineKeys(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(BASELINE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { entries?: BaselineEntry[] };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return new Set(entries.map((e) => baselineKey(e.file, e.snippet)));
  } catch {
    // Missing/unreadable baseline suppresses nothing — the gate stays strict.
    return new Set();
  }
}

async function main(): Promise<void> {
  const writeBaseline = process.argv.slice(2).includes('--write-baseline');
  const files = await collectTargetFiles();
  const violations: Violation[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      scanLineForHex(filePath, line, index, violations);
      scanLineForFunctions(filePath, line, index, violations);
    });
  }

  if (writeBaseline) {
    // Regenerate the committed baseline from ACTUAL output (dedup by stable key).
    const byKey = new Map<string, BaselineEntry>();
    for (const v of violations) {
      const key = baselineKey(v.filePath, v.snippet);
      if (!byKey.has(key)) {
        byKey.set(key, { file: v.filePath, snippet: v.snippet.trim(), reason: baselineReasonFor(v.filePath) });
      }
    }
    const entries = Array.from(byKey.values()).sort(
      (a, b) => a.file.localeCompare(b.file) || a.snippet.localeCompare(b.snippet)
    );
    const payload = {
      note:
        'Entry-granular baseline of KNOWN pre-existing literal-colour usages (sprint-125 m04). Keyed on file+trimmed-snippet (stable, line-independent). A new literal not listed here still fails. Regenerate with: pnpm exec tsx scripts/tokens/lint-semantic.ts --write-baseline',
      entries
    };
    await fs.writeFile(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`✔ Wrote ${entries.length} baseline entr${entries.length === 1 ? 'y' : 'ies'} to ${path.relative(process.cwd(), BASELINE_PATH)}.`);
    return;
  }

  const baseline = await loadBaselineKeys();
  const fresh = violations.filter((v) => !baseline.has(baselineKey(v.filePath, v.snippet)));
  const suppressed = violations.length - fresh.length;

  if (fresh.length > 0) {
    for (const violation of fresh) {
      const location = `${violation.filePath}:${violation.line}:${violation.column}`;
      console.error(`${location}  ${violation.reason}`);
      console.error(`    ${violation.snippet.trim()}`);
    }
    console.error(`\n❌ Found ${fresh.length} NEW literal colour violation(s) (${suppressed} pre-existing suppressed by baseline).`);
    process.exit(1);
  }

  const tail = suppressed > 0 ? ` (${suppressed} pre-existing suppressed by baseline)` : '';
  console.log(`✔ Semantic lint passed (no NEW literal colour usage detected)${tail}.`);
}

async function collectTargetFiles(): Promise<string[]> {
  const files: string[] = [];

  for (const root of ROOT_DIRECTORIES) {
    const absoluteRoot = path.resolve(process.cwd(), root);
    const rootEntries = await readDirectoryRecursive(absoluteRoot);
    files.push(...rootEntries);
  }

  return files;
}

async function readDirectoryRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_SUBSTRINGS.some((ignore) => entryPath.includes(ignore))) {
        continue;
      }
      files.push(...(await readDirectoryRecursive(entryPath)));
    } else if (entry.isFile()) {
      const relative = path.relative(process.cwd(), entryPath);
      if (IGNORE_FILES.has(relative)) {
        continue;
      }
      const ext = path.extname(entry.name);
      if (TARGET_EXTENSIONS.has(ext)) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function scanLineForHex(
  filePath: string,
  line: string,
  index: number,
  violations: Violation[],
): void {
  let match: RegExpExecArray | null;
  HEX_PATTERN.lastIndex = 0;

  while ((match = HEX_PATTERN.exec(line)) !== null) {
    const matchText = match[0];
    const offset = match.index;
    const afterIndex = offset + matchText.length;
    const before = offset > 0 ? line[offset - 1] : '';
    const after = afterIndex < line.length ? line[afterIndex] : '';

    if (isSkippableHexMatch(before, after)) {
      continue;
    }

    violations.push({
      filePath: relativePath(filePath),
      line: index + 1,
      column: offset + 1,
      snippet: line,
      reason: `Hex literal "${matchText}" detected`
    });
  }
}

function isSkippableHexMatch(before: string, after: string): boolean {
  const isBoundaryAfter = after === '' || !/[0-9a-zA-Z_]/.test(after);
  const isBoundaryBefore = before === '' || !/[0-9a-zA-Z_]/.test(before);

  // Require both sides to be non-word to reduce false positives like anchors (#accounts)
  if (!isBoundaryAfter || !isBoundaryBefore) {
    return true;
  }

  return false;
}

function scanLineForFunctions(
  filePath: string,
  line: string,
  index: number,
  violations: Violation[],
): void {
  for (const { label, regex } of FUNCTION_PATTERNS) {
    regex.lastIndex = 0;
    const match = regex.exec(line);
    if (!match) {
      continue;
    }

    violations.push({
      filePath: relativePath(filePath),
      line: index + 1,
      column: (match.index ?? 0) + 1,
      snippet: line,
      reason: `Colour function ${label} detected`
    });
  }
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath) || filePath;
}

main().catch((error) => {
  console.error('❌ Semantic lint failed to execute.');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
