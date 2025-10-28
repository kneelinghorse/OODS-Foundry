import { flatTokens } from './design-tokens';

type FlatTokenRecord = {
  path?: unknown;
  value?: unknown;
  cssVariable?: unknown;
};

type TokenMeta = {
  value?: string;
  cssVariable?: string;
};

const flatRecord = (flatTokens ?? {}) as Record<string, FlatTokenRecord>;

const metaByPath = new Map<string, TokenMeta>();

const toPath = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const segments = value.filter((segment): segment is string => typeof segment === 'string');
  if (segments.length === 0) {
    return null;
  }
  return segments.join('.');
};

for (const record of Object.values(flatRecord)) {
  if (!record || typeof record !== 'object') {
    continue;
  }
  const path = toPath(record.path);
  if (!path) {
    continue;
  }
  const value =
    typeof record.value === 'string' && record.value.trim().length > 0
      ? record.value.trim()
      : undefined;
  const cssVariable =
    typeof record.cssVariable === 'string' && record.cssVariable.trim().length > 0
      ? record.cssVariable.trim()
      : undefined;

  metaByPath.set(path, { value, cssVariable });
}

const byShortPath = new Map<string, TokenMeta>();
for (const [path, meta] of metaByPath) {
  byShortPath.set(path.toLowerCase(), meta);
}

export const getTokenValue = (path: string): string | undefined => {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return undefined;
  }
  return byShortPath.get(path.trim().toLowerCase())?.value;
};

export const getTokenCssVariable = (path: string): string | undefined => {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return undefined;
  }
  return byShortPath.get(path.trim().toLowerCase())?.cssVariable;
};

export const formatTokenReference = (
  path: string,
  cssVariableFallback: string,
  fallbackValue: string
): string => {
  const direct = getTokenValue(path);
  if (direct && direct.trim().length > 0) {
    return direct;
  }

  const cssVar = getTokenCssVariable(path);
  if (cssVar) {
    return `var(${cssVar}, ${fallbackValue})`;
  }

  return `var(${cssVariableFallback}, ${fallbackValue})`;
};
