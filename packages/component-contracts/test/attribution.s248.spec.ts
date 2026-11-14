/**
 * s248-m01: a grant is a standing yes, not a setting, and the line in a record's history can say which grant a change was
 * made under. A history entry can point at its grant (grant_id) and name it (grant_name). These checks encode why it matters:
 * - a reader of the payment's history needs to know on whose standing yes the agent acted, so every history path prints the
 *   grant's name, after any approval and before the task, in one phrase built in one place;
 * - a change a standing yes allowed was approved by no one at the time, so a line with a grant and no approver must never
 *   read "approved by": it names the grant;
 * - the id is a pointer kept in the record's data: a generated app holds one object's records, so the line cannot open the
 *   grant, and printing an opaque id would read as a link that goes nowhere;
 * - a history written before 0.15.0 has neither field and must print exactly what 0.14.0 printed.
 */
import { describe, expect, it } from 'vitest';
import { auditSummary, historyAttribution, recordCollectionEvents, traitEventRows } from '../src/index.js';

const approved = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)';
const resend = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op',
  approved_by_id: 'usr_ruth', approved_by_name: 'Ruth Adeyemi', approval_id: 'apr_resend_0429', approval_level: 'approval',
};
const granted = { ...resend, grant_id: 'grt_tidewater_billing', grant_name: 'Tidewater Co-op invoices and payments' };
const full = { ...granted, task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };
const fullLine = `${approved} · grant: Tidewater Co-op invoices and payments · task: Get INV-2026-0155 paid`;
// A later resend a standing yes allowed: no approval was asked, so no one is named as approving it.
const allowed = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-10-20T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op',
  grant_id: 'grt_tidewater_resends', grant_name: 'Resend returned transfers',
};
const allowedLine = 'Billing Agent for Tidewater Co-op · grant: Resend returned transfers';

describe('historyAttribution names the grant a change was made under', () => {
  it('prints the grant after who acted and who approved, before the task, and never the grant id', () => {
    expect(historyAttribution(granted)).toEqual({ text: `${approved} · grant: Tidewater Co-op invoices and payments`, namesActor: true });
    expect(historyAttribution(full)).toEqual({ text: fullLine, namesActor: true });
    expect(historyAttribution(full)?.text).not.toContain('grt_tidewater_billing');
  });

  it('never reads "approved by" on a line a standing yes allowed with no approval', () => {
    expect(historyAttribution(allowed)).toEqual({ text: allowedLine, namesActor: true });
    expect(historyAttribution(allowed)?.text).not.toMatch(/approved/i);
    expect(historyAttribution({ ...allowed, task_name: 'Resend returned transfers for Tidewater' })?.text).toBe(`${allowedLine} · task: Resend returned transfers for Tidewater`);
  });

  it('names the grant with whatever else the entry names, and alone when it names no one', () => {
    expect(historyAttribution({ grant_name: 'Resend returned transfers' })).toEqual({ text: 'Grant: Resend returned transfers', namesActor: false });
    expect(historyAttribution({ grant_name: '  Resend returned transfers ' })?.text).toBe('Grant: Resend returned transfers');
    expect(historyAttribution({ grant_name: 'Resend returned transfers', task_name: 'Get INV-2026-0155 paid' })?.text).toBe('Grant: Resend returned transfers · task: Get INV-2026-0155 paid');
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi', grant_name: 'Resend returned transfers' })?.text).toBe('Approved by Ruth Adeyemi · grant: Resend returned transfers');
  });

  it('prints exactly the 0.14.0 phrase for an entry with no grant name, with or without a grant id', () => {
    expect(historyAttribution(resend)).toEqual({ text: approved, namesActor: true });
    expect(historyAttribution({ ...resend, grant_id: 'grt_tidewater_billing' })).toStrictEqual(historyAttribution(resend));
    expect(historyAttribution({ ...resend, grant_name: '  ' })).toStrictEqual(historyAttribution(resend));
    const tasked = { ...resend, task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };
    expect(historyAttribution({ ...tasked, grant_id: 'grt_tidewater_billing' })?.text).toBe(`${approved} · task: Get INV-2026-0155 paid`);
    // An id alone names no one and no grant: the entry still prints nothing new.
    expect(historyAttribution({ actor_id: 'usr_1', grant_id: 'grt_1' })).toBeUndefined();
  });
});

describe('every history path carries the grant, through the one helper', () => {
  it('recipe rows, the audit summary and the generated rail print the phrase with its grant', () => {
    expect(traitEventRows('transition', { history: [full] })[0]).toMatchObject({ attribution: fullLine, actor: undefined });
    const log = [{ ...full, from_state: 'returned', to_state: 'pending', transitioned_at: full.at }];
    expect(auditSummary({ auditLog: log }).actor).toBe(fullLine);
    expect(recordCollectionEvents({ state_history: [allowed] })[0]?.attribution).toBe(allowedLine);
  });

  it('an entry without the two fields gives each path the row it gave in 0.14.0', () => {
    const plain = { title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge', actor_id: 'usr_1' };
    expect(traitEventRows('transition', { history: [{ ...plain, grant_id: 'grt_1' }] })).toStrictEqual(traitEventRows('transition', { history: [plain] }));
    expect(recordCollectionEvents({ state_history: [{ ...plain, grant_id: 'grt_1' }] })).toStrictEqual(recordCollectionEvents({ state_history: [plain] }));
    // The summary keeps its recent entries as the record holds them, so the id stays in the data; what it prints does not move.
    const pointed = auditSummary({ auditLog: [{ ...plain, grant_id: 'grt_1', from_state: 'paid', to_state: 'refunded', transitioned_at: plain.at }] });
    const before = auditSummary({ auditLog: [{ ...plain, from_state: 'paid', to_state: 'refunded', transitioned_at: plain.at }] });
    expect({ ...pointed, recent: undefined }).toStrictEqual({ ...before, recent: undefined });
    expect(pointed.recent[0]).toMatchObject({ grant_id: 'grt_1' });
  });
});
