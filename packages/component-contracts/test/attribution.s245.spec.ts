/**
 * s245-m01: an approval is a decision, not a status, and the line in a record's history is its trace. A change someone
 * approved can point at its approval (approval_id) and name its level of yes (approval_level). These checks encode why it
 * matters:
 * - the level is the part of the yes a reader of the history needs (was this a review or a sign-off?), so every history
 *   path prints it, in the words a level is shown in on every other screen;
 * - the id is a pointer kept in the record's data: a generated app holds one object's records, so the line cannot open
 *   the approval, and printing an opaque id would read as a link that goes nowhere;
 * - a history written before 0.13.0 has neither field and must print exactly what 0.12.0 printed.
 */
import { describe, expect, it } from 'vitest';
import { auditSummary, historyAttribution, recordCollectionEvents, traitEventRows } from '../src/index.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi';
const withLevel = `${phrase} (level: Approval)`;
const resend = {
  title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op',
  approved_by_id: 'usr_ruth', approved_by_name: 'Ruth Adeyemi',
};
const pointed = { ...resend, approval_id: 'apr_resend_0429', approval_level: 'approval' };

describe('historyAttribution names the level of yes', () => {
  it('prints the level after who approved, and never the approval id', () => {
    expect(historyAttribution(pointed)).toEqual({ text: withLevel, namesActor: true });
    expect(historyAttribution(pointed)?.text).not.toContain('apr_resend_0429');
  });

  it('names the level in sentence case, as every screen shows a level', () => {
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi', approval_level: 'sign_off' })?.text).toBe('Approved by Ruth Adeyemi (level: Sign off)');
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi', approval_level: 'Sign-off' })?.text).toBe('Approved by Ruth Adeyemi (level: Sign off)');
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi', approval_level: 'managerReview' })?.text).toBe('Approved by Ruth Adeyemi (level: Manager review)');
  });

  it('says a change was approved at a level even when the entry does not name who approved it', () => {
    expect(historyAttribution({ approval_level: 'review' })).toEqual({ text: 'Approved (level: Review)', namesActor: false });
    expect(historyAttribution({ actor_name: 'Billing Agent', approval_level: 'review' })?.text).toBe('Billing Agent · approved (level: Review)');
  });

  it('prints exactly the 0.12.0 phrase for an entry with no level, with or without an approval id', () => {
    expect(historyAttribution(resend)).toEqual({ text: phrase, namesActor: true });
    expect(historyAttribution({ ...resend, approval_id: 'apr_resend_0429' })).toStrictEqual(historyAttribution(resend));
    expect(historyAttribution({ ...resend, approval_level: '  ' })).toStrictEqual(historyAttribution(resend));
    // An id alone names no one and no level: the entry still prints nothing new.
    expect(historyAttribution({ actor_id: 'usr_1', approval_id: 'apr_1' })).toBeUndefined();
  });
});

describe('every history path carries the level, through the one helper', () => {
  it('recipe rows, the audit summary and the generated rail print the phrase with its level', () => {
    expect(traitEventRows('transition', { history: [pointed] })[0]).toMatchObject({ attribution: withLevel, actor: undefined });
    const log = [{ ...pointed, from_state: 'paid', to_state: 'refunded', transitioned_at: pointed.at }];
    expect(auditSummary({ auditLog: log }).actor).toBe(withLevel);
    expect(recordCollectionEvents({ state_history: [pointed] })[0]?.attribution).toBe(withLevel);
  });

  it('an entry without the two fields gives each path the row it gave in 0.12.0', () => {
    const unnamed = { title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge', actor_id: 'usr_1' };
    expect(traitEventRows('transition', { history: [{ ...unnamed, approval_id: 'apr_1' }] })).toStrictEqual(traitEventRows('transition', { history: [unnamed] }));
    expect(recordCollectionEvents({ state_history: [{ ...unnamed, approval_id: 'apr_1' }] })).toStrictEqual(recordCollectionEvents({ state_history: [unnamed] }));
  });
});
