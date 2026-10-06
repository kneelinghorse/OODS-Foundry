import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { placedChartRequests } from '../../src/codegen/chart-assets.js';
import { deriveConsumerModel, schemaNodes, seedPreviewModel } from '../../src/codegen/preview-model.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { OBJECTS, contextsForObject, supportsWorkflow } from '../../src/lib/runtime-ledger.js';
import { renderGenerated, runGeneratedStore } from './render-generated.js';

/**
 * Sprint 220 m01: the Sprint 219 review's screen carries (#2461), each fixed where the screen gets it.
 *  1. The Subscription payment chart filled its plot as one solid block: an area over a steady price.
 *  2. An edited Subscription contradicted itself (#2458): "€19.99 · yearly" beside "77% complete · 7 days remaining", a
 *     next payment a month after the last, and a timeline whose last payment read the new price.
 *  3. Standalone Subscription and Transaction timelines said "No events yet" above populated state transitions.
 *  4. Subscription and Transaction cards showed a bare "false" archive pill.
 */
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };

async function composed(object: string, context: string) {
  const result = await compose({ object, context, options: { transient: true } } as never);
  expect(result.status, `${object}/${context}`).toBe('ok');
  return result.schema! as UiSchema;
}

describe('the Subscription payment chart reads as payments (carry 1)', () => {
  it('draws one bar per recorded payment, labelled with its date, in date order', async () => {
    const detail = await composed('Subscription', 'detail');
    const chart = schemaNodes(detail).find(node => node.chart)!;
    expect(chart.component).toBe('VizMarkPreview');
    expect(chart.chart).toMatchObject({ chartType: 'bar', source: 'payment-events' });
    const workflow = await composed('Subscription', 'workflow');
    const shown = seedPreviewModel({ schema: detail, context: 'detail', object: 'Subscription', workflowSchema: workflow });
    const cedar = Object.fromEntries(Object.entries(shown).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]));
    const [placed] = placedChartRequests(detail, {}, cedar);
    expect(placed!.request.chartType).toBe('bar');
    expect(placed!.request.encodings).toMatchObject({ x: { field: 'payment', type: 'ordinal', sort: 'none' }, y: { field: 'amount' } });
    // s222-m03 (#2502 ruling 14): the preview shows the third live seed record, Lindqvist Bakery's Starter subscription:
    // its eleven recorded payments of 19.00, one bar each in date order, with the retried May charge, the duplicate August
    // charge and its refund as they happened.
    const payments = [['Jan 15', 19], ['Feb 15', 19], ['Mar 15', 19], ['Apr 15', 19], ['May 17', 19], ['Jun 15', 19], ['Jul 15', 19], ['Aug 15', 19], ['Aug 16', 19], ['Aug 19', -19], ['Sep 15', 19]] as const;
    expect(placed!.request.rows).toEqual(payments.map(([day, amount]) => ({ payment: `${day}, 2026`, amount })));
  });

  it('keeps an authored area payment chart valid for objects that declare one', async () => {
    const detail = await composed('Subscription', 'detail');
    const area = structuredClone(detail);
    for (const node of schemaNodes(area)) if (node.chart) { node.component = 'VizAreaPreview'; node.chart = { ...node.chart, chartType: 'area' } as never; }
    const workflow = await composed('Subscription', 'workflow');
    const shown = seedPreviewModel({ schema: detail, context: 'detail', object: 'Subscription', workflowSchema: workflow });
    const record = Object.fromEntries(Object.entries(shown).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]));
    expect(placedChartRequests(area, {}, record)[0]!.request.encodings).toMatchObject({ x: { field: 'date', scale: 'temporal' } });
  });
});

