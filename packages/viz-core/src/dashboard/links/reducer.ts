// Generic chart-agnostic linked-selection reducer (sprint-113 m04). A GENUINE
// generalization, NOT a port: authored fresh in viz-core over the m01
// Selection/SelectionState types (the charter forbids the @/ payload imports
// both src reducers use). It adopts the proven action/state/merge/clear SHAPE of
// the two reference reducers — the replace-by-sourceWidgetId fold
// (src/viz/interactions/spatial-filter-actions.ts:79-100) and the same
// one-vs-all CLEAR (network-handlers.ts:246-258) — and reproduces it for an
// arbitrary cross-cluster selection, parity-tested against the reference goldens.
//
// SelectionState is a keyed map (Record<sourceWidgetId, Selection>), the m01
// generalization of both reducers' replace-by-source arrays: SET = a key write,
// CLEAR = a key delete, canonical ordering = sorted keys. v1 covers
// point/categorical selections ONLY (brush/interval RANGE deferred). Pure /
// deterministic: every transition returns CANONICAL state (sorted keys, sorted
// values) for byte-stable goldens.

import type { Selection, SelectionState, SelectionValue } from '../../spec/dashboard-selection.js';

export type SelectionAction =
  | { readonly type: 'SET_SELECTION'; readonly selection: Selection }
  | { readonly type: 'CLEAR_SELECTION'; readonly sourceWidgetId: string }
  | { readonly type: 'CLEAR_ALL' };

/** The empty (no active selections) state. */
export const EMPTY_SELECTION_STATE: SelectionState = Object.freeze({});

function valueRank(value: SelectionValue): number {
  return typeof value === 'number' ? 0 : 1;
}

/** Total order over point/categorical values (numbers before strings; stable). */
function compareSelectionValues(a: SelectionValue, b: SelectionValue): number {
  const rankDelta = valueRank(a) - valueRank(b);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function normalizeSelection(selection: Selection): Selection {
  // Values are a SET — sort them for byte-stable goldens (membership unchanged).
  return { ...selection, values: [...selection.values].sort(compareSelectionValues) };
}

/** Rebuild the state with canonically-sorted keys + normalized selections. */
function canonical(state: SelectionState): SelectionState {
  const next: Record<string, Selection> = {};
  for (const key of Object.keys(state).sort()) {
    next[key] = normalizeSelection(state[key]);
  }
  return next;
}

/**
 * Apply one action. Mirrors spatialFilterReducer(state, action): SET replaces by
 * sourceWidgetId (last write wins), CLEAR_SELECTION removes one source, CLEAR_ALL
 * empties. Always returns canonical state.
 */
export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'SET_SELECTION':
      return canonical({ ...state, [action.selection.sourceWidgetId]: action.selection });
    case 'CLEAR_SELECTION': {
      if (!(action.sourceWidgetId in state)) {
        return state;
      }
      const next: Record<string, Selection> = { ...state };
      delete next[action.sourceWidgetId];
      return canonical(next);
    }
    case 'CLEAR_ALL':
      return EMPTY_SELECTION_STATE;
    default:
      return state;
  }
}

/**
 * Fold a list of actions over selectionReducer — mirrors reduceSpatialFilters
 * (actions.reduce(reducer, state)). The result is canonical (sorted keys +
 * normalized values), so a given action sequence yields byte-stable output.
 */
export function reduceSelections(
  actions: readonly SelectionAction[],
  initialState: SelectionState = EMPTY_SELECTION_STATE,
): SelectionState {
  return actions.reduce<SelectionState>((state, action) => selectionReducer(state, action), initialState);
}
