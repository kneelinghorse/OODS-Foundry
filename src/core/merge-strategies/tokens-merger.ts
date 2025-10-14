/**
 * Tokens Merger
 *
 * Handles merging of token definitions from multiple traits.
 * Tokens are namespaced by trait to avoid collisions.
 */

import type { TokenDefinition } from '../trait-definition.js';

/**
 * Result of tokens merge operation
 */
export interface TokensMergeResult {
  /**
   * The merged tokens
   */
  tokens: TokenDefinition;

  /**
   * Warnings generated during merge
   */
  warnings: string[];

  /**
   * Conflicts detected (duplicate token names)
   */
  conflicts: Array<{ tokenPath: string; sources: string[] }>;
}

/**
 * Deep merge two token definitions
 *
 * Tokens are recursively merged. Later traits override earlier ones
 * for the same token path.
 */
export function mergeTokens(
  base: TokenDefinition,
  overlay: TokenDefinition,
  baseName?: string,
  overlayName?: string
): TokensMergeResult {
  const warnings: string[] = [];
  const conflicts: Array<{ tokenPath: string; sources: string[] }> = [];

  function mergeRecursive(
    baseObj: TokenDefinition,
    overlayObj: TokenDefinition,
    path: string = ''
  ): TokenDefinition {
    const result: TokenDefinition = { ...baseObj };

    for (const [key, value] of Object.entries(overlayObj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in baseObj)) {
        // No conflict - just add
        result[key] = value;
      } else {
        const baseValue = baseObj[key];

        // Check if both values are objects (nested tokens)
        if (
          typeof baseValue === 'object' &&
          baseValue !== null &&
          !Array.isArray(baseValue) &&
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // Recursively merge nested objects
          result[key] = mergeRecursive(
            baseValue as TokenDefinition,
            value as TokenDefinition,
            currentPath
          );
        } else {
          // Conflict - overlay wins
          result[key] = value;

          if (baseValue !== value) {
            conflicts.push({
              tokenPath: currentPath,
              sources: [baseName || 'base', overlayName || 'overlay'],
            });

            warnings.push(
              `Token "${currentPath}" redefined: "${String(baseValue)}" → "${String(value)}"`
            );
          }
        }
      }
    }

    return result;
  }

  const mergedTokens = mergeRecursive(base, overlay);

  return {
    tokens: mergedTokens,
    warnings,
    conflicts,
  };
}

/**
 * Merge multiple token definitions in sequence
 */
export function mergeMultipleTokens(
  tokensList: Array<{ tokens: TokenDefinition; sourceName: string }>
): TokensMergeResult {
  if (tokensList.length === 0) {
    return {
      tokens: {},
      warnings: [],
      conflicts: [],
    };
  }

  if (tokensList.length === 1) {
    return {
      tokens: tokensList[0].tokens,
      warnings: [],
      conflicts: [],
    };
  }

  let result: TokensMergeResult = {
    tokens: tokensList[0].tokens,
    warnings: [],
    conflicts: [],
  };

  for (let i = 1; i < tokensList.length; i++) {
    const nextMerge = mergeTokens(
      result.tokens,
      tokensList[i].tokens,
      i === 1 ? tokensList[0].sourceName : 'merged',
      tokensList[i].sourceName
    );

    result = {
      tokens: nextMerge.tokens,
      warnings: [...result.warnings, ...nextMerge.warnings],
      conflicts: [...result.conflicts, ...nextMerge.conflicts],
    };
  }

  return result;
}

/**
 * Apply namespace prefixing to token definitions
 *
 * This is useful for domain traits to avoid token name collisions.
 * For example, a "user" domain trait might prefix all tokens with "user-".
 */
export function namespaceTokens(
  tokens: TokenDefinition,
  namespace: string
): TokenDefinition {
  const namespaced: TokenDefinition = {};

  for (const [key, value] of Object.entries(tokens)) {
    const namespacedKey = `${namespace}-${key}`;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively namespace nested objects
      namespaced[namespacedKey] = namespaceTokens(value as TokenDefinition, namespace);
    } else {
      namespaced[namespacedKey] = value;
    }
  }

  return namespaced;
}
