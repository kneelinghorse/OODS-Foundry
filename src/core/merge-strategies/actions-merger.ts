/**
 * Actions Merger
 *
 * Handles merging of trait actions from multiple traits.
 * Actions are aggregated and deduplicated by name.
 */

import type { TraitAction } from '../trait-definition.js';

/**
 * Result of actions merge operation
 */
export interface ActionsMergeResult {
  /**
   * The merged actions
   */
  actions: TraitAction[];

  /**
   * Warnings generated during merge
   */
  warnings: string[];
}

/**
 * Merge two action arrays
 *
 * Actions are deduplicated by name. Later definitions override earlier ones.
 */
export function mergeActions(
  base: TraitAction[],
  overlay: TraitAction[]
): ActionsMergeResult {
  const warnings: string[] = [];
  const actionMap = new Map<string, TraitAction>();

  // Add base actions
  for (const action of base) {
    actionMap.set(action.name, action);
  }

  // Add/override with overlay actions
  for (const action of overlay) {
    if (actionMap.has(action.name)) {
      warnings.push(
        `Action "${action.name}" redefined - using later definition`
      );
    }
    actionMap.set(action.name, action);
  }

  return {
    actions: Array.from(actionMap.values()),
    warnings,
  };
}

/**
 * Merge multiple action arrays in sequence
 */
export function mergeMultipleActions(
  actionsList: TraitAction[][]
): ActionsMergeResult {
  if (actionsList.length === 0) {
    return {
      actions: [],
      warnings: [],
    };
  }

  if (actionsList.length === 1) {
    return {
      actions: actionsList[0],
      warnings: [],
    };
  }

  let result: ActionsMergeResult = {
    actions: actionsList[0],
    warnings: [],
  };

  for (let i = 1; i < actionsList.length; i++) {
    const nextMerge = mergeActions(result.actions, actionsList[i]);

    result = {
      actions: nextMerge.actions,
      warnings: [...result.warnings, ...nextMerge.warnings],
    };
  }

  return result;
}
