/**
 * s244-m01 (#2829): every recorded change names who acted, who it acted for and who approved it, on every history
 * component, as React and HTML print it. A history written before 0.12.0 names no one and renders exactly as it did.
 */
import { renderToString } from '@vue/server-renderer';
import { h, type Component } from 'vue';
import { describe, expect, it } from 'vitest';

import { AuditSummaryCard } from '../src/disputed.js';
import { AuditTimeline, StatusTimeline } from '../src/ported.js';
import { StateTransitionEvent } from '../src/trait-recipes.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi';
const named = {
  title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent',
  on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi',
};
const unnamed = { title: 'Activated', from: 'draft', to: 'active', at: '2026-10-02T09:00:00Z', reason: 'Approved', actor_id: 'usr_1' };
const audit = (entry: Record<string, unknown>) => ({ ...entry, from_state: entry.from, to_state: entry.to, transitioned_at: entry.at });
const render = (component: Component, props: Record<string, unknown>) => renderToString(h(component, props));

describe('history names on the Vue history components', () => {
  it('StatusTimeline prints the phrase in place of a named actor id, and an unnamed entry as before', async () => {
    const html = await render(StatusTimeline, { status: 'refunded', stateHistory: [unnamed, named] });
    expect(html).toContain(`<p class="oods-timeline__actor" data-timeline-attribution="true">${phrase}</p>`);
    expect(html).not.toContain('Actor: agt_billing');
    expect(html).toContain('<p class="oods-timeline__actor" data-timeline-actor="true">Actor: usr_1</p>');
    expect(html.match(/data-timeline-attribution/g)).toHaveLength(1);
  });

  it('AuditTimeline does the same for audit_log entries', async () => {
    const html = await render(AuditTimeline, { auditLog: [audit(unnamed), audit(named)] });
    expect(html).toContain(phrase);
    expect(html).not.toContain('Actor: agt_billing');
    expect(html).toContain('Actor: usr_1');
  });

  it('an entry with no names renders byte for byte as an entry without the new fields would', async () => {
    const before = await render(StatusTimeline, { status: 'active', stateHistory: [unnamed] });
    expect(before).not.toContain('data-timeline-attribution');
    expect(await render(StatusTimeline, { status: 'active', stateHistory: [{ ...unnamed, actor_name: ' ', actor_kind: 'person' }] })).toBe(before);
  });

  it('showActorId false hides who acted, named or not', async () => {
    const html = await render(StatusTimeline, { status: 'refunded', stateHistory: [named, unnamed], showActorId: false });
    expect(html).not.toContain(phrase);
    expect(html).not.toContain('Actor:');
  });

  it("AuditSummaryCard's last actor is the phrase", async () => {
    expect(await render(AuditSummaryCard, { auditLog: [audit(unnamed), audit(named)] })).toContain(`<dt>Last actor</dt><dd>${phrase}</dd>`);
    expect(await render(AuditSummaryCard, { auditLog: [audit(unnamed)] })).toContain('<dt>Last actor</dt><dd>usr_1</dd>');
  });

  it('the recipe rows (StateTransitionEvent) print the phrase, and "Actor: <id>" only for an unnamed actor', async () => {
    const html = await render(StateTransitionEvent, { history: [unnamed, named] });
    expect(html).toContain(`<p>${phrase}</p>`);
    expect(html).not.toContain('Actor: agt_billing');
    expect(html).toContain('<p>Actor: usr_1</p>');
  });
});
