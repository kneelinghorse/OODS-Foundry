/**
 * Chargebee sample payloads used for billing translation demos.
 *
 * Captures representative subscription/invoice responses that flow
 * through the Chargebee adapter.
 */

export const chargebeeSamples = {
  subscription: {
    id: 'cb_sub_123',
    customer_id: 'cb_cus_456',
    status: 'active',
    plan_id: 'pro-plan',
    plan_name: 'Pro Plan',
    currency_code: 'USD',
    plan_unit_price: 9900,
    plan_quantity: 1,
    plan_free_quantity: 0,
    billing_period: 1,
    billing_period_unit: 'month',
    current_term_start: 1704067200,
    current_term_end: 1706745599,
    created_at: 1704067200,
    updated_at: 1704067200,
    auto_collection: 'on',
  },
  invoice: {
    id: 'cb_inv_123',
    subscription_id: 'cb_sub_456',
    status: 'posted',
    invoice_number: 'CB-001',
    currency_code: 'USD',
    date: 1704067200,
    due_date: 1706745599,
    total: 10900,
    amount_due: 10900,
    sub_total: 10000,
    tax: 900,
    line_items: [
      {
        id: 'li_cb_1',
        description: 'Pro Plan',
        quantity: 1,
        amount: 10000,
        unit_amount: 10000,
        entity_id: 'pro-plan',
      },
    ],
    invoice_url: 'https://chargebee.com/invoice/123',
    payment_method: 'card',
    updated_at: 1704067200,
  },
} as const;

export type ChargebeeSamples = typeof chargebeeSamples;

