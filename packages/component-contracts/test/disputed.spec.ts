import { describe, expect, it } from 'vitest';
import { auditSummary, initialSort, nextSort, ariaSort } from '../src/index.js';

describe('retained audit and sorting obligations', () => {
  it('counts all records but picks the latest valid instant, independent of input order or display limit', () => {
    const log = [{ to_state: 'paused', transitioned_at: '2026-09-06T12:00:00Z', actor_id: 'last' }, { to_state: 'active', transitioned_at: '2026-09-05T12:00:00Z', actor_id: 'first' }, { transitioned_at: 'invalid', actor_id: 'invalid' }, null];
    expect(auditSummary({ auditLog: log, lastN: 1 })).toMatchObject({ count: 3, actor: 'last', timestamp: 'Sep 6, 2026, 12:00 PM', recent: [log[0]] });
    expect(auditSummary({ auditLog: log, lastN: 0 }).recent).toEqual([]);
    expect(log).toHaveLength(4);
  });
  it('does not fabricate an actor or timestamp for absent and invalid dates', () => {
    expect(auditSummary({})).toMatchObject({ count: 0, actor: 'Not recorded', timestamp: 'Not recorded', at: undefined, recent: [] });
    expect(auditSummary({ auditLog: [{ transitioned_at: 'bad', actor_id: 'cannot-be-latest' }] })).toMatchObject({ count: 1, actor: 'Not recorded', at: undefined });
  });
  it('cycles tri-state and binary state without losing the selected field', () => {
    let state = initialSort({ defaultSortField: 'price' });
    const seen = [ariaSort(state)]; for (let step = 0; step < 3; step++) { state = nextSort(state); seen.push(ariaSort(state)); }
    expect(seen).toEqual(['none', 'ascending', 'descending', 'none']); expect(state.field).toBe('price');
    expect(ariaSort(nextSort({ field: 'price', active: true, direction: 'desc' }, false))).toBe('ascending');
  });
});
