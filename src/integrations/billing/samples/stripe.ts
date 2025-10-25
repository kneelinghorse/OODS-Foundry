/**
 * Stripe sample payloads used for billing translation demos.
 *
 * These fixtures mirror the raw webhook/event shapes emitted by Stripe.
 * Keeping them inside the integrations layer ensures provider literals
 * remain scoped to adapter boundaries.
 */

export const stripeSamples = {
  subscription: {
    id: 'sub_abc123',
    customer: 'cus_xyz789',
    status: 'active',
    currency: 'usd',
    current_period_start: 1704067200,
    current_period_end: 1735689599,
    created: 1704067200,
    items: [
      {
        price: {
          id: 'price_pro_2025',
          nickname: 'Pro Plan',
          unit_amount: 9900,
          currency: 'usd',
          interval: 'month',
          interval_count: 1,
          trial_period_days: 14,
        },
      },
    ],
    collection_method: 'charge_automatically',
  },
  invoice: {
    id: 'in_abc123',
    subscription: 'sub_xyz789',
    status: 'open',
    number: 'INV-001',
    currency: 'usd',
    created: 1704067200,
    due_date: 1704326400,
    total: 9900,
    amount_due: 9900,
    subtotal: 9000,
    tax: 900,
    lines: [
      {
        id: 'li_123',
        description: 'Pro Plan',
        quantity: 1,
        amount: 9000,
        unit_amount: 9000,
      },
    ],
    hosted_invoice_url: 'https://stripe.com/invoice/123',
    payment_method_type: 'card',
  },
} as const;

export type StripeSamples = typeof stripeSamples;

