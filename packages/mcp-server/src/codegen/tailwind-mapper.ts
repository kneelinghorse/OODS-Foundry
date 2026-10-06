import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  javascriptSingleQuotedString,
  serializeJavaScriptJson,
} from './emission-safety.js';

export type TailwindState = 'hover' | 'focus' | 'focus-visible' | 'disabled' | 'active';

export type TailwindUtility =
  | 'text'
  | 'bg'
  | 'border'
  | 'p'
  | 'pt'
  | 'pr'
  | 'pb'
  | 'pl'
  | 'm'
  | 'mt'
  | 'mr'
  | 'mb'
  | 'ml'
  | 'gap'
  | 'gap-x'
  | 'gap-y'
  | 'rounded'
  | 'shadow'
  | 'opacity'
  | 'font'
  | 'leading'
  | 'tracking';

export type TailwindVariants = Record<string, Record<string, string | string[]>>;

export interface TailwindMapOptions {
  states?: TailwindState[];
  includeBase?: boolean;
  tokensPath?: string;
}

type FlatTokenEntry = {
  name?: string;
  value?: unknown;
  cssVariable?: string;
  originalValue?: unknown;
  description?: string;
};

type TailwindPayload = {
  prefix?: string;
  flat?: Record<string, FlatTokenEntry>;
  layers?: Record<string, unknown>;
};

type TokenIndex = {
  prefix: string;
  keys: string[];
  entries: Map<string, FlatTokenEntry>;
  byCssVar: Map<string, string>;
};

const SUPPORTED_STATES = new Set<TailwindState>([
  'hover',
  'focus',
  'focus-visible',
  'disabled',
  'active',
]);

const TAILWIND_SPACING_SCALE = new Map<number, string>([
  [0, '0'],
  [2, '0.5'],
  [4, '1'],
  [6, '1.5'],
  [8, '2'],
  [10, '2.5'],
  [12, '3'],
  [14, '3.5'],
  [16, '4'],
  [20, '5'],
  [24, '6'],
  [28, '7'],
  [32, '8'],
  [36, '9'],
  [40, '10'],
  [44, '11'],
  [48, '12'],
  [56, '14'],
  [64, '16'],
  [80, '20'],
  [96, '24'],
  [112, '28'],
  [128, '32'],
  [144, '36'],
  [160, '40'],
  [176, '44'],
  [192, '48'],
  [208, '52'],
  [224, '56'],
  [240, '60'],
  [256, '64'],
  [288, '72'],
  [320, '80'],
  [384, '96'],
]);

const TAILWIND_RADIUS_SCALE = new Map<number, string>([
  [0, 'none'],
  [2, 'sm'],
  [4, 'md'],
  [6, 'lg'],
  [8, 'xl'],
  [12, '2xl'],
  [16, '3xl'],
  [24, '3xl'],
]);

const TAILWIND_TEXT_SIZE_SCALE = new Map<number, string>([
  [12, 'xs'],
  [14, 'sm'],
  [16, 'base'],
  [18, 'lg'],
  [20, 'xl'],
  [24, '2xl'],
  [30, '3xl'],
  [36, '4xl'],
]);

// Use path.dirname(fileURLToPath(import.meta.url)) instead of
// `new URL('../..', import.meta.url)` because Vite (used by vitest) rewrites
// the new-URL-with-import.meta.url pattern into its @fs dev-server URL for
// asset handling, which breaks fileURLToPath under non-default test
// environments (s104-m01 — happy-dom host-conformance gate).
const MCP_SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = path.resolve(MCP_SERVER_DIR, '..', '..');

const DEFAULT_TOKENS_PATH = path.join(REPO_ROOT, 'packages', 'tokens', 'dist', 'tailwind', 'tokens.json');
const LEGACY_ARTIFACT_TOKENS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'tokens.tailwind.json');

let cachedPath: string | null = null;
let cachedIndex: TokenIndex | null = null;

