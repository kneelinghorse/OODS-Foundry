/**
 * s222-m03 (#2502 ruling 14): the eleven public objects ship authored sample records, and a generated app shows them as
 * a real product would. These checks encode what makes the records believable: each names itself and says what it is
 * about, its status is one its lifecycle allows and its history walks the lifecycle's transitions from the initial
 * state, its dates run forward, its money has a real currency, every reference carries the name it shows, and the
 * objects agree with each other (an invoice's customer is a sample organization, a subscription is on a sample plan).
 */
import { describe, expect, it } from 'vitest';
import { recordCollectionEvents } from '@oods/component-contracts';
import { populateObjectSchema } from '../../src/compose/object-slot-filler.js';
import { recordNameField, recordSummaryField } from '../../src/compose/record-label.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import type { FieldSchemaEntry, UiSchema } from '../../src/schemas/generated.js';
// The live authority for the subscription machine (traits/lifecycle/Stateful.trait.yaml governanceExamples).
import { SUBSCRIPTION_TRANSITIONS } from '../../../../src/domain/billing/states.js';

type Sample = Record<string, unknown>;
const PUBLIC = ['User', 'Organization', 'Product', 'Subscription', 'Transaction', 'Relationship', 'Article', 'Media', 'Invoice', 'Plan', 'Usage'];

function prepared(name: string) {
  const definition = loadObject(name);
  const composed = composeObject(definition);
  const schema: UiSchema = { version: '2026.02', screens: [{ id: 'root', component: 'Box' }] };
  // The producer refuses unknown fields, fields the object never supplies and values outside a field's enum.
  populateObjectSchema(schema, composed.schema, composed.semantics, composed.traits, composed.samples);
  const parameters = (trait: string) => composed.traits.find(entry => entry.ref.name.split('/').pop() === trait)?.ref.parameters;
  return { samples: (definition.samples ?? []) as Sample[], fields: schema.objectSchema as Record<string, FieldSchemaEntry>, parameters };
}
const at = (value: unknown) => {
  expect(typeof value === 'string' && Number.isFinite(Date.parse(value)), `a date: ${String(value)}`).toBe(true);
  return Date.parse(value as string);
};
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const all = Object.fromEntries(PUBLIC.map(name => [name, prepared(name)]));

