/**
 * s213-m04 — no hard-coded brand list in product source.
 *
 * Forge's brands come from the brand registry (packages/tokens/scripts/brand-registry.cjs: the brands folder). Before
 * this mission about fifty product and build files listed A and B themselves, so a team's brand needed an edit in each.
 * This spec fails when such a list comes back: an array, set, union type, schema enum or paired comparison naming
 * brands A and B, anywhere in the source that ships in the runtime or builds and grades brands. It reads the files
 * git tracks, so a new file is covered the moment it exists.
 *
 * Not product source, and not scanned: tests and fixtures, the historical sprint proof scripts under
 * scripts/product-reality (records of their sprint, left alone), docs, receipts, and the developer apps under apps/
 * (not shipped; the playground's brand pill is carried to a later sprint).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** What a hard-coded brand list looks like. Each pattern names brands A and B together. */
export const BRAND_LIST_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'array, set or enum of A and B', pattern: /\[\s*(['"])A\1\s*,\s*(['"])B\2/ },
  { name: 'union type of A and B', pattern: /(['"])A\1\s*\|\s*(['"])B\2/ },
  { name: 'comparison against A and against B', pattern: /[!=]==?\s*(['"])A\1[^\n]*[!=]==?\s*(['"])B\2/ },
  { name: 'brand-a and brand-b class names together', pattern: /(['"])brand-a\1[^\n]*(['"])brand-b\2/ },
];

/**
 * Lines that match a pattern without being a brand list, each with its reason. Matched on file and line text, so an
 * edit to the line (or a second such line) fails the spec until it is looked at.
 */
const NOT_BRAND_LISTS: ReadonlyArray<{ file: string; line: string; reason: string }> = [
  { file: 'packages/mcp-server/src/codegen/target-readiness.ts', line: "export type ReadinessReferenceClass = 'A' | 'B';", reason: 'readiness reference classes A and B (Sprint 211), not brands' },
  { file: 'packages/mcp-server/src/codegen/readiness-attestation.ts', line: "referenceClass: 'A' | 'B';", reason: 'readiness reference classes A and B, not brands' },
  { file: 'packages/tokens/src/palette/seeds.schema.json', line: '"required": ["A", "B"', reason: "the palette seed file: brand A's full seed and brand B's hue, the two shipped brands the palette generator writes; any other brand is authored as its three files, which the registry reads" },
  { file: 'packages/foundry/facts.json', line: '"brands": ["A", "B"', reason: 'generated release facts record the measured chart scopes, not the available brand registry' },
];

/** Product source: what ships in the runtime and npm package, and the scripts that build, lint and grade brands. */
const SCANNED = [
  'packages', 'schemas', 'generated', 'src', 'tools', '.storybook',
  'scripts/lint', 'scripts/tokens', 'scripts/docs', 'scripts/runtime', 'scripts/design-loop', 'scripts/quality', 'scripts/state-assessment.mjs',
];
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json|vue)$/;
const NOT_PRODUCT = [
  /(^|\/)(?:test|tests|__tests__|__fixtures__|fixtures|__snapshots__)\//,
  /\.(?:test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)test-[^/]*\.js$/, /(^|\/)smoke-test\.js$/, /opus-4\.6-repro\.js$/,
  /(^|\/)(?:dist|node_modules|coverage|storybook-static)\//,
  // Recorded measurements and evidence: data about the brands that were measured, not a list of brands to use.
  /(^|\/)evidence\//, /viz-recipes\.v1\.json$/, /viz-patterns\.v1\.json$/,
  // Storybook stories and their fixtures render brand A or B on purpose; they are documentation, not the registry.
  /\.stories\.[jt]sx?$/, /(^|\/)stories\//,
];

export function findBrandLists(file: string, text: string): Array<{ file: string; line: number; text: string; pattern: string }> {
  const found: Array<{ file: string; line: number; text: string; pattern: string }> = [];
  // JSON schemas spread an enum over lines; fold each array onto one line so the array pattern sees it.
  const folded = file.endsWith('.json') ? text.replace(/\[\s*\n\s*/g, '[').replace(/,\s*\n\s*(?=["'])/g, ', ') : text;
  folded.split('\n').forEach((line, index) => {
    for (const { name, pattern } of BRAND_LIST_PATTERNS) {
      if (!pattern.test(line)) continue;
      if (NOT_BRAND_LISTS.some(entry => entry.file === file && line.includes(entry.line))) continue;
      found.push({ file, line: index + 1, text: line.trim().slice(0, 160), pattern: name });
    }
  });
  return found;
}

function productFiles(): string[] {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...SCANNED], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '-z', '--others', '--exclude-standard', '--', ...SCANNED], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0').filter(Boolean);
  return [...new Set([...tracked, ...untracked])].filter(file => SOURCE_FILE.test(file) && !NOT_PRODUCT.some(pattern => pattern.test(file)) && fs.existsSync(path.join(REPO_ROOT, file)));
}

describe('s213-m04 — no hard-coded brand list in product source', () => {
  it('finds none: every list of brands derives from the brand registry', () => {
    const files = productFiles();
    expect(files.length).toBeGreaterThan(1000);
    const found = files.flatMap(file => findBrandLists(file, fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')));
    expect(found, found.map(item => `${item.file}:${item.line} (${item.pattern}) ${item.text}`).join('\n')).toEqual([]);
  });

  it('bites: each shape of list the registry replaced is caught, and a look-alike that is not a brand list is not', () => {
    const shapes = [
      ["const BRANDS = new Set(['A', 'B']);", 'array, set or enum of A and B'],
      ["export type PreviewBrand = 'A' | 'B';", 'union type of A and B'],
      ["if (brand !== 'A' && brand !== 'B') return undefined;", 'comparison against A and against B'],
      ["options('brand', ['A', 'B'] as const, brand)", 'array, set or enum of A and B'],
      ['"brand": { "type": "string", "enum": ["A", "B"] }', 'array, set or enum of A and B'],
      ["if (brand === 'A' || brand === 'brand-a') return 'A'; else if (x === 'brand-b')", 'brand-a and brand-b class names together'],
    ] as const;
    for (const [line, pattern] of shapes) expect(findBrandLists('packages/example/src/example.ts', line).map(item => item.pattern), line).toContain(pattern);
    // A schema enum spread over lines, as the tool schemas held it.
    expect(findBrandLists('packages/mcp-server/src/schemas/example.json', '"brand": {\n  "enum": [\n    "A",\n    "B"\n  ]\n}')).toHaveLength(1);
    expect(findBrandLists('packages/mcp-server/src/codegen/target-readiness.ts', "export type ReadinessReferenceClass = 'A' | 'B';")).toEqual([]);
    expect(findBrandLists('packages/example/src/example.ts', "export type ReadinessReferenceClass = 'A' | 'B';")).toHaveLength(1);
    expect(findBrandLists('packages/foundry/facts.json', '"brands": ["A", "B"]')).toEqual([]);
    expect(findBrandLists('packages/example/facts.json', '"brands": ["A", "B"]')).toHaveLength(1);
    for (const fine of ["const brand = input.brand ?? 'A';", "data-brand='B'", "else official += 1; // blank / 'A' / official"]) {
      expect(findBrandLists('packages/example/src/example.ts', fine), fine).toEqual([]);
    }
  });
});
