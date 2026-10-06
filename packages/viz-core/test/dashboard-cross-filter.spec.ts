import { describe, expect, it } from 'vitest';
import {
  applyCrossFilter,
  crossFilterRows,
  resolveCrossFilter,
  type Selection,
  type SelectionState,
} from '@oods/viz-core';

function sel(sourceWidgetId: string, dimension: string, values: Array<string | number>): Selection {
  return { sourceWidgetId, dimension, values, kind: 'categorical' };
}

const ROWS = [
  { region: 'West', category: 'A', revenue: 1 },
  { region: 'West', category: 'B', revenue: 2 },
  { region: 'East', category: 'A', revenue: 3 },
];

const TWO_SOURCE_STATE: SelectionState = {
  breakdown: sel('breakdown', 'region', ['West']),
  'category-chart': sel('category-chart', 'category', ['A']),
};

describe('@oods/viz-core — cross-filter resolver', () => {
  it('derives one predicate per active source, in sorted source order (deterministic)', () => {
    const predicates = resolveCrossFilter(TWO_SOURCE_STATE, 'kpi');
    expect(predicates.map((p) => p.sourceWidgetId)).toEqual(['breakdown', 'category-chart']);
    expect(predicates[0]).toMatchObject({ dimension: 'region', operator: 'in', values: ['West'] });
  });

  it('AND-combines predicates across sources (SEAM c)', () => {
    const filtered = crossFilterRows(ROWS, TWO_SOURCE_STATE, 'kpi');
    // region == West AND category == A -> only the first row
    expect(filtered).toEqual([{ region: 'West', category: 'A', revenue: 1 }]);
  });

  it('skips the target panel\'s OWN source selection by default (SEAM c skip-self)', () => {
    const predicates = resolveCrossFilter(TWO_SOURCE_STATE, 'breakdown');
    expect(predicates.map((p) => p.sourceWidgetId)).toEqual(['category-chart']);
    // only category==A applies -> rows 0 and 2
    expect(crossFilterRows(ROWS, TWO_SOURCE_STATE, 'breakdown')).toHaveLength(2);
  });

  it('includes the self source when ignoreSelfSource is false', () => {
    const predicates = resolveCrossFilter(TWO_SOURCE_STATE, 'breakdown', { ignoreSelfSource: false });
    expect(predicates.map((p) => p.sourceWidgetId)).toEqual(['breakdown', 'category-chart']);
  });

  it('ignores an empty selection (contributes no predicate)', () => {
    const state: SelectionState = { src: sel('src', 'region', []) };
    expect(resolveCrossFilter(state, 'kpi')).toEqual([]);
  });

  it('evaluates a comparison-operator predicate via the SectionFilter grammar', () => {
    const state: SelectionState = {
      slider: { sourceWidgetId: 'slider', dimension: 'revenue', values: [], predicate: { field: 'revenue', operator: '>', value: 1 } },
    };
    const predicates = resolveCrossFilter(state, 'kpi');
    expect(predicates[0]).toMatchObject({ operator: '>', values: [1] });
    expect(applyCrossFilter(ROWS, predicates)).toEqual([
      { region: 'West', category: 'B', revenue: 2 },
      { region: 'East', category: 'A', revenue: 3 },
    ]);
  });

  it('supports not_in / != membership negation', () => {
    const state: SelectionState = { s: sel('s', 'region', ['West']) };
    const predicates = resolveCrossFilter(state, 'kpi').map((p) => ({ ...p, operator: 'not_in' as const }));
    expect(applyCrossFilter(ROWS, predicates)).toEqual([{ region: 'East', category: 'A', revenue: 3 }]);
  });

  it('returns all rows (as a copy) when no predicates are active', () => {
    const out = applyCrossFilter(ROWS, []);
    expect(out).toEqual(ROWS);
    expect(out).not.toBe(ROWS);
  });

  it('is deterministic — running twice is byte-identical', () => {
    const a = JSON.stringify(crossFilterRows(ROWS, TWO_SOURCE_STATE, 'kpi'));
    const b = JSON.stringify(crossFilterRows(ROWS, TWO_SOURCE_STATE, 'kpi'));
    expect(a).toBe(b);
  });
});