describe.each(PUBLIC)('%s samples', name => {
  const { samples, fields, parameters } = all[name]!;

  it('authors six to eight records, each named, summarised and distinguishable', () => {
    expect(samples.length).toBeGreaterThanOrEqual(6);
    expect(samples.length).toBeLessThanOrEqual(8);
    const title = recordNameField(name, fields)!;
    const summary = recordSummaryField(name, fields)!;
    expect(summary, 'a text.summary field for the list row').toBeDefined();
    expect(summary).not.toBe(title);
    for (const sample of samples) {
      expect(text(sample[title]), `${title} in ${JSON.stringify(sample).slice(0, 80)}`).toBe(true);
      expect(text(sample[summary]), `${summary} of ${String(sample[title])}`).toBe(true);
    }
    expect(new Set(samples.map(sample => `${String(sample[title])} / ${String(sample[summary])}`)).size).toBe(samples.length);
  });

  it('gives every record a status its object allows', () => {
    if (!fields.status) return;
    for (const sample of samples) expect(fields.status.enum, `status of ${JSON.stringify(sample).slice(0, 60)}`).toContain(sample.status);
  });

  it('walks the lifecycle from its initial state through allowed transitions to the record\'s status', () => {
    const lifecycle = parameters('Stateful');
    if (!lifecycle) { expect(fields.state_history).toBeUndefined(); return; }
    const states = lifecycle.states as string[];
    const initial = lifecycle.initialState as string;
    const governed = name === 'Subscription' ? new Set(SUBSCRIPTION_TRANSITIONS.map(transition => `${transition.from}>${transition.to}`)) : undefined;
    for (const sample of samples) {
      const history = sample.state_history as Array<{ from: string | null; to: string; at: string; reason: string }>;
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.length).toBeLessThanOrEqual(4);
      // A record is created in the initial state: either an explicit creation entry, or its first transition leaves it.
      expect(history[0]!.from === null ? history[0]!.to : history[0]!.from).toBe(initial);
      history.forEach((entry, index) => {
        expect(states).toContain(entry.to);
        expect(text(entry.reason), `reason for ${entry.to}`).toBe(true);
        if (index > 0) expect(entry.from, `${String(sample.status)} history continuity`).toBe(history[index - 1]!.to);
        if (entry.from === null) { expect(index).toBe(0); return; }
        expect(entry.to).not.toBe(entry.from);
        if (governed) expect(governed.has(`${entry.from}>${entry.to}`), `${entry.from} -> ${entry.to}`).toBe(true);
      });
      expect(history.at(-1)!.to).toBe(sample.status);
    }
  });

  it('runs its dates forward: created, then its history, then its last event and last change', () => {
    for (const sample of samples) {
      if (fields.created_at) {
        const created = at(sample.created_at);
        const updated = at(sample.updated_at);
        const last = at(sample.last_event_at);
        expect(created).toBeLessThanOrEqual(last);
        expect(last).toBeLessThanOrEqual(updated);
        const history = (sample.state_history as Array<{ at: string }> | undefined) ?? [];
        let previous = created;
        for (const entry of history) { expect(at(entry.at)).toBeGreaterThanOrEqual(previous); previous = at(entry.at); }
        expect(previous).toBeLessThanOrEqual(updated);
        expect(fields.last_event!.enum).toContain(sample.last_event);
      }
      if (fields.period_start) expect(at(sample.period_start)).toBeLessThanOrEqual(at(sample.period_end));
    }
  });

  it('prices every amount in a real currency, one its object supports', () => {
    const supported = parameters('Priceable')?.supportedCurrencies as string[] | undefined;
    const money = Object.entries(fields).filter(([, entry]) => entry.money?.currencyField);
    for (const sample of samples) for (const [field, entry] of money) {
      if (sample[field] === undefined) continue;
      expect(Number.isInteger(sample[field]), `${field} in minor units`).toBe(true);
      const currency = sample[entry.money!.currencyField!];
      expect(currency).toMatch(/^[A-Z]{3}$/);
      if (supported) expect(supported).toContain(currency);
    }
  });

  it('names every reference and owner it sets', () => {
    const labelled = Object.entries(fields).filter(([, entry]) => entry.displayLabelField);
    for (const sample of samples) {
      for (const [field, entry] of labelled) if (text(sample[field])) expect(text(sample[entry.displayLabelField!]), `${entry.displayLabelField} for ${field}`).toBe(true);
      if (fields.owner_id) {
        expect(text(sample.owner_id)).toBe(true);
        expect(fields.owner_id.displayLabelField, 'owner name field').toBeDefined();
      }
    }
  });

  it('gives a timeline real events for every record', () => {
    for (const sample of samples) {
      const events = recordCollectionEvents(sample);
      expect(events.length, `events of ${JSON.stringify(sample).slice(0, 60)}`).toBeGreaterThan(0);
      if (!fields.state_history && text(sample.created_at) && text(sample.last_event_at) && sample.last_event !== 'created') {
        expect(events.map(event => event.id)).toEqual(['record-created_at', 'record-last_event_at']);
      }
    }
  });
});