const STYLE_TO_UTILITY: Record<string, TailwindUtility> = {
  color: 'text',
  background: 'bg',
  backgroundColor: 'bg',
  borderColor: 'border',
  padding: 'p',
  paddingTop: 'pt',
  paddingRight: 'pr',
  paddingBottom: 'pb',
  paddingLeft: 'pl',
  margin: 'm',
  marginTop: 'mt',
  marginRight: 'mr',
  marginBottom: 'mb',
  marginLeft: 'ml',
  gap: 'gap',
  rowGap: 'gap-y',
  columnGap: 'gap-x',
  borderRadius: 'rounded',
  boxShadow: 'shadow',
  opacity: 'opacity',
  fontFamily: 'font',
  fontWeight: 'font',
  fontSize: 'text',
  lineHeight: 'leading',
  letterSpacing: 'tracking',
  font: 'font',
};

function normalizeTokenKey(token: string): string {
  return token
    .trim()
    .replace(/^\{(.+)\}$/, '$1')
    .toLowerCase()
    .replace(/[.\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function parseCssVar(value: string): string | null {
  const match = value.trim().match(/^var\(\s*(--[a-z0-9-_]+)\s*\)$/i);
  return match ? match[1].toLowerCase() : null;
}

function cssVariableForTokenKey(tokenKey: string, prefix: string): string {
  if (/^(ref|theme|sys|cmp)-/.test(tokenKey)) {
    return `--${tokenKey}`;
  }
  return `--${prefix}-${tokenKey}`;
}

function cssVarToTokenKey(cssVar: string, prefix: string): string {
  const raw = cssVar.replace(/^--/, '').toLowerCase();
  return raw.startsWith(`${prefix}-`) ? raw.slice(prefix.length + 1) : raw;
}

function toFiniteNumber(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePx(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('px')) {
    const parsed = toFiniteNumber(trimmed.slice(0, -2));
    return parsed === null ? null : Math.round(parsed);
  }
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    const parsed = toFiniteNumber(trimmed.slice(0, -3));
    return parsed === null ? null : Math.round(parsed * 16);
  }
  const numeric = toFiniteNumber(trimmed);
  return numeric === null ? null : Math.round(numeric);
}

function resolveSpacingScale(value: string | null): string | null {
  if (!value) return null;
  const px = parsePx(value);
  if (px === null) return null;
  return TAILWIND_SPACING_SCALE.get(px) ?? null;
}

function resolveRadiusScale(value: string | null): string | null {
  if (!value) return null;
  if (value.trim().toLowerCase() === '999px') return 'full';
  const px = parsePx(value);
  if (px === null) return null;
  return TAILWIND_RADIUS_SCALE.get(px) ?? null;
}

function resolveTextSizeScale(value: string | null): string | null {
  if (!value) return null;
  const px = parsePx(value);
  if (px === null) return null;
  return TAILWIND_TEXT_SIZE_SCALE.get(px) ?? null;
}

function resolveLeadingScale(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const ratio = trimmed.endsWith('%')
    ? toFiniteNumber(trimmed.slice(0, -1))! / 100
    : toFiniteNumber(trimmed);
  if (!ratio || !Number.isFinite(ratio)) return null;
  if (ratio <= 1.25) return 'tight';
  if (ratio <= 1.4) return 'snug';
  if (ratio <= 1.55) return 'normal';
  if (ratio <= 1.65) return 'relaxed';
  return 'loose';
}

function resolveOpacityScale(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const numeric = trimmed.endsWith('%')
    ? toFiniteNumber(trimmed.slice(0, -1))
    : toFiniteNumber(trimmed);
  if (numeric === null) return null;
  const percent = trimmed.endsWith('%')
    ? numeric
    : (numeric <= 1 ? numeric * 100 : numeric);

  const candidates = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100];
  let best = candidates[0];
  let diff = Math.abs(percent - best);
  for (const option of candidates) {
    const current = Math.abs(percent - option);
    if (current < diff) {
      diff = current;
      best = option;
    }
  }
  return String(best);
}

function resolveFontClass(tokenKey: string, value: string | null): string | null {
  if (/families-sans|font-family/.test(tokenKey) || /sans-serif/.test(value ?? '')) {
    return 'font-sans';
  }
  if (/families-mono/.test(tokenKey) || /\bmonospace\b/.test(value ?? '')) {
    return 'font-mono';
  }
  if (/weights-bold|font-weight.*bold/.test(tokenKey) || value === '700') {
    return 'font-bold';
  }
  if (/weights-semibold|font-weight.*semibold/.test(tokenKey) || value === '600') {
    return 'font-semibold';
  }
  if (/weights-medium|font-weight.*medium/.test(tokenKey) || value === '500') {
    return 'font-medium';
  }
  if (/weights-regular|font-weight.*regular/.test(tokenKey) || value === '400') {
    return 'font-normal';
  }
  return null;
}

function sanitizeArbitrary(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}

function arbitraryClass(utility: TailwindUtility, value: string): string {
  return `${utility}-[${sanitizeArbitrary(value)}]`;
}

function chooseBestPrefixMatch(matches: string[], utility: TailwindUtility): string | null {
  if (matches.length === 0) return null;
  const scored = matches
    .map((tokenKey) => {
      let score = 0;
      if (tokenKey.endsWith('-default')) score += 12;
      if (tokenKey.endsWith('-500') || tokenKey.endsWith('-md')) score += 10;
      if (tokenKey.includes('-primary')) score += 6;
      if (utility === 'rounded' && tokenKey.includes('radius')) score += 4;
      if (utility === 'shadow' && tokenKey.includes('shadow')) score += 4;
      score -= tokenKey.length * 0.001;
      return { tokenKey, score };
    })
    .sort((a, b) => b.score - a.score || a.tokenKey.localeCompare(b.tokenKey));
  return scored[0]?.tokenKey ?? null;
}

function findLatestTokensBuildArtifact(): string | null {
  const runsDir = path.join(REPO_ROOT, 'artifacts', 'runs');
  if (!fs.existsSync(runsDir)) return null;

  const dates = fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  for (const dateDir of dates) {
    const candidate = path.join(runsDir, dateDir, 'tokens.build', 'tokens.tailwind.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function flattenDtcgLayers(
  payload: TailwindPayload,
  prefix: string,
): Record<string, FlatTokenEntry> {
  if (!payload.layers || typeof payload.layers !== 'object') return {};

  const flat: Record<string, FlatTokenEntry> = {};
  const visit = (node: unknown, parts: string[]): void => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;

    if ('$value' in rec || 'value' in rec) {
      const tokenKey = normalizeTokenKey(parts.join('-'));
      if (!tokenKey) return;
      const value = typeof rec.$value !== 'undefined' ? rec.$value : rec.value;
      flat[tokenKey] = {
        name: tokenKey,
        value,
        originalValue: value,
        cssVariable: cssVariableForTokenKey(tokenKey, prefix),
      };
      return;
    }

    for (const [key, child] of Object.entries(rec)) {
      if (key.startsWith('$')) continue;
      visit(child, [...parts, key]);
    }
  };

  for (const [layerName, layerNode] of Object.entries(payload.layers)) {
    visit(layerNode, [layerName]);
  }

  return flat;
}

function emptyIndex(prefix = 'oods'): TokenIndex {
  return {
    prefix,
    keys: [],
    entries: new Map<string, FlatTokenEntry>(),
    byCssVar: new Map<string, string>(),
  };
}

function readTokenIndex(tokensPath?: string): TokenIndex {
  const pathCandidates: Array<string | undefined | null> = [
    tokensPath,
    process.env.OODS_TAILWIND_TOKENS_PATH,
    DEFAULT_TOKENS_PATH,
    LEGACY_ARTIFACT_TOKENS_PATH,
    findLatestTokensBuildArtifact(),
  ];

  const resolved = pathCandidates.find((candidate) => (
    typeof candidate === 'string' && candidate.length > 0 && fs.existsSync(candidate)
  )) ?? null;

  if (!resolved) return emptyIndex();

  if (cachedPath === resolved && cachedIndex) {
    return cachedIndex;
  }

  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    const payload = JSON.parse(raw) as TailwindPayload;
    const prefix = typeof payload.prefix === 'string' && payload.prefix.trim()
      ? payload.prefix.trim()
      : 'oods';

    const payloadFlat = payload.flat && typeof payload.flat === 'object'
      ? payload.flat
      : flattenDtcgLayers(payload, prefix);

    const entries = new Map<string, FlatTokenEntry>();
    const byCssVar = new Map<string, string>();

    for (const [rawKey, rawValue] of Object.entries(payloadFlat)) {
      if (!rawValue || typeof rawValue !== 'object') continue;
      const tokenKey = normalizeTokenKey(rawKey);
      const entry: FlatTokenEntry = {
        ...(rawValue as FlatTokenEntry),
        name: tokenKey,
      };
      entries.set(tokenKey, entry);

      const declaredVar = typeof entry.cssVariable === 'string' ? entry.cssVariable.toLowerCase() : null;
      const derivedVar = cssVariableForTokenKey(tokenKey, prefix).toLowerCase();
      byCssVar.set(derivedVar, tokenKey);
      if (declaredVar) byCssVar.set(declaredVar, tokenKey);
    }

    const index: TokenIndex = {
      prefix,
      keys: Array.from(entries.keys()).sort(),
      entries,
      byCssVar,
    };

    cachedPath = resolved;
    cachedIndex = index;
    return index;
  } catch {
    return emptyIndex();
  }
}

function statesFor(options: TailwindMapOptions): TailwindState[] {
  const incoming = options.states ?? [];
  return incoming.filter((state): state is TailwindState => SUPPORTED_STATES.has(state));
}

function withStates(baseClass: string, options: TailwindMapOptions): string[] {
  const states = statesFor(options);
  const includeBase = options.includeBase ?? true;
  if (states.length === 0) return [baseClass];

  const classes: string[] = [];
  if (includeBase) classes.push(baseClass);
  for (const state of states) {
    classes.push(`${state}:${baseClass}`);
  }
  return classes;
}

function expandTokenCandidates(tokenKey: string, utility: TailwindUtility): string[] {
  const candidates = new Set<string>();
  const add = (candidate: string): void => {
    const normalized = normalizeTokenKey(candidate);
    if (normalized) candidates.add(normalized);
  };

  add(tokenKey);
  // #552 / sprint-125 m03: RETAINED after a producer sweep (not retired). All four
  // inline emitters (react-emitter, vue-emitter, tree-renderer, component-map) now
  // emit canonical --*-space-* directly, so they no longer feed --*-spacing-* here.
  // BUT the spacing→space repair must STAY: base/tokens spacing.json keeps a top-level
  // `spacing.*` namespace (it emits --oods-spacing-* + `spacing-*` Tailwind keys), so
  // cssVarToTokenKey synthesis still produces spacing-prefixed token keys that this
  // resolver must map onto the canonical `space-*` index. Keep the doubled-prefix +
  // radius lines below too.
  add(tokenKey.replace(/^ref-spacing-/, 'ref-space-'));
  add(tokenKey.replace(/^theme-spacing-/, 'theme-space-'));
  add(tokenKey.replace(/^sys-spacing-/, 'sys-space-'));
  add(tokenKey.replace(/^spacing-/, 'space-'));
  add(tokenKey.replace(/^ref-spacing-spacing-/, 'ref-space-'));
  add(tokenKey.replace(/^theme-spacing-spacing-/, 'theme-space-'));
  add(tokenKey.replace(/^sys-spacing-spacing-/, 'sys-space-'));
  add(tokenKey.replace(/^ref-radius-/, 'ref-border-radius-'));
  add(tokenKey.replace(/^radius-/, 'border-radius-'));
  add(tokenKey.replace(/^sys-radius-/, 'sys-border-radius-'));
  add(tokenKey.replace(/^theme-radius-/, 'theme-border-radius-'));

  if ((utility === 'text' || utility === 'bg' || utility === 'border') && tokenKey.startsWith('sys-color-')) {
    add(tokenKey.replace(/^sys-color-/, utility === 'text'
      ? 'sys-text-'
      : utility === 'bg'
        ? 'sys-surface-'
        : 'sys-border-'));
  }
  if ((utility === 'text' || utility === 'bg' || utility === 'border') && tokenKey.startsWith('theme-color-')) {
    add(tokenKey.replace(/^theme-color-/, utility === 'text'
      ? 'theme-text-'
      : utility === 'bg'
        ? 'theme-surface-'
        : 'theme-border-'));
  }
  if (tokenKey.startsWith('ref-color-') && !/-\d+$/.test(tokenKey)) {
    add(`${tokenKey}-500`);
  }

  return Array.from(candidates);
}

function resolveTokenKey(tokenRef: string, utility: TailwindUtility, index: TokenIndex): string | null {
  const cssVar = parseCssVar(tokenRef);

  if (cssVar && index.byCssVar.has(cssVar)) {
    return index.byCssVar.get(cssVar) ?? null;
  }

  const base = cssVar
    ? cssVarToTokenKey(cssVar, index.prefix)
    : normalizeTokenKey(tokenRef);
  const candidates = expandTokenCandidates(base, utility);

  for (const candidate of candidates) {
    if (index.entries.has(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    const matches = index.keys.filter((key) => key === candidate || key.startsWith(`${candidate}-`));
    const chosen = chooseBestPrefixMatch(matches, utility);
    if (chosen) return chosen;
  }

  return null;
}

function aliasKeyFromValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const directAlias = value.match(/^\{([^}]+)\}$/);
  if (directAlias) return normalizeTokenKey(directAlias[1]);
  const cssVar = parseCssVar(value);
  if (cssVar) return null;
  return null;
}

function resolvePrimitiveValue(tokenKey: string, index: TokenIndex, seen = new Set<string>()): string | null {
  if (seen.has(tokenKey)) return null;
  const entry = index.entries.get(tokenKey);
  if (!entry) return null;

  seen.add(tokenKey);

  const aliasFromValue = aliasKeyFromValue(entry.value);
  if (aliasFromValue && index.entries.has(aliasFromValue)) {
    return resolvePrimitiveValue(aliasFromValue, index, seen);
  }

  const aliasFromOriginal = aliasKeyFromValue(entry.originalValue);
  if (aliasFromOriginal && index.entries.has(aliasFromOriginal)) {
    return resolvePrimitiveValue(aliasFromOriginal, index, seen);
  }

  if (typeof entry.value === 'number') return String(entry.value);

  if (typeof entry.value === 'string') {
    const cssVar = parseCssVar(entry.value);
    if (cssVar && index.byCssVar.has(cssVar)) {
      const aliasKey = index.byCssVar.get(cssVar);
      if (aliasKey && aliasKey !== tokenKey) {
        const resolved = resolvePrimitiveValue(aliasKey, index, seen);
        if (resolved) return resolved;
      }
    }
    return entry.value;
  }

  return null;
}

function colorSlug(tokenKey: string, utility: TailwindUtility): string | null {
  const statusMatch = tokenKey.match(/status-([a-z0-9-]+?)-(text|icon|surface|border)$/);
  if (statusMatch) return `status-${statusMatch[1]}`;

  if (utility === 'text') {
    const m = tokenKey.match(/(?:^|-)text-([a-z0-9-]+)$/) ?? tokenKey.match(/(?:^|-)color-([a-z0-9-]+)$/);
    return m ? m[1] : null;
  }

  if (utility === 'bg') {
    const m = tokenKey.match(/(?:^|-)(?:surface|background)-([a-z0-9-]+)$/);
    return m ? m[1] : null;
  }

  if (utility === 'border') {
    const m = tokenKey.match(/(?:^|-)border-([a-z0-9-]+)$/);
    return m ? m[1] : null;
  }

  return null;
}

function directClassForToken(
  tokenKey: string,
  utility: TailwindUtility,
  primitiveValue: string | null,
): string | null {
  if (utility === 'text' && /font-size|sizes-/.test(tokenKey)) {
    const scale = resolveTextSizeScale(primitiveValue);
    if (scale) return `text-${scale}`;
  }

  if (utility === 'text' || utility === 'bg' || utility === 'border') {
    const slug = colorSlug(tokenKey, utility);
    if (slug) return `${utility}-${slug}`;
  }

  if (utility === 'p'
    || utility === 'pt'
    || utility === 'pr'
    || utility === 'pb'
    || utility === 'pl'
    || utility === 'm'
    || utility === 'mt'
    || utility === 'mr'
    || utility === 'mb'
    || utility === 'ml'
    || utility === 'gap'
    || utility === 'gap-x'
    || utility === 'gap-y') {
    const scale = resolveSpacingScale(primitiveValue);
    if (scale) return `${utility}-${scale}`;
  }

  if (utility === 'rounded') {
    const scale = resolveRadiusScale(primitiveValue);
    if (scale) return `rounded-${scale}`;
  }

  if (utility === 'leading') {
    const scale = resolveLeadingScale(primitiveValue);
    if (scale) return `leading-${scale}`;
  }

  if (utility === 'opacity') {
    const scale = resolveOpacityScale(primitiveValue);
    if (scale) return `opacity-${scale}`;
  }

  if (utility === 'font') {
    return resolveFontClass(tokenKey, primitiveValue);
  }

  if (utility === 'shadow') {
    if (tokenKey.includes('overlay')) return 'shadow-lg';
    if (tokenKey.includes('card')) return 'shadow-md';
    if (tokenKey.includes('subtle')) return 'shadow-sm';
    if (tokenKey.includes('strong')) return 'shadow';
  }

  if (utility === 'tracking') {
    if (primitiveValue?.startsWith('-')) return 'tracking-tight';
    if (primitiveValue === '0em' || primitiveValue === '0') return 'tracking-normal';
    if (primitiveValue?.endsWith('em')) {
      const numeric = toFiniteNumber(primitiveValue.slice(0, -2));
      if (numeric !== null && numeric > 0.05) return 'tracking-wide';
    }
  }

  return null;
}

function tokenFallbackClass(
  tokenRef: string,
  utility: TailwindUtility,
  resolvedTokenKey: string | null,
  index: TokenIndex,
): string {
  const cssVar = parseCssVar(tokenRef);
  if (cssVar) {
    return arbitraryClass(utility, `var(${cssVar})`);
  }

  if (resolvedTokenKey) {
    return arbitraryClass(utility, `var(${cssVariableForTokenKey(resolvedTokenKey, index.prefix)})`);
  }

  const fallbackKey = normalizeTokenKey(tokenRef);
  return arbitraryClass(utility, `var(--${fallbackKey})`);
}

function literalClassForUtility(utility: TailwindUtility, value: string): string {
  if (utility === 'p'
    || utility === 'pt'
    || utility === 'pr'
    || utility === 'pb'
    || utility === 'pl'
    || utility === 'm'
    || utility === 'mt'
    || utility === 'mr'
    || utility === 'mb'
    || utility === 'ml'
    || utility === 'gap'
    || utility === 'gap-x'
    || utility === 'gap-y') {
    const scale = resolveSpacingScale(value);
    return scale ? `${utility}-${scale}` : arbitraryClass(utility, value);
  }

  if (utility === 'rounded') {
    const scale = resolveRadiusScale(value);
    return scale ? `rounded-${scale}` : arbitraryClass(utility, value);
  }

  if (utility === 'text') {
    const size = resolveTextSizeScale(value);
    return size ? `text-${size}` : arbitraryClass(utility, value);
  }

  if (utility === 'leading') {
    const leading = resolveLeadingScale(value);
    return leading ? `leading-${leading}` : arbitraryClass(utility, value);
  }

  if (utility === 'opacity') {
    const opacity = resolveOpacityScale(value);
    return opacity ? `opacity-${opacity}` : arbitraryClass(utility, value);
  }

  if (utility === 'font') {
    const font = resolveFontClass('', value);
    return font ?? arbitraryClass(utility, value);
  }

  return arbitraryClass(utility, value);
}

function isTokenReference(value: string): boolean {
  return /^var\(/i.test(value.trim())
    || /^(sys|ref|theme|cmp)([.-])/i.test(value.trim())
    || /^\{[^}]+\}$/.test(value.trim());
}

function normalizeStyleProperty(prop: string): string {
  const trimmed = prop.trim();
  if (!trimmed.includes('-')) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function mapLayoutClass(property: string, value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (property === 'display') {
    const map: Record<string, string> = {
      flex: 'flex',
      grid: 'grid',
      block: 'block',
      'inline-flex': 'inline-flex',
      'inline-grid': 'inline-grid',
      'inline-block': 'inline-block',
    };
    return map[normalized] ?? null;
  }

  if (property === 'flexDirection') {
    const map: Record<string, string> = {
      row: 'flex-row',
      column: 'flex-col',
      'row-reverse': 'flex-row-reverse',
      'column-reverse': 'flex-col-reverse',
    };
    return map[normalized] ?? null;
  }

  if (property === 'justifyContent') {
    const map: Record<string, string> = {
      'flex-start': 'justify-start',
      start: 'justify-start',
      center: 'justify-center',
      'flex-end': 'justify-end',
      end: 'justify-end',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };
    return map[normalized] ?? null;
  }

  if (property === 'alignItems') {
    const map: Record<string, string> = {
      'flex-start': 'items-start',
      start: 'items-start',
      center: 'items-center',
      'flex-end': 'items-end',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    };
    return map[normalized] ?? null;
  }

  if (property === 'gridTemplateColumns') {
    return `grid-cols-[${sanitizeArbitrary(value)}]`;
  }

  return null;
}

export function mapTokenToTailwind(
  tokenRef: string,
  utility: TailwindUtility,
  options: TailwindMapOptions = {},
): string[] {
  const index = readTokenIndex(options.tokensPath);
  const tokenKey = resolveTokenKey(tokenRef, utility, index);
  const primitive = tokenKey ? resolvePrimitiveValue(tokenKey, index) : null;
  const directClass = tokenKey ? directClassForToken(tokenKey, utility, primitive) : null;
  const baseClass = directClass ?? tokenFallbackClass(tokenRef, utility, tokenKey, index);
  return withStates(baseClass, options);
}

export function inlineStyleToTailwind(
  styleObj: Record<string, string>,
  options: TailwindMapOptions = {},
): string {
  const classes = new Set<string>();

  for (const [rawProperty, rawValue] of Object.entries(styleObj)) {
    const property = normalizeStyleProperty(rawProperty);
    const value = String(rawValue).trim();
    if (!value) continue;

    const layoutClass = mapLayoutClass(property, value);
    if (layoutClass) {
      for (const cls of withStates(layoutClass, options)) classes.add(cls);
      continue;
    }

    const utility = Object.hasOwn(STYLE_TO_UTILITY, property)
      ? STYLE_TO_UTILITY[property]
      : undefined;
    if (!utility) continue;

    if (isTokenReference(value)) {
      for (const cls of mapTokenToTailwind(value, utility, options)) classes.add(cls);
      continue;
    }

    for (const cls of withStates(literalClassForUtility(utility, value), options)) {
      classes.add(cls);
    }
  }

  return Array.from(classes).join(' ');
}

function toCamelCase(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (cleaned.length === 0) return 'component';
  return cleaned
    .map((part, idx) => (
      idx === 0
        ? part.toLowerCase()
        : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`
    ))
    .join('');
}

function normalizeVariantValue(value: string | string[]): string {
  return Array.isArray(value)
    ? value.join(' ').trim().replace(/\s+/g, ' ')
    : value.trim().replace(/\s+/g, ' ');
}

export function createVariants(
  component: string,
  variants: TailwindVariants,
  base: string | string[] = '',
): string {
  const variableName = `${toCamelCase(component)}Variants`;
  const normalizedBase = normalizeVariantValue(base);

  const normalizedVariants: Record<string, Record<string, string>> = {};
  for (const [variantName, optionsByName] of Object.entries(variants)) {
    normalizedVariants[variantName] = {};
    for (const [optionName, optionValue] of Object.entries(optionsByName)) {
      normalizedVariants[variantName][optionName] = normalizeVariantValue(optionValue);
    }
  }

  const config = serializeJavaScriptJson({ variants: normalizedVariants }, 2);
  return `const ${variableName} = cva(${javascriptSingleQuotedString(normalizedBase)}, ${config});`;
}
