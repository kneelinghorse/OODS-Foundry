import { describe, expect, it } from 'vitest';
import { billingCycle, billingPeriodEnd, restartedBillingPeriod } from '../src/billing-views.js';
import { recordCollectionEvents } from '../src/date-time.js';

// s220-m01 (#2461, #2458): the Sprint 219 review saw an edited Subscription contradict itself. After an edit to
// "€19.99 · yearly" the billing cycle still read "77% complete · 7 days remaining" (a monthly period), the next payment
// was a month away, and the timeline's last payment read "€19.99 · yearly" beside a chart of the €149.00 actually paid.

describe('a billing period is one declared interval long', () => {
  it('keeps the start day, or the last day of a shorter month', () => {
    expect(billingPeriodEnd('2026-09-28T15:10:00.000Z', 'yearly')).toBe('2027-09-28T15:10:00.000Z');
    expect(billingPeriodEnd('2026-09-03T08:00:00Z', 'monthly')).toBe('2026-10-03T08:00:00.000Z');
    expect(billingPeriodEnd('2026-01-31T00:00:00Z', 'monthly')).toBe('2026-02-28T00:00:00.000Z');
    expect(billingPeriodEnd('2026-11-30T00:00:00Z', 'quarterly')).toBe('2027-02-28T00:00:00.000Z');
    expect(billingPeriodEnd('2026-09-28T00:00:00Z', 'weekly')).toBe('2026-10-05T00:00:00.000Z');
  });
  it('invents no end for an interval without a fixed length or an invalid start', () => {
    expect(billingPeriodEnd('2026-09-28T00:00:00Z', 'custom')).toBeUndefined();
    expect(billingPeriodEnd('2026-09-28T00:00:00Z', undefined)).toBeUndefined();
    expect(billingPeriodEnd('not a date', 'monthly')).toBeUndefined();
  });
});

describe('new billing terms start a new billing period (Billable anchor reset)', () => {
  const at = '2026-09-28T15:10:00.000Z';
  const restarted = restartedBillingPeriod(at, 'yearly');

  it('measures the new yearly period from the change, not the old monthly one', () => {
    expect(restarted).toMatchObject({ current_period_start: at, current_period_end: '2027-09-28T15:10:00.000Z', next_payment_due_at: at, payment_status: 'pending' });
    // The old stored 0.77 would have kept "77% complete · 7 days remaining"; the new period is measured by its clock.
    expect(restarted.current_period_progress).toBeUndefined();
    const cycle = billingCycle({ periodStart: restarted.current_period_start, periodEnd: restarted.current_period_end, progress: restarted.current_period_progress, now: at });
    expect(cycle.announcement).toBe('0% complete · 365 days remaining');
  });
});

describe('a recorded payment keeps its own amount', () => {
  const edited = {
    amount: 1999, currency: 'EUR', billing_interval: 'yearly',
    last_payment_at: '2026-09-03T08:00:00Z', next_payment_due_at: '2026-09-28T15:10:00.000Z',
    payment_history: [{ at: '2026-08-03T08:00:00Z', amount: 14900 }, { at: '2026-09-03T08:00:00Z', amount: 14900 }],
  };
  const payments = [{ field: 'last_payment_at', title: 'Last payment' }, { field: 'next_payment_due_at', title: 'Next payment' }];

  it('describes the last payment by what was paid and the next by the current terms', () => {
    const events = recordCollectionEvents(edited, { payments, minorUnits: 100 });
    expect(events.map(event => [event.title, event.description])).toEqual([
      ['Last payment', '€149.00'],
      ['Next payment', '€19.99 · yearly'],
    ]);
  });

  it('reads a payment in the currency it was recorded in', () => {
    const converted = { ...edited, currency: 'USD', payment_history: edited.payment_history.map(row => ({ ...row, currency: 'EUR' })) };
    expect(recordCollectionEvents(converted, { payments, minorUnits: 100 })[0]!.description).toBe('€149.00');
  });

  it('keeps the record terms for a payment with no recorded row', () => {
    const unrecorded = { amount: 4900, currency: 'usd', billing_interval: 'monthly', last_payment_at: '2026-09-01T12:00:00Z' };
    expect(recordCollectionEvents(unrecorded, { payments: [payments[0]!], minorUnits: 100 })[0]!.description).toBe('$49.00 · monthly');
  });
});
