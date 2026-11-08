/**
 * s244-m01 (#2829): an agent is an actor, not a user, and every recorded change names both who acted and who it acted
 * for, and who approved it when someone did. One helper builds the phrase every history path prints. These checks encode
 * why it matters: the phrase is the agent's most-seen screen (the line in every other object's history), a person acting
 * for herself must not read as acting for someone else, and a history written before 0.12.0 has no names and must read
 * exactly as it always has.
 */
import { describe, expect, it } from 'vitest';
import { auditSummary, historyAttribution, recordCollectionEvents, traitEventRows } from '../src/index.js';

const agentEntry = {
  title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge',
  actor_id: '6a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a01', actor_name: 'Billing Agent', actor_kind: 'agent',
  on_behalf_of_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a05', on_behalf_of_name: 'Tidewater Co-op',
  approved_by_id: '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d02', approved_by_name: 'Ruth Adeyemi',
};

describe('historyAttribution', () => {
  it('names who acted, who it acted for and who approved, in one phrase', () => {
    expect(historyAttribution(agentEntry)).toEqual({ text: 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi', namesActor: true });
  });

  it('names a person acting for herself, and an agent acting as itself, once', () => {
    expect(historyAttribution({ actor_name: 'Ruth Adeyemi', actor_kind: 'person' })?.text).toBe('Ruth Adeyemi');
    expect(historyAttribution({ actor_name: 'Ruth Adeyemi', on_behalf_of_name: 'Ruth Adeyemi' })?.text).toBe('Ruth Adeyemi');
    expect(historyAttribution({ actor_name: 'Billing Agent', actor_kind: 'agent' })?.text).toBe('Billing Agent');
    expect(historyAttribution({ actor_name: 'Billing Agent', approved_by_name: 'Ruth Adeyemi' })?.text).toBe('Billing Agent · approved by Ruth Adeyemi');
  });

  it('still says who it was for and who approved when the actor itself is not named', () => {
    expect(historyAttribution({ actor_id: 'agt_1', on_behalf_of_name: 'Tidewater Co-op' })).toEqual({ text: 'For Tidewater Co-op', namesActor: false });
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi' })).toEqual({ text: 'Approved by Ruth Adeyemi', namesActor: false });
  });

  it('treats ids, the actor alias and blank names as naming no one', () => {
    for (const entry of [{ actor_id: 'usr_1' }, { actor: 'Ruth Adeyemi' }, { actor_name: '  ', on_behalf_of_name: '' }, null, 'Activated', [agentEntry]]) {
      expect(historyAttribution(entry)).toBeUndefined();
    }
  });
});

describe('the history paths print the phrase, and an unnamed entry exactly as before', () => {
  const unnamed = { title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge', actor_id: 'usr_1' };

  it('recipe rows: a named entry carries the phrase and no actor id; an unnamed one keeps its exact row', () => {
    const [named] = traitEventRows('transition', { history: [agentEntry] });
    expect(named).toMatchObject({ attribution: 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi', actor: undefined, reason: 'Duplicate charge' });
    // The 0.11.3 row, key for key: no attribution key at all.
    expect(traitEventRows('transition', { history: [unnamed] })).toStrictEqual([{
      title: 'Refunded · Paid → Refunded', at: '2026-11-03T10:00:00Z', actor: 'usr_1', reason: 'Duplicate charge', code: undefined, time: 'Nov 3, 2026, 10:00 AM',
    }]);
    // showActor false hides who acted, named or not.
    expect(traitEventRows('transition', { history: [agentEntry], showActor: false })[0]).not.toHaveProperty('attribution');
  });

  it('audit summary: the last actor is named; an unnamed log keeps its id or "Not recorded"', () => {
    const log = [
      { from_state: 'draft', to_state: 'active', transitioned_at: '2026-10-01T09:00:00Z', actor_id: 'usr_1' },
      { from_state: 'active', to_state: 'paused', transitioned_at: '2026-10-02T09:00:00Z', ...agentEntry },
    ];
    expect(auditSummary({ auditLog: log }).actor).toBe('Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi');
    expect(auditSummary({ auditLog: [log[0]] }).actor).toBe('usr_1');
    expect(auditSummary({ auditLog: [{ to_state: 'active', transitioned_at: '2026-10-01T09:00:00Z' }] }).actor).toBe('Not recorded');
    expect(auditSummary({ auditLog: [{ to_state: 'active', transitioned_at: '2026-10-01T09:00:00Z', actor_id: 'agt_1', on_behalf_of_name: 'Tidewater Co-op' }] }).actor).toBe('agt_1 · For Tidewater Co-op');
  });

  it('generated rail: a named entry carries the phrase; an unnamed event has no attribution key', () => {
    const events = recordCollectionEvents({ state_history: [unnamed, agentEntry] });
    expect(events.map(event => event.attribution)).toEqual([undefined, 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi']);
    expect(events[0]).toStrictEqual({ id: 'state-0', title: 'Refunded', at: '2026-11-03T10:00:00Z', description: 'Duplicate charge', kind: 'state' });
  });
});
