/**
 * s248-m01: a change made under a grant names its grant on every Vue history component, as React and HTML print it, after
 * any approval and before the task, and keeps the grant's id out of the printed line; a change a standing yes allowed never
 * reads "approved by". A history written before 0.15.0 renders exactly as it did.
 */
import { renderToString } from '@vue/server-renderer';
import { h, type Component } from 'vue';
import { describe, expect, it } from 'vitest';

import { AuditSummaryCard } from '../src/disputed.js';
import { AuditTimeline, StatusTimeline } from '../src/ported.js';
import { StateTransitionEvent } from '../src/trait-recipes.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater Co-op invoices and payments · task: Get INV-2026-0155 paid';
const resend = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi',
  approval_id: 'apr_resend_0429', approval_level: 'approval', task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid',
};
const granted = { ...resend, grant_id: 'grt_tidewater_billing', grant_name: 'Tidewater Co-op invoices and payments' };
const allowed = {
  title: 'Sent again', from: 'returned', to: 'pending', at: '2026-10-20T09:15:00Z', reason: 'Sent again by bank transfer',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op',
  grant_id: 'grt_tidewater_resends', grant_name: 'Resend returned transfers',
};
const audit = (entry: Record<string, unknown>) => ({ ...entry, from_state: entry.from, to_state: entry.to, transitioned_at: entry.at });
const render = (component: Component, props: Record<string, unknown>) => renderToString(h(component, props));

describe('the grant on the Vue history components', () => {
  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the grant, never its id', async () => {
    const pages = [
      await render(StatusTimeline, { status: 'pending', stateHistory: [granted] }),
      await render(AuditTimeline, { auditLog: [audit(granted)] }),
      await render(AuditSummaryCard, { auditLog: [audit(granted)] }),
      await render(StateTransitionEvent, { history: [granted] }),
    ];
    for (const html of pages) {
      expect(html).toContain(phrase);
      expect(html).not.toContain('grt_tidewater_billing');
    }
  });

  it('a change a standing yes allowed names the grant and no approver', async () => {
    const html = await render(StatusTimeline, { status: 'pending', stateHistory: [allowed] });
    expect(html).toContain('Billing Agent for Tidewater Co-op · grant: Resend returned transfers');
    expect(html).not.toMatch(/approved/i);
  });

  it('an entry with a grant id and no grant name renders byte for byte as the 0.14.0 entry', async () => {
    expect(await render(StatusTimeline, { status: 'pending', stateHistory: [{ ...resend, grant_id: 'grt_tidewater_billing' }] }))
      .toBe(await render(StatusTimeline, { status: 'pending', stateHistory: [resend] }));
    expect(await render(StateTransitionEvent, { history: [{ ...resend, grant_id: 'grt_tidewater_billing' }] }))
      .toBe(await render(StateTransitionEvent, { history: [resend] }));
    expect(await render(AuditTimeline, { auditLog: [audit({ ...resend, grant_id: 'grt_tidewater_billing' })] }))
      .toBe(await render(AuditTimeline, { auditLog: [audit(resend)] }));
  });
});