describe('the sample objects agree with each other', () => {
  const byName = (name: string) => all[name]!.samples;
  const organizations = new Map(byName('Organization').map(sample => [sample.label, sample]));
  const users = new Map(byName('User').map(sample => [sample.name, sample]));
  const subscriptions = new Map(byName('Subscription').map(sample => [sample.subscription_id, sample]));
  const plans = new Set(byName('Plan').map(sample => sample.plan_code));

  it('bills sample organizations on sample plans', () => {
    for (const subscription of byName('Subscription')) {
      expect(organizations.has(subscription.customer_name)).toBe(true);
      expect(plans.has(subscription.plan_code), String(subscription.plan_code)).toBe(true);
    }
    for (const invoice of byName('Invoice')) {
      const subscription = subscriptions.get(invoice.subscription_id)!;
      expect(subscription, String(invoice.subscription_id)).toBeDefined();
      expect(invoice.billing_contact_name).toBe(subscription.customer_name);
      expect(invoice.currency).toBe(subscription.currency);
    }
    for (const usage of byName('Usage')) {
      const subscription = subscriptions.get(usage.subscription_id)!;
      expect(subscription, String(usage.subscription_id)).toBeDefined();
      expect(usage.customer_name).toBe(subscription.customer_name);
    }
  });

  it('points each reference at the record its name names', () => {
    for (const transaction of byName('Transaction')) {
      expect(organizations.get(transaction.organization_name)?.organization_id).toBe(transaction.organization_id);
      if (users.has(transaction.user_name)) expect(users.get(transaction.user_name)!.user_id).toBe(transaction.user_id);
    }
    for (const relationship of byName('Relationship')) for (const end of ['source', 'target']) {
      const named = relationship[`${end}_name`];
      const id = relationship[`${end}_id`];
      if (organizations.has(named)) expect(organizations.get(named)!.organization_id, String(named)).toBe(id);
      if (users.has(named)) expect(users.get(named)!.user_id, String(named)).toBe(id);
    }
    const media = new Set(byName('Media').map(sample => sample.media_id));
    for (const article of byName('Article')) if (article.hero_media_id != null) expect(media.has(article.hero_media_id)).toBe(true);
  });
});

describe('sample records that add up', () => {
  it('varies the subscription payments: an upgrade, a prorated charge and a refund', () => {
    const subscriptions = all.Subscription!.samples;
    const history = (sample: Sample) => (sample.payment_history as Array<{ at: string; amount: number }>);
    const upgraded = subscriptions.find(sample => history(sample).length > 1 && history(sample)[0]!.amount < (sample.amount as number) && history(sample).at(-1)!.amount === sample.amount);
    expect(upgraded, 'a subscription whose price rose').toBeDefined();
    expect(history(upgraded!).some(payment => payment.amount === upgraded!.proration_amount && (upgraded!.proration_amount as number) > 0)).toBe(true);
    expect(subscriptions.some(sample => history(sample).some(payment => payment.amount < 0)), 'a refund').toBe(true);
    for (const sample of subscriptions) {
      const payments = history(sample);
      if (payments.length) expect(payments.at(-1)!.at, 'the last recorded payment').toBe(sample.last_payment_at);
      for (let index = 1; index < payments.length; index++) expect(at(payments[index]!.at)).toBeGreaterThan(at(payments[index - 1]!.at));
      expect(sample.cancel_at_period_end).toBe(['pending_cancellation', 'terminated'].includes(sample.status as string));
    }
  });

  it('totals each invoice from its lines, and leaves a balance only on an unpaid one', () => {
    for (const invoice of all.Invoice!.samples) {
      const lines = invoice.line_items as Array<{ quantity: number; unit_amount_minor: number; amount_minor: number }>;
      for (const line of lines) expect(line.amount_minor).toBe(line.quantity * line.unit_amount_minor);
      expect(lines.reduce((sum, line) => sum + line.amount_minor, 0)).toBe(invoice.subtotal_minor);
      expect(invoice.total_minor).toBe((invoice.subtotal_minor as number) - (invoice.discount_minor as number) + (invoice.tax_minor as number));
      expect(invoice.balance_minor).toBe(['paid', 'refunded', 'void'].includes(invoice.status as string) ? 0 : invoice.total_minor);
    }
  });

  it('sums each usage reading to its consumed quantity', () => {
    for (const usage of all.Usage!.samples) {
      expect((usage.samples as Array<{ value: number }>).reduce((sum, reading) => sum + reading.value, 0)).toBe(usage.consumed_quantity);
    }
  });

  it('keeps each relationship\'s direction and bidirectional flag in step', () => {
    for (const relationship of all.Relationship!.samples) expect(relationship.is_bidirectional).toBe(relationship.direction === 'bidirectional');
  });
});
