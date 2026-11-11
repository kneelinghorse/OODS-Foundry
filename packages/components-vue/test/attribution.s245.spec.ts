/**
 * s245-m01: a change someone approved names its level of yes on every Vue history component, as React and HTML print it,
 * and keeps its approval's id out of the printed line. A history written before 0.13.0 renders exactly as it did.
 */
import { renderToString } from '@vue/server-renderer';
import { h, type Component } from 'vue';
import { describe, expect, it } from 'vitest';

import { AuditSummaryCard } from '../src/disputed.js';
import { AuditTimeline, StatusTimeline } from '../src/ported.js';
import { StateTransitionEvent } from '../src/trait-recipes.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)';
const resend = {
  title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi',
};
const pointed = { ...resend, approval_id: 'apr_resend_0429', approval_level: 'approval' };
const audit = (entry: Record<string, unknown>) => ({ ...entry, from_state: entry.from, to_state: entry.to, transitioned_at: entry.at });
const render = (component: Component, props: Record<string, unknown>) => renderToString(h(component, props));

describe('the level of yes on the Vue history components', () => {
  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the level, never the approval id', async () => {
    const pages = [
      await render(StatusTimeline, { status: 'refunded', stateHistory: [pointed] }),
      await render(AuditTimeline, { auditLog: [audit(pointed)] }),
      await render(AuditSummaryCard, { auditLog: [audit(pointed)] }),
      await render(StateTransitionEvent, { history: [pointed] }),
    ];
    for (const html of pages) {
      expect(html).toContain(phrase);
      expect(html).not.toContain('apr_resend_0429');
    }
  });

  it('an entry with an approval id and no level renders byte for byte as the 0.12.0 entry', async () => {
    expect(await render(StatusTimeline, { status: 'refunded', stateHistory: [{ ...resend, approval_id: 'apr_resend_0429' }] }))
      .toBe(await render(StatusTimeline, { status: 'refunded', stateHistory: [resend] }));
    expect(await render(StateTransitionEvent, { history: [{ ...resend, approval_id: 'apr_resend_0429' }] }))
      .toBe(await render(StateTransitionEvent, { history: [resend] }));
  });
});
