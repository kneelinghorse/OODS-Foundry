/**
 * View Extensions Merger
 *
 * Handles merging of view extensions from multiple traits.
 * View extensions are aggregated and sorted by priority.
 */

import type { ViewExtension } from '../trait-definition.js';

/**
 * Result of view extensions merge operation
 */
export interface ViewExtensionsMergeResult {
  /**
   * The merged view extensions by context
   */
  viewExtensions: {
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  };

  /**
   * Warnings generated during merge
   */
  warnings: string[];
}

/**
 * Merge view extensions for a single context
 *
 * Extensions are aggregated and sorted by priority.
 * Deduplication is based on the `key` field if present.
 */
function mergeContextExtensions(
  base: ViewExtension[] | undefined,
  overlay: ViewExtension[] | undefined,
  _context: string
): { extensions: ViewExtension[]; warnings: string[] } {
  const warnings: string[] = [];

  if (!base && !overlay) {
    return { extensions: [], warnings };
  }

  if (!base) {
    return { extensions: overlay || [], warnings };
  }

  if (!overlay) {
    return { extensions: base, warnings };
  }

  // Combine extensions
  const combined = [...base, ...overlay];

  // Deduplicate by key if present
  const seen = new Set<string>();
  const deduplicated: ViewExtension[] = [];

  for (const ext of combined) {
    if ('key' in ext && ext.key && typeof ext.key === 'string') {
      if (seen.has(ext.key)) {
        // Duplicate key - skip
        continue;
      }
      seen.add(ext.key);
    }

    deduplicated.push(ext);
  }

  // Sort by priority (lower number = higher priority)
  // Default priority is 50
  deduplicated.sort((a, b) => {
    const priorityA = a.priority ?? 50;
    const priorityB = b.priority ?? 50;
    return priorityA - priorityB;
  });

  return {
    extensions: deduplicated,
    warnings,
  };
}

/**
 * Merge two view extension objects
 *
 * Extensions are aggregated by context and sorted by priority.
 */
export function mergeViewExtensions(
  base: {
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  },
  overlay: {
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  }
): ViewExtensionsMergeResult {
  const merged: {
    [context: string]: ViewExtension[] | undefined;
  } = {};
  const warnings: string[] = [];

  // Get all unique contexts
  const allContexts = new Set([...Object.keys(base), ...Object.keys(overlay)]);

  for (const context of allContexts) {
    const { extensions, warnings: contextWarnings } = mergeContextExtensions(
      base[context],
      overlay[context],
      context
    );

    if (extensions.length > 0) {
      merged[context] = extensions;
    }

    warnings.push(...contextWarnings);
  }

  return {
    viewExtensions: merged,
    warnings,
  };
}

/**
 * Merge multiple view extension objects in sequence
 */
export function mergeMultipleViewExtensions(
  viewExtensionsList: Array<{
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  }>
): ViewExtensionsMergeResult {
  if (viewExtensionsList.length === 0) {
    return {
      viewExtensions: {},
      warnings: [],
    };
  }

  if (viewExtensionsList.length === 1) {
    return {
      viewExtensions: viewExtensionsList[0],
      warnings: [],
    };
  }

  let result: ViewExtensionsMergeResult = {
    viewExtensions: viewExtensionsList[0],
    warnings: [],
  };

  for (let i = 1; i < viewExtensionsList.length; i++) {
    const nextMerge = mergeViewExtensions(result.viewExtensions, viewExtensionsList[i]);

    result = {
      viewExtensions: nextMerge.viewExtensions,
      warnings: [...result.warnings, ...nextMerge.warnings],
    };
  }

  return result;
}
