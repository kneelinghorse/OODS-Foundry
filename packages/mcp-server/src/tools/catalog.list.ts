import { withPublicEvidence } from '../lib/public-evidence.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToolError } from '../errors/tool-error.js';
import type {
  CatalogListDetail,
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogBrief,
  ComponentCatalogEntry,
  ComponentCatalogSummary,
  ComponentCodeReference,
  ComponentProductReality,
  ComponentReadiness,
  ComponentStatus,
} from './types.js';
import { readComponentsDataset, resolveComponentCount } from './catalog.shared.js';
import { hasMappedRenderer } from '../render/component-map.js';
import { withinAllowed } from '../lib/security.js';
import { listTraits, loadTrait } from '../objects/trait-loader.js';
import { readRuntimeSummary, hasCurrentRuntimeComponent } from '../lib/runtime-ledger.js';
import { liveRegistrySummary } from '../lib/live-registry.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const DEFAULT_CODE_CONNECT_PATH = path.join(ARTIFACT_DIR, 'code-connect.json');
const STORIES_DIR = path.join(REPO_ROOT, 'stories');
const DEFAULT_PAGE_SIZE = 25;

function getCodeConnectPath(): string {
  const override = process.env.MCP_CODE_CONNECT_PATH?.trim();
  if (!override) return DEFAULT_CODE_CONNECT_PATH;
  return path.isAbsolute(override) ? override : path.resolve(REPO_ROOT, override);
}

type CodeConnectRef = {
  path?: string;
  snippet?: string;
  title?: string;
};

type CodeConnectDoc = {
  components?: Record<string, CodeConnectRef[]>;
  references?: Array<CodeConnectRef & { component?: string }>;
};

type TraitUsage = {
  trait: string;
  traitCategory?: string;
  context?: string;
  position?: string;
  priority?: number;
  props?: Record<string, unknown>;
  slots?: Record<string, { accept?: string[]; role?: string }>;
  source?: string;
};

type ComponentData = {
  id: string;
  displayName: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  contexts?: string[];
  regions?: string[];
  traitUsages?: TraitUsage[];
  sourceFiles?: string[];
  productReality?: ComponentProductReality;
};

type ComponentsDataset = {
  obligationScope?: CatalogListOutput["obligationScope"];
  generatedAt?: string;
  stats?: {
    componentCount?: number;
    traitCount?: number;
    objectCount?: number;
    domainCount?: number;
    patternCount?: number;
  };
  components?: ComponentData[];
  traits?: unknown[];
  objects?: unknown[];
  domains?: unknown[];
  patterns?: unknown[];
  sampleQueries?: unknown[];
};

function normalizeTrait(value: string): string {
  return value.trim().toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const prev = new Array<number>(bLen + 1);
  const curr = new Array<number>(bLen + 1);
  for (let j = 0; j <= bLen; j += 1) prev[j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= bLen; j += 1) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= bLen; j += 1) prev[j] = curr[j];
  }
  return prev[bLen];
}

