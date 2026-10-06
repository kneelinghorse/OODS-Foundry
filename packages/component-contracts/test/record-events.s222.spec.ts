import { describe, expect, it } from 'vitest';
import { recordCollectionEvents } from '../src/date-time.js';

/**
 * s222-m03 (#2502 ruling 14): a timeline shows the record's real events. A record with no state or payment history (an
 * Invoice, a Usage reading) has two recorded facts — when it was created and its last event — and the timeline used to
 * show only the first, so an invoice that was created and then paid read as if nothing had happened since creation.
 */
describe('record events without a history', () => {
  it('lists both the creation and the last event, oldest first', () => {
    const invoice = { created_at: '2026-09-02T15:00:00Z', last_event: 'payment_cleared', last_event_at: '2026-09-02T15:01:00Z', issued_at: '2026-09-02T15:00:00Z' };
    expect(recordCollectionEvents(invoice)).toEqual([
      { id: 'record-created_at', kind: 'state', title: 'Created', at: '2026-09-02T15:00:00Z', description: '' },
      { id: 'record-last_event_at', kind: 'state', title: 'Payment Cleared', at: '2026-09-02T15:01:00Z', description: '' },
    ]);
  });

  it('does not list the creation twice when the last event is the creation itself', () => {
    const draft = { created_at: '2026-09-28T09:00:00Z', last_event: 'created', last_event_at: '2026-09-28T09:00:00Z' };
    expect(recordCollectionEvents(draft).map(event => event.title)).toEqual(['Created']);
  });

  it('keeps a single fact when the record has only one of the two dates', () => {
    expect(recordCollectionEvents({ created_at: '2026-09-01T00:00:00Z', issued_at: '2026-09-02T00:00:00Z' }).map(event => event.title)).toEqual(['Created']);
    expect(recordCollectionEvents({ created_at: '', last_event: 'reading_captured', last_event_at: '2026-09-29T23:00:00Z' }).map(event => event.title)).toEqual(['Reading Captured']);
  });

  it('adds nothing beside a recorded history: the history is the timeline', () => {
    const record = { created_at: '2026-09-01T12:00:00Z', last_event: 'status_changed', last_event_at: '2026-09-03T12:00:00Z', state_history: [{ from: null, to: 'active', at: '2026-09-01T12:00:00Z', reason: 'Joined' }, { from: 'active', to: 'suspended', at: '2026-09-03T12:00:00Z', reason: 'Locked' }] };
    expect(recordCollectionEvents(record).map(event => event.id)).toEqual(['state-0', 'state-1']);
  });
});
