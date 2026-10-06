import { describe, expect, it } from 'vitest';
import { recordCollectionEvents } from '../src/date-time.js';

describe('record event projection shared by preview and workflow', () => {
  it('retains real history instead of fabricating creation from a timestamp', () => {
    const record = { created_at: '2026-09-01T12:00:00Z', state_history: [{ to: 'active', at: '2026-09-02T12:00:00Z', title: 'Account approved', reason: 'Review complete' }] };
    expect(recordCollectionEvents(record)).toEqual([{ id: 'state-0', at: '2026-09-02T12:00:00Z', kind: 'state', title: 'Account approved', description: 'Review complete' }]);
    expect(record.state_history).toHaveLength(1);
  });
  it('uses a declared period when no creation/history exists, and skips invalid timestamps', () => {
    expect(recordCollectionEvents({ created_at: 'bad', period_start: '2026-09-01' })).toEqual([{ id: 'record-period_start', at: '2026-09-01', kind: 'state', title: 'Period started', description: '' }]);
    expect(recordCollectionEvents({})).toEqual([]);
  });
  it('honors alternate history vocabulary and sorts payment projections at the record price', () => {
    const record = { amount: 4900, currency: 'usd', billing_interval: 'monthly', last_payment_at: '2026-09-01T12:00:00Z', audit: [{ to_state: 'active', transitioned_at: '2026-09-02T12:00:00Z' }] };
    const events = recordCollectionEvents(record, { historyField: 'audit', payments: [{ field: 'last_payment_at', title: 'Payment received' }], minorUnits: 100 });
    expect(events.map(event => event.title)).toEqual(['Payment received', 'Active']);
    expect(events[0]!.description).toBe('$49.00 · monthly');
  });
});
