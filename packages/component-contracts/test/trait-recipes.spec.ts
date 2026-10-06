import { describe, expect, it } from 'vitest';
import { geoFieldMapping, recipeItemLabels, traitEventRows } from '../src/trait-recipes.js';

describe('declared trait recipe values', () => {
  it('absence cannot invent a cancellation or state transition', () => {
    expect(traitEventRows('archive', {})).toEqual([]);
    expect(traitEventRows('archive', { archivedAt: null, restoredAt: null })).toEqual([]);
    expect(traitEventRows('cancellation', {})).toEqual([]);
    expect(traitEventRows('transition', { status: 'active' })).toEqual([]);
  });
  it('invalid time remains disclosed while valid history order and visibility directives survive', () => {
    const values = { history: [{ from_state: 'draft', to_state: 'active', transitioned_at: 'invalid', actor_id: 'user-1', reason: 'Approved' }, { to_state: 'archived', transitioned_at: '2026-09-01T12:00:00Z' }], showActor: false, showReason: false };
    const rows = traitEventRows('transition', values);
    expect(rows.map(row => row.title)).toEqual(['Draft → Active', 'Archived']);
    expect(rows[0]).toMatchObject({ time: 'Time not recorded', at: undefined, actor: undefined, reason: undefined });
    expect(rows[1]?.time).toBe('Sep 1, 2026, 12:00 PM');
  });
  it('false auto-detection and named catalog records do not become truthy defaults or object placeholders', () => {
    expect(geoFieldMapping({ autoDetect: false, latitude: 'lat' })).toEqual({ autoDetect: false, latitude: 'lat', longitude: '', identifier: '' });
    expect(recipeItemLabels(['SMS', { name: 'Support', status: 'delivered' }, { field: 'latitude' }, {}])).toEqual(['SMS', 'Support: delivered', 'latitude', 'Unnamed entry']);
  });
});
