/**
 * Semantics Merger
 *
 * Handles merging of semantic mappings from multiple traits.
 * Semantic mappings define how fields map to semantic types and UI hints.
 */

import type { SemanticMapping } from '../trait-definition.js';

/**
 * Result of semantics merge operation
 */
export interface SemanticsMergeResult {
  /**
   * The merged semantics
   */
  semantics: Record<string, SemanticMapping>;

  /**
   * Warnings generated during merge
   */
  warnings: string[];
}

/**
 * Deep merge two semantic mappings
 */
function mergeSemanticMapping(
  base: SemanticMapping,
  overlay: SemanticMapping
): SemanticMapping {
  return {
    semantic_type: overlay.semantic_type || base.semantic_type,
    token_mapping: overlay.token_mapping || base.token_mapping,
    ui_hints: {
      ...base.ui_hints,
      ...overlay.ui_hints,
    },
  };
}

/**
 * Merge two semantic mapping objects
 *
 * Later traits override earlier ones for the same field.
 * UI hints are deep merged.
 */
export function mergeSemantics(
  base: Record<string, SemanticMapping>,
  overlay: Record<string, SemanticMapping>
): SemanticsMergeResult {
  const merged: Record<string, SemanticMapping> = { ...base };
  const warnings: string[] = [];

  for (const [fieldName, overlayMapping] of Object.entries(overlay)) {
    const baseMapping = base[fieldName];

    if (!baseMapping) {
      // No conflict - just add the mapping
      merged[fieldName] = overlayMapping;
    } else {
      // Merge the mappings
      merged[fieldName] = mergeSemanticMapping(baseMapping, overlayMapping);

      // Warn if semantic types differ
      if (
        baseMapping.semantic_type &&
        overlayMapping.semantic_type &&
        baseMapping.semantic_type !== overlayMapping.semantic_type
      ) {
        warnings.push(
          `Field "${fieldName}" semantic type changed from "${baseMapping.semantic_type}" to "${overlayMapping.semantic_type}"`
        );
      }
    }
  }

  return {
    semantics: merged,
    warnings,
  };
}

/**
 * Merge multiple semantic mapping objects in sequence
 */
export function mergeMultipleSemantics(
  semanticsList: Array<Record<string, SemanticMapping>>
): SemanticsMergeResult {
  if (semanticsList.length === 0) {
    return {
      semantics: {},
      warnings: [],
    };
  }

  if (semanticsList.length === 1) {
    return {
      semantics: semanticsList[0],
      warnings: [],
    };
  }

  let result: SemanticsMergeResult = {
    semantics: semanticsList[0],
    warnings: [],
  };

  for (let i = 1; i < semanticsList.length; i++) {
    const nextMerge = mergeSemantics(result.semantics, semanticsList[i]);

    result = {
      semantics: nextMerge.semantics,
      warnings: [...result.warnings, ...nextMerge.warnings],
    };
  }

  return result;
}