function suggestTraits(query: string, candidates: string[], limit = 5): string[] {
  const normalizedQuery = normalizeTrait(query);
  if (!normalizedQuery) return [];
  const unique = Array.from(new Set(candidates.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  const scored = unique.map((trait) => {
    const normalized = normalizeTrait(trait);
    let score = 0;
    if (normalized === normalizedQuery) {
      score = 0;
    } else if (normalized.includes(normalizedQuery) || normalizedQuery.includes(normalized)) {
      score = 1;
    } else {
      score = 2 + levenshtein(normalizedQuery, normalized);
    }
    return { trait, normalized, score };
  });

  const threshold = Math.max(2, Math.ceil(normalizedQuery.length * 0.4));
  const filtered = scored.filter((entry) =>
    entry.score <= threshold || entry.normalized.includes(normalizedQuery)
  );

  return filtered
    .sort((a, b) => a.score - b.score || a.trait.localeCompare(b.trait))
    .slice(0, limit)
    .map((entry) => entry.trait);
}

type StoryIndex = Map<string, ComponentCodeReference[]>;

let storyIndexCache: { key: string; index: StoryIndex } | undefined;

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIdentifierStart(value: string): boolean {
  return /[A-Za-z_$]/.test(value);
}

function isIdentifierPart(value: string): boolean {
  return /[A-Za-z0-9_$]/.test(value);
}

function skipQuotedLiteral(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function skipTrivia(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      return newline === -1 ? source.length : skipTrivia(source, newline + 1);
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      return close === -1 ? source.length : skipTrivia(source, close + 2);
    }
    break;
  }
  return index;
}

function findClosingDelimiter(source: string, start: number, open: string, close: string): number | undefined {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedLiteral(source, index) - 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      if (newline === -1) return undefined;
      index = newline;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const blockClose = source.indexOf('*/', index + 2);
      if (blockClose === -1) return undefined;
      index = blockClose + 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

function readIdentityLiteral(source: string, start: number): { value: string; end: number } | undefined {
  const quote = source[start];
  if (quote !== '"' && quote !== "'") return undefined;
  const end = skipQuotedLiteral(source, start);
  if (end > source.length || source[end - 1] !== quote) return undefined;
  const value = source.slice(start + 1, end - 1);
  if (!/^[A-Za-z0-9_]+$/.test(value)) return undefined;
  return { value, end };
}

function collectParameterIdentityProperties(
  source: string,
  objectStart: number,
  objectEnd: number,
  ids: Set<string>,
): void {
  let braceDepth = 1;
  for (let index = objectStart + 1; index < objectEnd; index += 1) {
    index = skipTrivia(source, index);
    if (index >= objectEnd) break;

    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedLiteral(source, index) - 1;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      continue;
    }
    if (braceDepth !== 1 || !isIdentifierStart(char)) continue;

    let nameEnd = index + 1;
    while (nameEnd < objectEnd && isIdentifierPart(source[nameEnd])) nameEnd += 1;
    const propertyName = source.slice(index, nameEnd);
    if (propertyName !== 'oodsComponentId' && propertyName !== 'oodsComponentIds') {
      index = nameEnd - 1;
      continue;
    }

    let valueStart = skipTrivia(source, nameEnd);
    if (source[valueStart] !== ':') {
      index = nameEnd - 1;
      continue;
    }
    valueStart = skipTrivia(source, valueStart + 1);

    if (propertyName === 'oodsComponentId') {
      const literal = readIdentityLiteral(source, valueStart);
      if (literal) {
        ids.add(literal.value);
        index = literal.end - 1;
      }
      continue;
    }

    if (source[valueStart] !== '[') continue;
    const arrayEnd = findClosingDelimiter(source, valueStart, '[', ']');
    if (arrayEnd === undefined || arrayEnd > objectEnd) continue;
    let itemStart = valueStart + 1;
    while (itemStart < arrayEnd) {
      itemStart = skipTrivia(source, itemStart);
      if (source[itemStart] === ',') {
        itemStart += 1;
        continue;
      }
      const literal = readIdentityLiteral(source, itemStart);
      if (!literal) break;
      ids.add(literal.value);
      itemStart = literal.end;
    }
    index = arrayEnd;
  }
}

/**
 * Extracts only explicit Storybook `parameters.oodsComponentId(s)` metadata.
 * Imports, titles, JSX, YAML examples, comments, and prose never establish
 * component identity.
 */
export function extractExplicitStoryComponentIds(source: string): Set<string> {
  const ids = new Set<string>();
  const readIdentifier = (start: number): { value: string; end: number } | undefined => {
    if (!isIdentifierStart(source[start])) return undefined;
    let end = start + 1;
    while (end < source.length && isIdentifierPart(source[end])) end += 1;
    return { value: source.slice(start, end), end };
  };

  const findDeclaredMeta = (name: string, before: number): number | undefined => {
    let candidate: number | undefined;
    for (let index = 0; index < before; index += 1) {
      index = skipTrivia(source, index);
      if (index >= before) break;
      const char = source[index];
      if (char === '"' || char === "'" || char === '`') {
        index = skipQuotedLiteral(source, index) - 1;
        continue;
      }
      const declaration = readIdentifier(index);
      if (!declaration || !['const', 'let', 'var'].includes(declaration.value)) continue;
      const declaredNameStart = skipTrivia(source, declaration.end);
      const declaredName = readIdentifier(declaredNameStart);
      if (!declaredName || declaredName.value !== name) {
        index = declaration.end - 1;
        continue;
      }
      let valueStart = declaredName.end;
      while (valueStart < before && source[valueStart] !== ';' && source[valueStart] !== '=') {
        if (source[valueStart] === '"' || source[valueStart] === "'" || source[valueStart] === '`') {
          valueStart = skipQuotedLiteral(source, valueStart);
        } else {
          valueStart += 1;
        }
      }
      if (source[valueStart] !== '=') continue;
      valueStart = skipTrivia(source, valueStart + 1);
      if (source[valueStart] === '{') candidate = valueStart;
      index = declaredName.end - 1;
    }
    return candidate;
  };

  let metaStart: number | undefined;
  for (let index = 0; index < source.length; index += 1) {
    index = skipTrivia(source, index);
    if (index >= source.length) break;

    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedLiteral(source, index) - 1;
      continue;
    }
    const keyword = readIdentifier(index);
    if (!keyword || keyword.value !== 'export') continue;
    const defaultStart = skipTrivia(source, keyword.end);
    const defaultKeyword = readIdentifier(defaultStart);
    if (!defaultKeyword || defaultKeyword.value !== 'default') continue;
    const valueStart = skipTrivia(source, defaultKeyword.end);
    if (source[valueStart] === '{') {
      metaStart = valueStart;
    } else {
      const metaName = readIdentifier(valueStart);
      if (metaName) metaStart = findDeclaredMeta(metaName.value, index);
    }
    break;
  }

  if (metaStart === undefined) return ids;
  const metaEnd = findClosingDelimiter(source, metaStart, '{', '}');
  if (metaEnd === undefined) return ids;

  let braceDepth = 1;
  for (let index = metaStart + 1; index < metaEnd; index += 1) {
    index = skipTrivia(source, index);
    if (index >= metaEnd) break;
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedLiteral(source, index) - 1;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      continue;
    }
    if (braceDepth !== 1) continue;

    const property = readIdentifier(index);
    if (!property || property.value !== 'parameters') continue;
    let parametersStart = skipTrivia(source, property.end);
    if (source[parametersStart] !== ':') continue;
    parametersStart = skipTrivia(source, parametersStart + 1);
    if (source[parametersStart] !== '{') continue;
    const parametersEnd = findClosingDelimiter(source, parametersStart, '{', '}');
    if (parametersEnd === undefined || parametersEnd > metaEnd) return ids;
    collectParameterIdentityProperties(source, parametersStart, parametersEnd, ids);
    return ids;
  }
  return ids;
}

