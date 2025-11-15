import tokensBundle, {
  flatTokens as exportedFlatTokens,
  prefix as exportedPrefix,
} from '@oods/tokens';

type FlatTokenRecord = {
  value?: unknown;
  path?: unknown;
  cssVariable?: unknown;
  description?: unknown;
};

type TokenMeta = {
  value?: string;
  cssVariable?: string;
  tokenKey: string;
  path: string;
};

type TokenResolutionSource = 'path' | 'flat' | 'derived' | 'manual';

export type TokenResolution = {
  value?: string;
  cssVariable?: string;
  tokenKey?: string;
  path?: string;
  source?: TokenResolutionSource;
};

const flatRecord =
  (exportedFlatTokens as Record<string, FlatTokenRecord> | undefined) ??
  (tokensBundle?.flatTokens as Record<string, FlatTokenRecord> | undefined) ??
  {};
const prefix =
  typeof exportedPrefix === 'string' && exportedPrefix.length > 0
    ? exportedPrefix
    : typeof tokensBundle?.prefix === 'string' && tokensBundle.prefix.length > 0
      ? tokensBundle.prefix
      : 'oods';
const prefixlessNamespaces = new Set(['ref', 'theme', 'sys', 'cmp']);

const valueByFlat = new Map<string, TokenMeta>();
const valueByPath = new Map<string, TokenMeta>();

const toArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((segment): segment is string => typeof segment === 'string');
};

const registerTokenMeta = (flatKey: string, record: FlatTokenRecord) => {
  if (!record || typeof record !== 'object') {
    return;
  }

  const pathSegments = toArray(record.path);
  if (pathSegments.length === 0) {
    return;
  }

  const path = pathSegments.join('.');
  const cssVariable =
    typeof record.cssVariable === 'string' && record.cssVariable.trim().length > 0
      ? record.cssVariable.trim()
      : (() => {
          const namespace = typeof pathSegments[0] === 'string' ? pathSegments[0] : undefined;
          if (namespace && prefixlessNamespaces.has(namespace)) {
            return `--${flatKey}`;
          }
          return `--${prefix}-${flatKey}`;
        })();

  const value = typeof record.value === 'string' ? record.value : undefined;

  const meta: TokenMeta = {
    value,
    cssVariable,
    tokenKey: flatKey,
    path
  };

  valueByFlat.set(flatKey, meta);
  valueByPath.set(path, meta);
};

Object.entries(flatRecord).forEach(([flatKey, record]) => registerTokenMeta(flatKey, record));

const manualAliases = new Map<string, string>([
  ['color.text.accent', '#8b5cf6'],
  ['color.background.accent.subtle', '#f5f3ff'],
  ['color.border.accent', '#c4b5fd'],
  ['color.text.neutral', valueByPath.get('text.muted')?.value ?? '#475569'],
  ['color.background.neutral.subtle', valueByPath.get('surface.subtle')?.value ?? '#f1f5f9'],
  ['color.border.neutral', '#cbd5e1'],
  ['color.text.disabled', '#94a3b8'],
  ['color.background.disabled', '#e2e8f0'],
  ['color.border.disabled', '#cbd5e1'],
  ['color.text.onbold', '#ffffff'],
  ['color.background.warning.bold', '#f59e0b'],
  ['color.background.danger.bold', '#ef4444'],
  ['color.border.warning', valueByPath.get('status.warning.border')?.value ?? '#facc15'],
  ['color.border.danger', valueByPath.get('status.critical.border')?.value ?? '#fca5a5'],
  ['color.border.info', valueByPath.get('status.info.border')?.value ?? '#bfdbfe'],
  ['color.text.warning', valueByPath.get('status.warning.text')?.value ?? '#b45309'],
  ['color.background.info.subtle', valueByPath.get('status.info.surface')?.value ?? '#dbeafe']
]);

const statusToneMap: Record<string, string> = {
  info: 'info',
  positive: 'success',
  danger: 'critical',
  warning: 'warning',
  critical: 'critical',
  success: 'success'
};

const toFlatKey = (tokenName: string): string =>
  tokenName
    .trim()
    .replace(/\.+/g, '-')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const toResolution = (meta: TokenMeta, source: TokenResolutionSource): TokenResolution => ({
  value: meta.value,
  cssVariable: meta.cssVariable,
  tokenKey: meta.tokenKey,
  path: meta.path,
  source
});

const tryResolve = (tokenName: string): TokenResolution | undefined => {
  const directByPath = valueByPath.get(tokenName);
  if (directByPath) {
    return toResolution(directByPath, 'path');
  }

  const flatKey = toFlatKey(tokenName);
  const directByFlat = valueByFlat.get(flatKey);
  if (directByFlat) {
    return toResolution(directByFlat, 'flat');
  }

  return undefined;
};

const resolveColorFamily = (tokenName: string): TokenResolution | undefined => {
  const parts = tokenName.split('.');
  if (parts.length < 3) {
    return undefined;
  }

  const [, category, tone, level] = parts;
  const mappedTone = statusToneMap[tone];

  if (!category || !mappedTone) {
    return undefined;
  }

  if (category === 'text') {
    return tryResolve(`status.${mappedTone}.text`);
  }

  if (category === 'background') {
    if (level === 'subtle') {
      return tryResolve(`status.${mappedTone}.surface`);
    }
    if (level === 'bold') {
      return (
        tryResolve(`status.${mappedTone}.surface`) ??
        tryResolve(`status.${mappedTone}.text`)
      );
    }
  }

  if (category === 'border') {
    return tryResolve(`status.${mappedTone}.border`);
  }

  return undefined;
};

export const resolveTokenMeta = (tokenName: string): TokenResolution => {
  if (typeof tokenName !== 'string') {
    return {};
  }

  const trimmed = tokenName.trim();
  if (!trimmed) {
    return {};
  }

  const direct = tryResolve(trimmed);
  if (direct) {
    return direct;
  }

  if (trimmed.startsWith('base.')) {
    const withoutBase = trimmed.slice(5);
    const derived = tryResolve(withoutBase);
    if (derived) {
      return { ...derived, source: 'derived' };
    }
  }

  if (trimmed.startsWith('color.')) {
    const resolved = resolveColorFamily(trimmed);
    if (resolved) {
      return { ...resolved, source: 'derived' };
    }
  }

  const alias = manualAliases.get(trimmed);
  if (alias) {
    return {
      value: alias,
      cssVariable: undefined,
      tokenKey: undefined,
      path: trimmed,
      source: 'manual'
    };
  }

  const sanitized = toFlatKey(trimmed);
  const fallback = valueByFlat.get(sanitized);
  if (fallback) {
    return toResolution(fallback, 'flat');
  }

  return {};
};

export const resolveTokenValue = (tokenName: string): string | undefined =>
  resolveTokenMeta(tokenName).value;
