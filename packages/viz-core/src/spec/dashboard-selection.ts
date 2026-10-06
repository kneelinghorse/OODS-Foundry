// Runtime cross-filter selection types — FROZEN in sprint-113 m01 so the m03
// cross-filter resolver and the m04 linked-selection reducer both depend ONLY
// on m01. These describe the runtime interaction STATE a chart emits on
// click/select — distinct from the declarative DashboardSpec IR (which is
// schema-validated). They are hand-authored TS (the network-flow.ts / spatial.ts
// pattern), reconciled across the two reference reducers
// (src/viz/interactions/spatial-filter-* and src/dashboard/cross-filter/
// network-handlers.ts) — both key on sourceWidgetId and produce categorical
// membership. v1 covers point/categorical selections only; brush/interval RANGE
// selections are DEFERRED (see NormalizedVizSpec IntervalSelection).

import type { SectionFilter } from './normalized-viz-spec.types.js';

/**
 * Predicate operator vocabulary for links + selections — reuses the
 * SectionFilter grammar (==|!=|in|not_in|>|>=|<|<=) so the dashboard links
 * predicate and the chart selection share one operator set.
 */
export type SelectionOperator = SectionFilter['operator'];

/**
 * A scalar selectable value. Point/categorical only — brush/interval deferred.
 * v1 is string|number ONLY (boolean dimensions are out of scope for cross-filter)
 * so the m04 canonical-ordering normalizer never has to sort a boolean; the
 * richer `predicate` (SectionFilter) escape-hatch should also stay
 * string|number-valued in v1.
 */
export type SelectionValue = string | number;

/**
 * One panel's active selection. Either categorical `values` (the primary v1
 * form) or a pre-derived `predicate` (the richer SectionFilter form) — both are
 * carried so m03/m04 can widen later with no schema change. `values` is an
 * ARRAY because the network reference reducer natively produces multi-value
 * (adjacency / path) selections; a single click is `[value]`.
 */
export interface Selection {
  /** The panel id that produced the selection. */
  readonly sourceWidgetId: string;
  /** The field/dimension the selection is on (maps to SectionFilter.field). */
  readonly dimension: string;
  /** Selected categorical/point values. */
  readonly values: readonly SelectionValue[];
  /** Selection kind discriminant. Brush/interval is intentionally excluded in v1. */
  readonly kind?: 'point' | 'categorical';
  /** Optional pre-derived predicate (SectionFilter grammar) instead of raw values. */
  readonly predicate?: SectionFilter;
}

/**
 * Accumulated cross-filter state, keyed by `sourceWidgetId` (one active
 * selection per source). Keying by source — rather than an array — is the
 * deliberate generalization of both reference reducers' replace-by-source fold:
 * it makes the m04 merge (set the key), the m03 skip-self-source decision (skip
 * the target's own key), and canonical byte-stable goldens (sort the keys) all
 * trivial. m03/m04 depend only on this shape.
 */
export type SelectionState = Readonly<Record<string, Selection>>;
