/**
 * s255-m01 (G4, R3 §5.2 runs B and D): a store's history table keeps one row per change, and its event column says what
 * kind of change it was: ADD, UPDATE, DELETE for Mem0's history entries, created, edited, superseded, forgotten for a
 * team's memory events. The importer proposed that column as the history row's own lifecycle (Stateful). In a record of
 * changes, a field named for the kind of change is now read as that, no Stateful is proposed from it, and the draft says
 * so where show lists it. A state the record keeps for itself, and every other record, is read as before.
 */
import { expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';

// R3 run B: Mem0's history entry, extracted and named as a team would export it (JSON Schema 2020-12), trimmed.
const history = { $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: { MemoryHistoryEntry: { type: 'object', properties: {
  id: { type: 'string', format: 'uuid' }, memory_id: { type: 'string', format: 'uuid' },
  event: { type: 'string', enum: ['ADD', 'UPDATE', 'DELETE'] },
  created_at: { type: 'string', format: 'date-time' },
} } } };
// R3 run D: the team's memory events table, written for that pass (not any product's schema), trimmed.
const events = `CREATE TABLE memories (id uuid PRIMARY KEY, content text NOT NULL);
CREATE TABLE memory_events (
  id uuid PRIMARY KEY,
  memory_id uuid NOT NULL REFERENCES memories(id),
  event text NOT NULL CHECK (event IN ('created', 'edited', 'superseded', 'forgotten')),
  created_at timestamptz NOT NULL DEFAULT now()
);`;
const result = (content: string, format: 'sql' | 'json-schema') => draftSource({ content, format, ...(format === 'json-schema' ? { name: 'history.json' } : {}) });

it("reads run B's event as the kind of change, not the history entry's lifecycle, and says so", () => {
  const drafted = result(JSON.stringify(history), 'json-schema');
  const entry = drafted.drafts.find(item => item.name === 'MemoryHistoryEntry')!;
  expect(entry.proposals.map(item => item.trait.name)).not.toContain('Stateful');
  expect(entry.definition.schema.event.validation?.enum).toEqual(['ADD', 'UPDATE', 'DELETE']);
  expect(drafted.report).toContainEqual(expect.objectContaining({ object: 'MemoryHistoryEntry', outcome: 'unmapped', pointer: '/$defs/MemoryHistoryEntry/properties/event/enum',
    reason: 'event holds the kind of change (ADD, UPDATE, DELETE), not the lifecycle of MemoryHistoryEntry: each MemoryHistoryEntry record is one change to another record, so no Stateful is proposed from event.' }));
});

it("does the same for run D's memory events, and leaves the memory itself alone", () => {
  const drafted = result(events, 'sql');
  expect(drafted.drafts.find(item => item.name === 'MemoryEvents')!.proposals.map(item => item.trait.name)).not.toContain('Stateful');
  expect(drafted.report.some(entry => entry.object === 'MemoryEvents' && entry.reason.startsWith('event holds the kind of change (created, edited, superseded, forgotten)'))).toBe(true);
});

it('keeps a lifecycle the record names for itself, and reads an event column on any other record as before', () => {
  const kept = result(events.replace("  created_at timestamptz", "  state text NOT NULL CHECK (state IN ('pending', 'applied')),\n  created_at timestamptz"), 'sql');
  expect(kept.drafts.find(item => item.name === 'MemoryEvents')!.proposals.find(item => item.trait.name === 'Stateful')!.trait.fieldBindings?.status).toBe('state');
  const other = result(events.replaceAll('memory_events', 'memory_tasks'), 'sql');
  expect(other.drafts.find(item => item.name === 'MemoryTasks')!.proposals.find(item => item.trait.name === 'Stateful')!.trait.fieldBindings?.status).toBe('event');
});

it("lets no other enum stand in as a record of changes' lifecycle, and says so (cal.com's BookingAudit, GitHub's audit entries)", () => {
  const audit = result(`CREATE TABLE bookings (id uuid PRIMARY KEY);
CREATE TABLE booking_audit (id uuid PRIMARY KEY, booking_id uuid REFERENCES bookings(id),
  action text NOT NULL CHECK (action IN ('created', 'cancelled', 'accepted')),
  source text NOT NULL CHECK (source IN ('api_v1', 'webapp', 'webhook')));`, 'sql');
  expect(audit.drafts.find(item => item.name === 'BookingAudit')!.proposals.map(item => item.trait.name)).not.toContain('Stateful');
  expect(audit.report).toContainEqual(expect.objectContaining({ object: 'BookingAudit', outcome: 'unmapped', reason: 'source is not proposed as the lifecycle of BookingAudit: BookingAudit is a record of changes, and only a field named for its own state (state, status) is one.' }));
});
