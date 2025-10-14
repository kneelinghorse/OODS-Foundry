import { normaliseColor } from './color.js';
import type { FlatTokenEntry, FlatTokenMap, TokenSample } from './types.js';

export const normalizeTokenExpression = (expression: string): string =>
  expression
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[./]/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

export function resolveFlatToken(
  flatTokens: FlatTokenMap,
  expression: string,
): { entry: FlatTokenEntry; key: string } {
  const key = normalizeTokenExpression(expression);
  const entry = flatTokens[key];

  if (!entry) {
    throw new Error(`Token "${expression}" (normalised: "${key}") not found in flat token map.`);
  }

  if (typeof entry.value !== 'string') {
    throw new Error(`Token "${expression}" does not expose a string value.`);
  }

  return { entry, key };
}

export function resolveColorSample(
  flatTokens: FlatTokenMap,
  expression: string,
  prefix = 'oods',
): TokenSample {
  const { entry, key } = resolveFlatToken(flatTokens, expression);
  const value = normaliseColor(entry.value, expression);
  const cssVariable =
    typeof entry.cssVariable === 'string' && entry.cssVariable.length > 0
      ? entry.cssVariable
      : `--${prefix}-${key}`;

  return {
    key,
    value,
    cssVariable,
  };
}
