/**
 * s247-m01: a change made as part of a task names its task on every Vue history component, as React and HTML print it, and
 * keeps the task's id out of the printed line. A history written before 0.14.0 renders exactly as it did.
 */
import { renderToString } from '@vue/server-renderer';
import { h, type Component } from 'vue';
import { describe, expect, it } from 'vitest';

import { AuditSummaryCard } from '../src/disputed.js';
import { AuditTimeline, StatusTimeline } from '../src/ported.js';
import { StateTransitionEvent } from '../src/trait-recipes.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · task: Get INV-2026-0155 paid';
const resend = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi',
  approval_id: 'apr_resend_0429', approval_level: 'approval',
};
const tasked = { ...resend, task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };
const audit = (entry: Record<string, unknown>) => ({ ...entry, from_state: entry.from, to_state: entry.to, transitioned_at: entry.at });
const render = (component: Component, props: Record<string, unknown>) => renderToString(h(component, props));

describe('the task on the Vue history components', () => {
  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the task, never its id', async () => {
    const pages = [
      await render(StatusTimeline, { status: 'pending', stateHistory: [tasked] }),
      await render(AuditTimeline, { auditLog: [audit(tasked)] }),
      await render(AuditSummaryCard, { auditLog: [audit(tasked)] }),
      await render(StateTransitionEvent, { history: [tasked] }),
    ];
    for (const html of pages) {
      expect(html).toContain(phrase);
      expect(html).not.toContain('tsk_tidewater_0155');
    }
  });

  it('an entry with a task id and no task name renders byte for byte as the 0.13.1 entry', async () => {
    expect(await render(StatusTimeline, { status: 'pending', stateHistory: [{ ...resend, task_id: 'tsk_tidewater_0155' }] }))
      .toBe(await render(StatusTimeline, { status: 'pending', stateHistory: [resend] }));
    expect(await render(StateTransitionEvent, { history: [{ ...resend, task_id: 'tsk_tidewater_0155' }] }))
      .toBe(await render(StateTransitionEvent, { history: [resend] }));
    expect(await render(AuditTimeline, { auditLog: [audit({ ...resend, task_id: 'tsk_tidewater_0155' })] }))
      .toBe(await render(AuditTimeline, { auditLog: [audit(resend)] }));
  });
});
