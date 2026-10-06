// Selection → cross-filter resolver (sprint-113 m03). Pure, deterministic. The
// seam between an accumulated SelectionState and a panel's data: it derives the
// active per-dimension predicates for a target panel and filters that panel's
// rows. Generalizes the network reference reducer's isNodeFiltered/
// getFilteredNodeIds (node-id membership, OR across sources) into field/value
// predicate evaluation over arbitrary tabular rows — and INTRODUCES the m01
// cross-filter seam semantics the reference did NOT have: skip-self-source +
// AND-combine across sources (SEAM c). No @/ imports.

import { toNumber } from '../../analysis/stats.js';
import type { Selection, SelectionOperator, SelectionState } from '../../spec/dashboard-selection.js';

type DataRecord = Record<string, unknown>;
type PredicateValue = string | number | boolean;

/** An active cross-filter predicate derived from one source's selection. */
export interface ResolvedPredicate {
  readonly sourceWidgetId: string;
  readonly dimension: string;
  readonly operator: SelectionOperator;
  readonly values: readonly PredicateValue[];
}

export interface ResolveCrossFilterOptions {
  /** SEAM (c): a panel ignores selections that originated from itself. Default true. */
  readonly ignoreSelfSource?: boolean;
}

function toPredicateParts(selection: Selection): { operator: SelectionOperator; values: readonly PredicateValue[] } {
  if (selection.predicate) {
    const raw = selection.predicate.value;
    return { operator: selection.predicate.operator, values: Array.isArray(raw) ? raw : [raw] };
  }
  // Categorical/point default: membership over the selected values.
  return { operator: 'in', values: selection.values };
}

/**
 * Resolve the active predicates that filter `targetPanelId`. Sources are walked
 * in sorted key order (deterministic, golden-stable); the target's own source is
 * skipped when ignoreSelfSource (SEAM c default); an empty selection contributes
 * nothing. The returned predicates AND-combine (see applyCrossFilter).
 */
export function resolveCrossFilter(
  state: SelectionState,
  targetPanelId: string,
  options?: ResolveCrossFilterOptions,
): ResolvedPredicate[] {
  const ignoreSelfSource = options?.ignoreSelfSource ?? true;
  const predicates: ResolvedPredicate[] = [];

  for (const sourceWidgetId of Object.keys(state).sort()) {
    if (ignoreSelfSource && sourceWidgetId === targetPanelId) {
      continue;
    }
    const selection = state[sourceWidgetId];
    const { operator, values } = toPredicateParts(selection);
    if (values.length === 0) {
      continue;
    }
    predicates.push({ sourceWidgetId, dimension: selection.dimension, operator, values });
  }

  return predicates;
}

function matchesPredicate(cell: unknown, operator: SelectionOperator, values: readonly PredicateValue[]): boolean {
  switch (operator) {
    case 'in':
      return values.some((v) => v === cell);
    case 'not_in':
      return !values.some((v) => v === cell);
    case '==':
      return cell === values[0];
    case '!=':
      return cell !== values[0];
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const a = toNumber(cell);
      const b = toNumber(values[0]);
      if (a === null || b === null) {
        return false;
      }
      if (operator === '>') return a > b;
      if (operator === '>=') return a >= b;
      if (operator === '<') return a < b;
      return a <= b;
    }
    default:
      return false;
  }
}

/**
 * Apply resolved predicates to a panel's rows — a row passes only when it
 * satisfies EVERY predicate (AND-combine across sources, SEAM c). No active
 * predicates → all rows pass (returns a shallow copy for purity).
 */
export function applyCrossFilter(rows: readonly DataRecord[], predicates: readonly ResolvedPredicate[]): DataRecord[] {
  if (predicates.length === 0) {
    return [...rows];
  }
  return rows.filter((row) => predicates.every((p) => matchesPredicate(row[p.dimension], p.operator, p.values)));
}

/** Convenience: resolve + apply in one call (the common KPI/panel data path). */
export function crossFilterRows(
  rows: readonly DataRecord[],
  state: SelectionState,
  targetPanelId: string,
  options?: ResolveCrossFilterOptions,
): DataRecord[] {
  return applyCrossFilter(rows, resolveCrossFilter(state, targetPanelId, options));
}
