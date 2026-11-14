/* @vitest-environment node */
/**
 * s248-m01: a change made under a grant names its grant on every React history component, after any approval and before
 * the task, and keeps the grant's id out of the printed line; a change a standing yes allowed never reads "approved by". A
 * history written before 0.15.0 has neither field and renders exactly as it did.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

describe('the grant on the React history components', () => {
  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the grant, never its id', () => {
    const pages = [
      renderToStaticMarkup(<StatusTimeline status="pending" stateHistory={[granted]} />),
      renderToStaticMarkup(<AuditTimeline auditLog={[audit(granted)]} />),
      renderToStaticMarkup(<AuditSummaryCard auditLog={[audit(granted)]} />),
      renderToStaticMarkup(<StateTransitionEvent history={[granted]} />),
    ];
    for (const html of pages) {
      expect(html).toContain(phrase);
      expect(html).not.toContain('grt_tidewater_billing');
    }
    expect(pages[0]).toContain(`<p class="oods-timeline__actor" data-timeline-attribution="true">${phrase}</p>`);
  });

  it('a change a standing yes allowed names the grant and no approver', () => {
    const html = renderToStaticMarkup(<StatusTimeline status="pending" stateHistory={[allowed]} />);
    expect(html).toContain('<p class="oods-timeline__actor" data-timeline-attribution="true">Billing Agent for Tidewater Co-op · grant: Resend returned transfers</p>');
    expect(html).not.toMatch(/approved/i);
  });

  it('an entry with a grant id and no grant name renders byte for byte as the 0.14.0 entry', () => {
    expect(renderToStaticMarkup(<StatusTimeline status="pending" stateHistory={[{ ...resend, grant_id: 'grt_tidewater_billing' }]} />))
      .toBe(renderToStaticMarkup(<StatusTimeline status="pending" stateHistory={[resend]} />));
    expect(renderToStaticMarkup(<StateTransitionEvent history={[{ ...resend, grant_id: 'grt_tidewater_billing' }]} />))
      .toBe(renderToStaticMarkup(<StateTransitionEvent history={[resend]} />));
    expect(renderToStaticMarkup(<AuditTimeline auditLog={[audit({ ...resend, grant_id: 'grt_tidewater_billing' })]} />))
      .toBe(renderToStaticMarkup(<AuditTimeline auditLog={[audit(resend)]} />));
  });
});