describe('an edited Subscription does not contradict itself (carry 2, #2458)', () => {
  const now = '2026-09-28T15:10:00.000Z';
  const run = async (script: string) => {
    const workflow = await composed('Subscription', 'workflow');
    const result = await generate({ schema: workflow, framework: 'react', profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    return runGeneratedStore(result.artifact!.files, `const s = store.createStore({ now: () => ${JSON.stringify(now)} });\nconst find = (id) => s.get(id);\n${script}`) as Record<string, any>;
  };

  it('starts a new billing period when an active record takes new terms (Billable anchor reset)', async () => {
    const out = await run(`
const before = find('sub_lindqvist_starter');
const saved = s.update({ ...before, amount: 1999, billing_interval: 'yearly', plan_name: 'Team annual' });
const events = store.collectionEvents(saved).filter(event => event.kind === 'payment').map(event => [event.title, event.at, event.description]);
const cancelled = s.cancel('sub_lindqvist_starter', 'Budget changed for next year', 'customer_request', true);
process.stdout.write(JSON.stringify({ before, saved, events, cancelled }));`);
    // s222-m03 (#2502 ruling 14): Lindqvist Bakery's Starter sample is the active EUR monthly record.
    // Before: the authored monthly period (Sep 15 to Oct 15, 50%) and its €19.00 payments.
    expect(out.before).toMatchObject({ billing_interval: 'monthly', current_period_start: '2026-09-15T08:00:00Z', current_period_end: '2026-10-15T08:00:00Z', current_period_progress: 0.5, next_payment_due_at: '2026-10-15T08:00:00Z', payment_status: 'succeeded' });
    // After: a yearly period from the edit, its payment due now and not yet taken. What was paid stays history.
    expect(out.saved).toMatchObject({ amount: 1999, billing_interval: 'yearly', current_period_start: now, current_period_end: '2027-09-28T15:10:00.000Z', next_payment_due_at: now, payment_status: 'pending', last_payment_at: '2026-09-15T08:00:00Z', last_event: 'billing_cycle_started', last_event_at: now });
    expect(out.saved.current_period_progress).toBeUndefined();
    expect(out.saved.payment_history).toEqual(out.before.payment_history);
    expect(out.saved.state_history.at(-1)).toMatchObject({ title: 'Updated', reason: 'Edited Amount, Billing interval, Plan name; a new billing period started' });
    expect(out.events).toEqual([
      ['Last payment', '2026-09-15T08:00:00Z', '€19.00'],
      ['Next payment', now, '€19.99 · yearly'],
    ]);
    // Cancelling at the new period's end is the last event; the payment due at its start still stands.
    expect(out.cancelled).toMatchObject({ status: 'pending_cancellation', cancel_at_period_end: true, last_event: 'cancellation_requested', last_event_at: now, next_payment_due_at: now });
  });

  it('keeps a period field the edit itself sets, and the terms of a record that is not billing now', async () => {
    const out = await run(`
const own = s.update({ ...find('sub_northwind_business'), billing_interval: 'yearly', current_period_end: '2027-01-01T00:00:00Z' });
const spruce = find('sub_northwind_analytics');
const paused = s.update({ ...spruce, amount: 9900 });
process.stdout.write(JSON.stringify({ own, paused, spruce }));`);
    expect(out.own).toMatchObject({ current_period_start: now, current_period_end: '2027-01-01T00:00:00Z', next_payment_due_at: now });
    // A paused record bills nothing now: its authored period, next payment and payment status stand.
    expect(out.paused).toMatchObject({ status: 'paused', amount: 9900 });
    for (const field of ['current_period_start', 'current_period_end', 'current_period_progress', 'next_payment_due_at', 'payment_status']) expect(out.paused[field], field).toEqual(out.spruce[field]);
    expect(out.paused.state_history.at(-1).reason).toBe('Edited Amount');
  });

  it('keeps recorded payments in the currency they were paid in', async () => {
    const out = await run(`
const saved = s.update({ ...find('sub_lindqvist_starter'), currency: 'USD' });
process.stdout.write(JSON.stringify({ saved, last: store.collectionEvents(saved).find(event => event.title === 'Last payment') }));`);
    expect(out.saved.payment_history.every((row: { currency: string }) => row.currency === 'EUR')).toBe(true);
    expect(out.last.description).toBe('€19.00');
  });

  it('cancelling an unedited record at its period end cancels the renewal payment', async () => {
    // s222-m03 (#2502 ruling 14): Northwind Traders' Business sample is the active USD monthly record (period ends Oct 2).
    const out = await run(`process.stdout.write(JSON.stringify(s.cancel('sub_northwind_business', 'Moving on', 'customer_request', true)));`);
    expect(out).toMatchObject({ status: 'pending_cancellation', current_period_end: '2026-10-02T15:00:00Z', last_event: 'cancellation_requested' });
    expect(out.next_payment_due_at).toBeUndefined();
  });
});

describe('a standalone timeline shows the record\'s own events (carry 3)', () => {
  it.each(['Subscription', 'Transaction'])('%s: the consumer model carries the record\'s events', async (object) => {
    const timeline = await composed(object, 'timeline');
    const model = deriveConsumerModel(timeline);
    expect((model.events as unknown[]).length).toBeGreaterThan(0);
  });

  it.each([['Subscription', 'react'], ['Subscription', 'vue'], ['Transaction', 'react'], ['Transaction', 'vue']] as const)('%s %s: a screen passed no events lists the record\'s own, never "No events yet" above its transitions', async (object, framework) => {
    const timeline = await composed(object, 'timeline');
    const workflow = await composed(object, 'workflow');
    const result = await generate({ schema: timeline, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const { events: _events, ...record } = seedPreviewModel({ schema: timeline, context: 'timeline', object, workflowSchema: workflow });
    const html = renderGenerated(framework, result.code!, record, result.artifact!.actions.map(({ name }) => name));
    const fragment = JSDOM.fragment(html);
    const listed = [...fragment.querySelectorAll('[data-oods-collection=events] ol > li')].map(item => item.textContent);
    expect(listed.length, `${object} ${framework}`).toBeGreaterThan(0);
    expect(fragment.textContent).not.toContain('No events yet');
    // An explicit empty list is the consumer's word and keeps the empty state.
    const empty = JSDOM.fragment(renderGenerated(framework, result.code!, { ...record, events: [] }, result.artifact!.actions.map(({ name }) => name)));
    expect(empty.querySelector('[data-oods-collection=events]')?.textContent).toContain('No events yet');
  });
});

describe('every public runtime timeline: a screen passed no events shows what the preview passes it', () => {
  const timelines = OBJECTS.filter(object => contextsForObject(object).includes('timeline'));
  it.each(['react', 'vue'] as const)('%s, all timeline objects', async (framework) => {
    // s233-m02: the public runtime retains 16 objects; only the two comparison objects omit timelines.
    expect(timelines).toHaveLength(14);
    for (const object of timelines) {
      const timeline = await composed(object, 'timeline');
      const model = supportsWorkflow(object) ? seedPreviewModel({ schema: timeline, context: 'timeline', object, workflowSchema: await composed(object, 'workflow') }) : deriveConsumerModel(timeline);
      const result = await generate({ schema: timeline, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } });
      expect(result.status, `${object} ${JSON.stringify(result.errors)}`).toBe('ok');
      const { events, ...record } = model;
      const actions = result.artifact!.actions.map(({ name }) => name);
      const section = (html: string) => JSDOM.fragment(html).querySelector('[data-oods-collection=events]')?.innerHTML;
      expect(section(renderGenerated(framework, result.code!, record, actions)), `${object} ${framework}`).toBe(section(renderGenerated(framework, result.code!, { ...record, events }, actions)));
    }
  });
});

// s223-m01 (#2527 ruling 7): a card states an archive only when there is one. The default ("Not archived") is not
// drawn at all, and still no bare "false" or machine code reaches the card.
describe('cards say whether a record is archived in words (carry 4)', () => {
  it.each([['Subscription', 'react'], ['Subscription', 'vue'], ['Transaction', 'react'], ['Transaction', 'vue']] as const)('%s %s card shows no default-only archive chip, never a bare false', async (object, framework) => {
    const card = await composed(object, 'card');
    const workflow = await composed(object, 'workflow');
    const result = await generate({ schema: card, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const html = renderGenerated(framework, result.code!, seedPreviewModel({ schema: card, context: 'card', object, workflowSchema: workflow }), result.artifact!.actions.map(({ name }) => name));
    // s221-m01: the rendered card was also named `card`, so this file never compiled after 817cd3af1 and none of its
    // tests ran; the fragment is `page` now.
    const page = JSDOM.fragment(html);
    // The shown sample is not archived, so its card carries no archive chip; an archived record's still does
    // (the ArchivePill scenario specs in React, Vue and HTML).
    expect(page.querySelector('[data-oods-component=ArchivePill]')).toBeNull();
    expect(page.textContent).not.toContain('Not archived');
    // No machine code on the card either: Transaction's pricing model read "one_time" beside the pill.
    expect(page.textContent).not.toMatch(/\b(false|one_time)\b/);
  });
});
