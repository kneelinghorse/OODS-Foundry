/**
 * s247-m01: a task is an ask, not a ticket, and the line in a record's history can say which task a change was made under.
 * A history entry can point at its task (task_id) and name it (task_name). These checks encode why it matters:
 * - a reader of the payment's history needs to know which piece of work the resend belonged to, so every history path
 *   prints the task's name, after who acted and who approved, in one phrase built in one place;
 * - the id is a pointer kept in the record's data: a generated app holds one object's records, so the line cannot open the
 *   task, and printing an opaque id would read as a link that goes nowhere;
 * - a history written before 0.14.0 has neither field and must print exactly what 0.13.1 printed.
 */
import { describe, expect, it } from 'vitest';
import { auditSummary, historyAttribution, recordCollectionEvents, traitEventRows } from '../src/index.js';

const approved = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)';
const withTask = `${approved} · task: Get INV-2026-0155 paid`;
const resend = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op',
  approved_by_id: 'usr_ruth', approved_by_name: 'Ruth Adeyemi', approval_id: 'apr_resend_0429', approval_level: 'approval',
};
const tasked = { ...resend, task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };

describe('historyAttribution names the task a change was made under', () => {
  it('prints the task after who acted and who approved, and never the task id', () => {
    expect(historyAttribution(tasked)).toEqual({ text: withTask, namesActor: true });
    expect(historyAttribution(tasked)?.text).not.toContain('tsk_tidewater_0155');
  });

  it('names the task with whatever else the entry names, and alone when it names no one', () => {
    expect(historyAttribution({ actor_name: 'Ruth Adeyemi', task_name: 'Call Tidewater about the transfer' })?.text).toBe('Ruth Adeyemi · task: Call Tidewater about the transfer');
    expect(historyAttribution({ approved_by_name: 'Ruth Adeyemi', task_name: 'Get INV-2026-0155 paid' })?.text).toBe('Approved by Ruth Adeyemi · task: Get INV-2026-0155 paid');
    expect(historyAttribution({ task_name: 'Get INV-2026-0155 paid' })).toEqual({ text: 'Task: Get INV-2026-0155 paid', namesActor: false });
    expect(historyAttribution({ task_name: '  Get INV-2026-0155 paid ' })?.text).toBe('Task: Get INV-2026-0155 paid');
  });

  it('prints exactly the 0.13.1 phrase for an entry with no task name, with or without a task id', () => {
    expect(historyAttribution(resend)).toEqual({ text: approved, namesActor: true });
    expect(historyAttribution({ ...resend, task_id: 'tsk_tidewater_0155' })).toStrictEqual(historyAttribution(resend));
    expect(historyAttribution({ ...resend, task_name: '  ' })).toStrictEqual(historyAttribution(resend));
    // An id alone names no one and no task: the entry still prints nothing new.
    expect(historyAttribution({ actor_id: 'usr_1', task_id: 'tsk_1' })).toBeUndefined();
  });
});

describe('every history path carries the task, through the one helper', () => {
  it('recipe rows, the audit summary and the generated rail print the phrase with its task', () => {
    expect(traitEventRows('transition', { history: [tasked] })[0]).toMatchObject({ attribution: withTask, actor: undefined });
    const log = [{ ...tasked, from_state: 'returned', to_state: 'pending', transitioned_at: tasked.at }];
    expect(auditSummary({ auditLog: log }).actor).toBe(withTask);
    expect(recordCollectionEvents({ state_history: [tasked] })[0]?.attribution).toBe(withTask);
  });

  it('an entry without the two fields gives each path the row it gave in 0.13.1', () => {
    const plain = { title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge', actor_id: 'usr_1' };
    expect(traitEventRows('transition', { history: [{ ...plain, task_id: 'tsk_1' }] })).toStrictEqual(traitEventRows('transition', { history: [plain] }));
    expect(recordCollectionEvents({ state_history: [{ ...plain, task_id: 'tsk_1' }] })).toStrictEqual(recordCollectionEvents({ state_history: [plain] }));
    // The summary keeps its recent entries as the record holds them, so the id stays in the data; what it prints does not move.
    const pointed = auditSummary({ auditLog: [{ ...plain, task_id: 'tsk_1', from_state: 'paid', to_state: 'refunded', transitioned_at: plain.at }] });
    const before = auditSummary({ auditLog: [{ ...plain, from_state: 'paid', to_state: 'refunded', transitioned_at: plain.at }] });
    expect({ ...pointed, recent: undefined }).toStrictEqual({ ...before, recent: undefined });
    expect(pointed.recent[0]).toMatchObject({ task_id: 'tsk_1' });
  });
});