function listStoryFiles(storiesDir: string): string[] {
  if (!fs.existsSync(storiesDir)) {
    return [];
  }

  const files: string[] = [];
  const stack: string[] = [storiesDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (!withinAllowed(storiesDir, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.stories.tsx')) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function extractStoryTitle(source: string): string | undefined {
  const match = source.match(/\btitle:\s*['"]([^'"]+)['"]/);
  return match?.[1];
}

function extractViewExtensionsBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /`(view_extensions:[\s\S]*?)`/g;
  for (const match of source.matchAll(re)) {
    if (typeof match[1] === 'string') {
      blocks.push(match[1]);
    }
  }
  return blocks;
}

function buildViewExtensionSnippets(yaml: string): Map<string, string> {
  const lines = yaml.split(/\r?\n/);
  const snippets = new Map<string, string>();

  let currentContextLine: string | undefined;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    const contextMatch = line.match(/^\s{2}([A-Za-z0-9_]+):\s*$/);
    if (contextMatch) {
      currentContextLine = line;
      continue;
    }

    const componentMatch = line.match(/^\s*-\s*component:\s*([A-Za-z0-9_]+)\s*$/);
    if (!componentMatch) continue;

    const componentName = componentMatch[1];
    const componentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

    const blockLines: string[] = [];
    const header = lines.find((candidate) => candidate.trim() === 'view_extensions:') ?? 'view_extensions:';
    blockLines.push(header);
    if (currentContextLine) {
      blockLines.push(currentContextLine);
    }

    blockLines.push(line);

    for (let nextIndex = lineIndex + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (!nextLine.trim()) break;

      const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
      const trimmed = nextLine.trim();

      if (nextIndent <= componentIndent && trimmed.endsWith(':')) break;
      if (nextIndent <= componentIndent && trimmed.startsWith('-')) break;

      blockLines.push(nextLine);
    }

    const snippet = blockLines.join('\n').trim();
    if (snippet && !snippets.has(componentName)) {
      snippets.set(componentName, snippet);
    }
  }

  return snippets;
}

type ImportInfo =
  | { style: 'named'; module: string }
  | { style: 'default'; module: string }
  | { style: 'namespace'; module: string };

function parseNamedImportLocals(namedImports: string): string[] {
  return namedImports
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^type\s+/, '').trim();
      const [imported, local] = cleaned.split(/\s+as\s+/);
      return (local ?? imported).trim();
    })
    .filter(Boolean);
}

