import { describe, expect, it } from 'vitest';
import {
  categoricalSelection,
  EMPTY_SELECTION_STATE,
  geoSelection,
  networkSelection,
  reduceSelections,
  selectionReducer,
  type Selection,
  type SelectionAction,
  type SelectionState,
} from '@oods/viz-core';

const pick = (sourceWidgetId: string, dimension: string, value: string | number): Selection => ({
  sourceWidgetId,
  dimension,
  values: [value],
  kind: 'categorical',
});

describe('@oods/viz-core — linked-selection reducer', () => {
  it('SET adds a selection keyed by sourceWidgetId', () => {
    const state = selectionReducer(EMPTY_SELECTION_STATE, { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') });
    expect(Object.keys(state)).toEqual(['a']);
    expect(state.a.values).toEqual(['West']);
  });

  it('SET replaces the same source (merge-by-source, last write wins)', () => {
    const state = reduceSelections([
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') },
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'East') },
    ]);
    expect(Object.keys(state)).toEqual(['a']);
    expect(state.a.values).toEqual(['East']);
  });

  it('CLEAR_SELECTION removes one source; CLEAR_ALL empties', () => {
    const base = reduceSelections([
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') },
      { type: 'SET_SELECTION', selection: pick('b', 'category', 'A') },
    ]);
    expect(Object.keys(selectionReducer(base, { type: 'CLEAR_SELECTION', sourceWidgetId: 'a' }))).toEqual(['b']);
    expect(selectionReducer(base, { type: 'CLEAR_ALL' })).toEqual({});
  });

  it('CLEAR_SELECTION on an absent source is a no-op (same reference)', () => {
    const base = reduceSelections([{ type: 'SET_SELECTION', selection: pick('a', 'region', 'West') }]);
    expect(selectionReducer(base, { type: 'CLEAR_SELECTION', sourceWidgetId: 'zzz' })).toBe(base);
  });

  it('produces canonical output — sorted keys and sorted values (byte-stable)', () => {
    const state = reduceSelections([
      { type: 'SET_SELECTION', selection: { sourceWidgetId: 'z', dimension: 'region', values: ['West'], kind: 'categorical' } },
      { type: 'SET_SELECTION', selection: { sourceWidgetId: 'a', dimension: 'category', values: ['B', 'A', 'C'], kind: 'categorical' } },
    ]);
    expect(Object.keys(state)).toEqual(['a', 'z']); // keys sorted
    expect(state.a.values).toEqual(['A', 'B', 'C']); // values sorted
  });

  it('is deterministic — the same action sequence is byte-identical', () => {
    const actions: SelectionAction[] = [
      { type: 'SET_SELECTION', selection: pick('b', 'category', 'A') },
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') },
      { type: 'CLEAR_SELECTION', sourceWidgetId: 'b' },
    ];
    expect(JSON.stringify(reduceSelections(actions))).toBe(JSON.stringify(reduceSelections(actions)));
  });

  // ---- PARITY vs the src/ reference reducers (behavioral equivalence) ----
  // The oracle below is a faithful transcription of spatialFilterReducer
  // (src/viz/interactions/spatial-filter-actions.ts:79-100): SET filters out the
  // same source then appends (replace-by-source); CLEAR_SELECTION filters out
  // that source; CLEAR_ALL resets to the default empty. The src/ reducers + their
  // tests are NOT touched — this proves the fresh generalization reproduces their
  // merge/clear semantics so it cannot silently drift.
  function oracleReduce(selections: readonly Selection[], action: SelectionAction): Selection[] {
    switch (action.type) {
      case 'SET_SELECTION':
        return [...selections.filter((s) => s.sourceWidgetId !== action.selection.sourceWidgetId), action.selection];
      case 'CLEAR_SELECTION':
        return selections.filter((s) => s.sourceWidgetId !== action.sourceWidgetId);
      case 'CLEAR_ALL':
        return [];
    }
  }
  const projectArray = (selections: readonly Selection[]) => {
    const map: Record<string, { dimension: string; values: readonly (string | number)[] }> = {};
    for (const s of selections) map[s.sourceWidgetId] = { dimension: s.dimension, values: s.values };
    return Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  };
  const projectState = (state: SelectionState) =>
    Object.fromEntries(Object.keys(state).sort().map((k) => [k, { dimension: state[k].dimension, values: state[k].values }]));

  it('matches the reference reducer behavior across an action sequence', () => {
    const actions: SelectionAction[] = [
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') },
      { type: 'SET_SELECTION', selection: pick('b', 'category', 'A') },
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'East') }, // replace a
      { type: 'CLEAR_SELECTION', sourceWidgetId: 'b' },
      { type: 'SET_SELECTION', selection: pick('c', 'node', 'n1') },
    ];
    const mine = reduceSelections(actions);
    const reference = actions.reduce<Selection[]>((acc, a) => oracleReduce(acc, a), []);
    expect(projectState(mine)).toEqual(projectArray(reference));
    expect(projectState(mine)).toEqual({
      a: { dimension: 'region', values: ['East'] },
      c: { dimension: 'node', values: ['n1'] },
    });
  });

  it('matches the reference reducer on CLEAR_ALL', () => {
    const actions: SelectionAction[] = [
      { type: 'SET_SELECTION', selection: pick('a', 'region', 'West') },
      { type: 'SET_SELECTION', selection: pick('b', 'category', 'A') },
      { type: 'CLEAR_ALL' },
    ];
    const reference = actions.reduce<Selection[]>((acc, a) => oracleReduce(acc, a), []);
    expect(projectState(reduceSelections(actions))).toEqual(projectArray(reference));
    expect(reduceSelections(actions)).toEqual({});
  });
});

describe('@oods/viz-core — per-cluster selection bindings', () => {
  it('categoricalSelection emits a generic categorical Selection', () => {
    expect(categoricalSelection('bar', 'region', 'West')).toEqual({
      sourceWidgetId: 'bar',
      dimension: 'region',
      values: ['West'],
      kind: 'categorical',
    });
    expect(categoricalSelection('bar', 'region', ['West', 'East']).values).toEqual(['West', 'East']);
  });

  it('geoSelection + networkSelection emit point Selections from region/node ids', () => {
    expect(geoSelection('map', 'state', 'CA')).toMatchObject({ dimension: 'state', values: ['CA'], kind: 'point' });
    expect(networkSelection('graph', 'id', ['n1', 'n2'])).toMatchObject({ dimension: 'id', values: ['n1', 'n2'], kind: 'point' });
  });
});
