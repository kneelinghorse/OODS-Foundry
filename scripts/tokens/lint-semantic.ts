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

async function main(): Promise<void> {
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

  if (violations.length > 0) {
    for (const violation of violations) {
      const location = `${violation.filePath}:${violation.line}:${violation.column}`;
      console.error(`${location}  ${violation.reason}`);
      console.error(`    ${violation.snippet.trim()}`);
    }
    console.error(`\n❌ Found ${violations.length} literal colour violation(s).`);
    process.exit(1);
  }

  console.log('✔ Semantic lint passed (no literal colour usage detected).');
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