function findImportForIdentifier(source: string, identifier: string): ImportInfo | undefined {
  const namespaceRe = new RegExp(`\\bimport\\s+\\*\\s+as\\s+${escapeRegExp(identifier)}\\s+from\\s+['"]([^'"]+)['"]`);
  const namespaceMatch = source.match(namespaceRe);
  if (namespaceMatch?.[1]) {
    return { style: 'namespace', module: namespaceMatch[1] };
  }

  const mixedRe = /import\s+([A-Za-z0-9_$]+)\s*,\s*{\s*([\s\S]*?)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  for (const match of source.matchAll(mixedRe)) {
    const defaultLocal = match[1];
    const namedPart = match[2];
    const module = match[3];
    if (defaultLocal === identifier) {
      return { style: 'default', module };
    }
    if (parseNamedImportLocals(namedPart).includes(identifier)) {
      return { style: 'named', module };
    }
  }

  const defaultRe = new RegExp(`\\bimport\\s+${escapeRegExp(identifier)}\\s+from\\s+['"]([^'"]+)['"]`);
  const defaultMatch = source.match(defaultRe);
  if (defaultMatch?.[1]) {
    return { style: 'default', module: defaultMatch[1] };
  }

  const namedRe = /import\s*{\s*([\s\S]*?)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  for (const match of source.matchAll(namedRe)) {
    const namedPart = match[1];
    const module = match[2];
    if (parseNamedImportLocals(namedPart).includes(identifier)) {
      return { style: 'named', module };
    }
  }

  return undefined;
}

function buildReactUsageSnippet(source: string, identifier: string, importInfo: ImportInfo): string {
  const importLine =
    importInfo.style === 'named'
      ? `import { ${identifier} } from '${importInfo.module}';`
      : importInfo.style === 'default'
        ? `import ${identifier} from '${importInfo.module}';`
        : `import * as ${identifier} from '${importInfo.module}';`;

  const hasChildren = new RegExp(`<${escapeRegExp(identifier)}\\b[^>]*>`).test(source) && new RegExp(`</${escapeRegExp(identifier)}>`).test(source);
  const jsx = hasChildren ? `<${identifier}>...</${identifier}>` : `<${identifier} />`;

  return `${importLine}\n\nexport function Example() {\n  return ${jsx};\n}`;
}

function extractLineSnippet(source: string, needle: string): string {
  const lines = source.split(/\r?\n/);
  const matchIndex = lines.findIndex((line) => line.includes(needle));
  if (matchIndex === -1) {
    return needle;
  }

  const start = Math.max(0, matchIndex - 2);
  const end = Math.min(lines.length, matchIndex + 4);
  const snippet = lines.slice(start, end).join('\n').trim();

  const limit = 900;
  if (snippet.length <= limit) return snippet;
  return `${snippet.slice(0, limit)}\n…`;
}

export function buildStoryIndex(componentNames: string[], storiesDir = STORIES_DIR): StoryIndex {
  const index: StoryIndex = new Map();
  const storyFiles = listStoryFiles(storiesDir);

  for (const storyFile of storyFiles) {
    let source: string;
    try {
      source = fs.readFileSync(storyFile, 'utf8');
    } catch {
      continue;
    }

    const storyTitle = extractStoryTitle(source);
    const explicitComponentIds = extractExplicitStoryComponentIds(source);

    const viewExtensionsSnippets = new Map<string, string>();
    for (const block of extractViewExtensionsBlocks(source)) {
      for (const [componentName, snippet] of buildViewExtensionSnippets(block).entries()) {
        if (!viewExtensionsSnippets.has(componentName)) {
          viewExtensionsSnippets.set(componentName, snippet);
        }
      }
    }

    for (const componentName of componentNames) {
      if (!explicitComponentIds.has(componentName)) continue;

      let snippet: string | undefined = viewExtensionsSnippets.get(componentName);

      if (!snippet) {
        const importInfo = findImportForIdentifier(source, componentName);
        if (importInfo) {
          snippet = buildReactUsageSnippet(source, componentName, importInfo);
        }
      }

      if (!snippet) {
        snippet = extractLineSnippet(source, componentName);
      }

      const relativePath = toPosixPath(path.relative(REPO_ROOT, storyFile));
      const ref: ComponentCodeReference = {
        kind: 'storybook',
        path: relativePath,
        snippet,
        ...(storyTitle ? { title: storyTitle } : {}),
      };

      const existing = index.get(componentName);
      if (existing) {
        existing.push(ref);
      } else {
        index.set(componentName, [ref]);
      }
    }
  }

  return index;
}

function getStoryIndex(componentNames: string[]): StoryIndex {
  const key = componentNames.slice().sort().join('|');
  if (storyIndexCache?.key === key) {
    return storyIndexCache.index;
  }
  const index = buildStoryIndex(componentNames);
  storyIndexCache = { key, index };
  return index;
}

function pickBestSnippet(codeReferences: ComponentCodeReference[]): string | undefined {
  const kindOrder: ComponentCodeReference['kind'][] = ['code-connect', 'storybook'];
  for (const kind of kindOrder) {
    const candidates = codeReferences.filter((ref) => ref.kind === kind);
    if (candidates.length === 0) continue;
    return candidates.find((ref) => ref.snippet.includes('import '))?.snippet ?? candidates[0]?.snippet;
  }

  return undefined;
}

function loadCodeConnectIndex(): StoryIndex {
  const index: StoryIndex = new Map();
  const codeConnectPath = getCodeConnectPath();

  if (!fs.existsSync(codeConnectPath)) {
    return index;
  }

  let doc: CodeConnectDoc;
  try {
    doc = JSON.parse(fs.readFileSync(codeConnectPath, 'utf8')) as CodeConnectDoc;
  } catch {
    return index;
  }

  const add = (componentName: string, ref: CodeConnectRef) => {
    if (!ref.path || !ref.snippet) return;

    const entry: ComponentCodeReference = {
      kind: 'code-connect',
      path: ref.path,
      snippet: ref.snippet,
      ...(ref.title ? { title: ref.title } : {}),
    };

    const existing = index.get(componentName);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(componentName, [entry]);
    }
  };

  if (doc.components && typeof doc.components === 'object') {
    for (const [componentName, refs] of Object.entries(doc.components)) {
      if (!Array.isArray(refs)) continue;
      refs.forEach((ref) => add(componentName, ref));
    }
  }

  if (Array.isArray(doc.references)) {
    doc.references.forEach((ref) => {
      if (!ref.component) return;
      add(ref.component, ref);
    });
  }

  return index;
}

/**
 * Content/steer props for primitive components whose dataset `traitUsages` are empty,
 * so `extractPropSchema` would otherwise return `{}` and leave agents unable to learn
 * the real content prop (Synthesis-Workbench signal, 2026-06: composing Text with
 * `{content}` rendered an empty <p> because the content prop is actually `text`).
 *
 * Source of truth = the per-renderer `consumedProps` + content resolution in
 * src/render/component-map.ts. Kept honest by a behavioral parity test that renders
 * each primitive with its advertised prop and asserts the value reaches the HTML.
 * Layout containers (e.g. Stack) read no scalar props — they take children — so they
 * are intentionally absent here and keep an empty propSchema.
 */
export interface PrimitivePropSchemaEntry {
  type: 'string' | 'array' | 'boolean' | 'number';
  description: string;
}

export const PRIMITIVE_PROP_SCHEMAS: Record<string, Record<string, PrimitivePropSchemaEntry>> = {
  Text: {
    text: { type: 'string', description: 'Text content (primary). Falls back to `value`, then the node label.' },
    value: { type: 'string', description: 'Alternate text content used when `text` is absent.' },
    as: { type: 'string', description: 'HTML tag override: p, span, small, strong, em, label, or h1–h6 (default p).' },
  },
  Button: {
    label: { type: 'string', description: 'Button label (primary). Falls back to `text`, then the node label.' },
    text: { type: 'string', description: 'Alternate button label used when `label` is absent.' },
    type: { type: 'string', description: 'Native button type: button | submit | reset (default button).' },
  },
  Card: {
    body: { type: 'string', description: 'Card body text rendered when no child nodes are supplied.' },
  },
  Table: {
    columns: { type: 'array', description: 'Column definitions: { key, label } objects or plain strings.' },
    rows: { type: 'array', description: 'Row data: objects keyed by column, arrays, or scalars.' },
  },
  Tabs: {
    tabs: { type: 'array', description: 'Tab definitions: { id, label, panel|content } objects or plain strings.' },
    activeTab: { type: 'string', description: 'Id of the initially active tab (defaults to the first tab).' },
  },
  Input: {
    value: { type: 'string', description: 'Input value.' },
    placeholder: { type: 'string', description: 'Placeholder text.' },
    type: { type: 'string', description: 'Native input type (text, email, number, …; default text).' },
    name: { type: 'string', description: 'Form field name.' },
    required: { type: 'boolean', description: 'Marks the field as required.' },
    disabled: { type: 'boolean', description: 'Disables the input.' },
  },
  Select: {
    options: { type: 'array', description: 'Option list: { value, label } objects or scalars.' },
    value: { type: 'string', description: 'Selected value (string, or array for multi-select).' },
  },
};

/**
 * Merge primitive content-prop schemas into a component's prop schema without
 * overriding any trait-derived entry. No-op for non-primitive components.
 */
function mergePrimitivePropSchema(
  componentName: string,
  propSchema: Record<string, unknown>,
): void {
  const primitive = PRIMITIVE_PROP_SCHEMAS[componentName];
  if (!primitive) return;
  for (const [propName, entry] of Object.entries(primitive)) {
    if (!(propName in propSchema)) {
      propSchema[propName] = { ...entry, source: 'primitive-renderer' };
    }
  }
}

function extractPropSchema(traitUsages: TraitUsage[]): Record<string, unknown> {
  const propSchema: Record<string, unknown> = {};

  for (const usage of traitUsages) {
    if (usage.props) {
      for (const [key, value] of Object.entries(usage.props)) {
        propSchema[key] = {
          type: typeof value,
          default: value,
          trait: usage.trait,
        };
      }
    }
  }

  return propSchema;
}

function extractSlotDefinitions(traitUsages: TraitUsage[]): Record<string, { accept?: string[]; role?: string }> {
  const slots: Record<string, { accept?: string[]; role?: string }> = {};

  for (const usage of traitUsages) {
    if (usage.slots) {
      for (const [slotName, slotDef] of Object.entries(usage.slots)) {
        slots[slotName] = {
          accept: slotDef.accept,
          role: slotDef.role,
        };
      }
    }
  }

  return slots;
}

function deriveComponentStatus(componentId: string): ComponentStatus {
  // Backward-compatible legacy field: this reports only the static HTML
  // renderer map. Target-specific implementation/readiness lives in
  // `productReality` and must not be inferred from this value.
  return hasMappedRenderer(componentId) ? 'stable' : 'planned';
}

function deriveComponentMaturity(traitUsages: TraitUsage[] | undefined): string | undefined {
  if (!traitUsages || traitUsages.length === 0) return undefined;
  for (const usage of traitUsages) {
    try {
      const traitDef = loadTrait(usage.trait);
      if (traitDef.metadata?.maturity) {
        return traitDef.metadata.maturity;
      }
    } catch {
      // trait not found — skip
    }
  }
  return undefined;
}

export function transformComponentsToSummary(componentsData: ComponentsDataset): ComponentCatalogSummary[] {
  if (!componentsData.components) {
    return [];
  }

  return componentsData.components.map((component) => {
    const maturity = deriveComponentMaturity(component.traitUsages);
    return {
      name: component.id,
      displayName: component.displayName,
      ...(component.description ? { description: component.description } : {}),
      categories: component.categories || [],
      tags: component.tags || [],
      contexts: component.contexts || [],
      regions: component.regions || [],
      traits: Array.from(
        new Set(component.traitUsages?.map((usage) => usage.trait) || []),
      ),
      ...(component.productReality ? { productReality: component.productReality } : {}),
      status: deriveComponentStatus(component.id),
      ...(maturity ? { maturity } : {}),
    };
  });
}

type TargetPropTypes = NonNullable<ComponentCatalogEntry['propTypes']>;
let componentPropTypes: Record<string, TargetPropTypes> | undefined;

/**
 * s221-m02 (#2482 ruling 5; the website's finding 4): each component's React and Vue props, from the published
 * declarations (registry/component-prop-types.v1.json, which scripts/product-reality/s221-component-prop-types.mjs
 * generates and docs:check keeps current). The build ships the same file inside dist; source runs read registry/.
 */
function readComponentPropTypes(): Record<string, TargetPropTypes> {
  if (componentPropTypes) return componentPropTypes;
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.resolve(directory, '../registry/component-prop-types.v1.json');
  const source = path.resolve(directory, '../../registry/component-prop-types.v1.json');
  componentPropTypes = (JSON.parse(fs.readFileSync(fs.existsSync(bundled) ? bundled : source, 'utf8')) as { components: Record<string, TargetPropTypes> }).components;
  return componentPropTypes;
}

function enrichComponentsToDetail(
  components: ComponentCatalogSummary[],
  componentIndex: Map<string, ComponentData>,
): ComponentCatalogEntry[] {
  const propTypes = readComponentPropTypes();
  return components.map((component) => {
    const source = componentIndex.get(component.name);
    const traitUsages = source?.traitUsages || [];
    const propSchema = extractPropSchema(traitUsages);
    mergePrimitivePropSchema(component.name, propSchema);
    const slots = extractSlotDefinitions(traitUsages);

    return {
      ...component,
      propSchema,
      // propSchema's names are the static HTML renderer's (a Button's label, not React's content); propTypes has the
      // React and Vue components' own.
      propSchemaTarget: 'html',
      ...(propTypes[component.name] ? { propTypes: propTypes[component.name] } : {}),
      slots,
    };
  });
}

/** One label from the measured surfaces (s211-m01); the evidence behind it is in detail 'full'. */
function readinessOf(name: string, productReality: ComponentCatalogSummary['productReality']): ComponentReadiness {
  const complete = (surface: 'react' | 'vue' | 'generatedConsumer') => productReality?.surfaces?.[surface]?.state === 'implemented-evidence-complete';
  if (!complete('react') || !complete('vue')) return 'incomplete';
  return hasCurrentRuntimeComponent(name) ? 'proven-in-generated-apps' : 'react-and-vue';
}

function liveTraitCount(): number | undefined {
  try { return listTraits().length; } catch { return undefined; }
}

export async function handle(input: CatalogListInput): Promise<CatalogListOutput> {
  try {
    const componentsData = readComponentsDataset<ComponentsDataset>();
    const catalog = transformComponentsToSummary(componentsData);
    const componentIndex = new Map(
      (componentsData.components ?? []).map((component) => [component.id, component]),
    );

    // Apply filters if provided
    let filteredCatalog = catalog;

    if (input.category) {
      filteredCatalog = filteredCatalog.filter((c) => c.categories.includes(input.category!));
    }

    if (input.trait) {
      filteredCatalog = filteredCatalog.filter((c) => c.traits.includes(input.trait!));
    }

    if (input.context) {
      filteredCatalog = filteredCatalog.filter((c) => c.contexts.includes(input.context!));
    }

    if (input.status) {
      filteredCatalog = filteredCatalog.filter((c) => c.status === input.status);
    }

    // Stable sort: alphabetical by name
    filteredCatalog.sort((a, b) => a.name.localeCompare(b.name));

    let suggestions: CatalogListOutput['suggestions'] | undefined;
    if (input.trait && filteredCatalog.length === 0) {
      const allTraits = new Set<string>();
      for (const component of catalog) {
        for (const trait of component.traits) {
          allTraits.add(trait);
        }
      }
      const traitSuggestions = suggestTraits(input.trait, Array.from(allTraits));
      if (traitSuggestions.length > 0) {
        suggestions = { traits: traitSuggestions };
      }
    }

    const allCategories = new Set<string>();
    for (const component of catalog) {
      for (const cat of component.categories) {
        allCategories.add(cat);
      }
    }
    const availableCategories = Array.from(allCategories).sort();

    const hasFilters = Boolean(input.category || input.trait || input.context || input.status);
    // s211-m01: the unfiltered default is brief. Page 1 of the old summary was 96 KB of evidence paths per component.
    const detail: CatalogListDetail = input.detail ?? (hasFilters ? 'full' : 'brief');
    const paginationRequested = input.page !== undefined || input.pageSize !== undefined;
    const applyDefaultPagination = !input.detail && !hasFilters;
    const shouldPaginate = paginationRequested || applyDefaultPagination;

    const totalCount = filteredCatalog.length;
    const page = Math.max(1, input.page ?? 1);
    let pageSize: number;

    if (totalCount === 0) {
      pageSize = 0;
    } else if (shouldPaginate) {
      pageSize = Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE);
    } else {
      pageSize = totalCount;
    }

    const offset = shouldPaginate ? (page - 1) * pageSize : 0;
    const pagedCatalog = shouldPaginate
      ? filteredCatalog.slice(offset, offset + pageSize)
      : filteredCatalog;

    let components: Array<ComponentCatalogBrief | ComponentCatalogSummary | ComponentCatalogEntry> = pagedCatalog;

    if (detail === 'brief') {
      components = pagedCatalog.map(({ name, categories, description, productReality }) => ({ name, categories, description, readiness: readinessOf(name, productReality) }));
    } else if (detail === 'summary') {
      // Evidence is only in full: summary keeps what each component is and where it goes.
      components = pagedCatalog.map(({ productReality, ...entry }) => ({ ...entry, readiness: readinessOf(entry.name, productReality) }));
    } else if (detail === 'full') {
      const detailed = enrichComponentsToDetail(pagedCatalog, componentIndex);
      const storyIndex = getStoryIndex(detailed.map((c) => c.name));
      const codeConnectIndex = loadCodeConnectIndex();

      components = detailed.map((component) => {
        const codeReferences = [
          ...(codeConnectIndex.get(component.name) ?? []),
          ...(storyIndex.get(component.name) ?? []),
        ];

        if (codeReferences.length === 0) {
          return { ...component, readiness: readinessOf(component.name, component.productReality) };
        }

        return {
          ...component,
          readiness: readinessOf(component.name, component.productReality),
          codeReferences,
          codeSnippet: pickBestSnippet(codeReferences),
        };
      });
    }

    const returnedCount = components.length;
    const hasMore = shouldPaginate ? offset + returnedCount < totalCount : false;

    const componentCount = resolveComponentCount(componentsData);
    const filteredCount = hasFilters ? totalCount : undefined;

    let runtimeEvidence = 'Current complete runtime proof is unavailable; catalog membership does not establish runtime coverage.';
    try {
      const runtime = readRuntimeSummary();
      runtimeEvidence = `${runtime.pass}/${runtime.cells} generated cells pass packed runtime gates at ${runtime.head}; ${runtime.typedGap} typed gaps, ${runtime.fail} failures. This is runtime evidence, not craft or classification approval.`;
    } catch { /* Preserve catalog availability while health reports the missing/invalid proof. */ }

    return {
      // s222-m03 (#2502 ruling 15): business objects first; internal ones only with includeInternal.
      registry: liveRegistrySummary({ includeInternal: input.includeInternal === true }),
      components: withPublicEvidence(components),
      totalCount,
      returnedCount,
      page,
      pageSize,
      hasMore,
      detail,
      generatedAt: componentsData.generatedAt || new Date().toISOString(),
      // The scope ruling is governance, not a brief answer: summary and full carry it (s211-m01).
      ...(componentsData.obligationScope && detail !== 'brief' ? { obligationScope: { ...componentsData.obligationScope, runtimeEvidence } } : {}),
      stats: {
        componentCount,
        // s211-m01: the registry's own count, as health reports it; the export's stat froze at 46 while the registry held 49.
        traitCount: liveTraitCount() ?? componentsData.stats?.traitCount ?? 0,
        ...(filteredCount !== undefined ? { filteredCount } : {}),
      },
      availableCategories,
      ...(suggestions ? { suggestions } : {}),
    };
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError('OODS-S005', `Failed to list component catalog: ${(error as Error).message}`);
  }
}
