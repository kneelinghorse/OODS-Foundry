import * as tokensModule from '@oods/tokens';

type FlatTokenEntry = {
  readonly value?: unknown;
  readonly cssVariable?: unknown;
  readonly path?: unknown;
  readonly [key: string]: unknown;
};

type TokenNamespace = {
  readonly tokens?: Record<string, unknown>;
  readonly flatTokens?: Record<string, FlatTokenEntry>;
  readonly cssVariables?: Record<string, unknown>;
  readonly meta?: Record<string, unknown>;
  readonly prefix?: string;
  readonly default?: TokenNamespace;
};

const namespace = tokensModule as TokenNamespace;

const resolved: TokenNamespace = {
  ...(namespace.default ?? {}),
  ...namespace,
};

export const tokens = resolved.tokens ?? {};
export const flatTokens = resolved.flatTokens ?? {};
export const cssVariables = resolved.cssVariables ?? {};
export const meta = resolved.meta ?? {};
export const prefix = resolved.prefix ?? 'oods';

export type FlatTokensMap = typeof flatTokens;
export type FlatTokenEntryMap = FlatTokenEntry;
