/**
 * Subscription Example
 *
 * Demonstrates composing a Subscription object from multiple traits:
 * - Stateful (status lifecycle)
 * - Cancellable (cancellation logic)
 * - Billable (payment information)
 */

import { TraitCompositor } from '../../src/core/compositor.js';
import type { TraitDefinition } from '../../src/core/trait-definition.js';

// Define the Stateful trait
const StatefulTrait: TraitDefinition = {
  trait: {
    name: 'Stateful',
    version: '1.0.0',
    description: 'Provides a status field with state machine transitions',
    category: 'lifecycle',
  },
  parameters: [
    {
      name: 'states',
      type: 'enum',
      required: true,
      description: 'List of valid states for this object',
      enumValues: ['trialing', 'active', 'past_due', 'canceled'],
    },
  ],
  schema: {
    status: {
      type: 'string',
      required: true,
      description: 'Current status of the subscription',
      validation: {
        enum: ['trialing', 'active', 'past_due', 'canceled'],
      },
    },
  },
  semantics: {
    status: {
      semantic_type: 'status_enum',
      token_mapping: 'subscription-status-*',
      ui_hints: {
        component: 'Badge',
      },
    },
  },
  view_extensions: {
    list: [
      {
        component: 'StatusBadge',
        props: { field: 'status' },
        priority: 10,
      },
    ],
    detail: [
      {
        component: 'StatusTimeline',
        position: 'top',
        props: { field: 'status', showHistory: true },
        priority: 20,
      },
    ],
  },
  state_machine: {
    states: [
      'future',
      'trialing',
      'active',
      'paused',
      'pending_cancellation',
      'delinquent',
      'terminated',
    ],
    initial: 'future',
    transitions: [
      { from: 'future', to: 'trialing' },
      { from: 'future', to: 'active' },
      { from: 'trialing', to: 'active' },
      { from: 'active', to: 'paused' },
      { from: 'paused', to: 'active' },
      { from: 'active', to: 'pending_cancellation' },
      { from: 'active', to: 'delinquent' },
      { from: 'delinquent', to: 'active' },
      { from: 'pending_cancellation', to: 'terminated' },
      { from: 'delinquent', to: 'terminated' },
      { from: 'active', to: 'terminated' },
    ],
  },
  tokens: {
    'subscription-status-future': '#0ea5e9',
    'subscription-status-trialing': '#f97316',
    'subscription-status-active': '#22c55e',
    'subscription-status-paused': '#94a3b8',
    'subscription-status-pending-cancellation': '#0ea5e9',
    'subscription-status-delinquent': '#ef4444',
    'subscription-status-terminated': '#475569',
  },
};

// Define the Cancellable trait
const CancellableTrait: TraitDefinition = {
  trait: {
    name: 'Cancellable',
    version: '1.0.0',
    description: 'Adds cancellation logic and status mapping',
    category: 'lifecycle',
  },
  schema: {
    cancel_at_period_end: {
      type: 'boolean',
      required: true,
      default: false,
      description: 'Whether to cancel at the end of the current period',
    },
    canceled_at: {
      type: 'timestamp',
      required: false,
      description: 'Date the subscription was canceled',
    },
    cancellation_reason: {
      type: 'string',
      required: false,
      description: 'Reason for cancellation',
    },
  },
  semantics: {
    cancel_at_period_end: {
      token_mapping: 'status-warning-bg',
      ui_hints: {
        component: 'Toggle',
      },
    },
  },
  view_extensions: {
    detail: [
      {
        component: 'CancellationBanner',
        position: 'before',
        condition: 'cancel_at_period_end === true',
        priority: 40,
      },
    ],
  },
  actions: [
    {
      name: 'cancel',
      label: 'Cancel Subscription',
      confirmation: true,
      confirmationMessage: 'Are you sure you want to cancel this subscription?',
      icon: 'x-circle',
    },
    {
      name: 'reactivate',
      label: 'Reactivate',
      condition: 'status === "terminated"',
      icon: 'refresh',
    },
  ],
  dependencies: ['Stateful'],
};

// Define the Billable trait
const BillableTrait: TraitDefinition = {
  trait: {
    name: 'Billable',
    version: '1.0.0',
    description: 'Adds billing and payment tracking',
    category: 'financial',
  },
  schema: {
    amount: {
      type: 'number',
      required: true,
      description: 'Billing amount',
      validation: {
        min: 0,
      },
    },
    currency: {
      type: 'string',
      required: true,
      default: 'usd',
      description: 'Currency code',
      validation: {
        pattern: '^[a-z]{3}$',
      },
    },
    billing_cycle: {
      type: 'string',
      required: true,
      description: 'Billing cycle frequency',
      validation: {
        enum: ['monthly', 'yearly'],
      },
    },
    next_billing_date: {
      type: 'timestamp',
      required: false,
      description: 'Next billing date',
    },
  },
  semantics: {
    amount: {
      semantic_type: 'currency_amount',
      ui_hints: {
        component: 'CurrencyInput',
        formatAsCurrency: true,
      },
    },
  },
  view_extensions: {
    detail: [
      {
        component: 'BillingInfo',
        position: 'top',
        props: {
          showAmount: true,
          showNextBilling: true,
        },
        priority: 30,
      },
    ],
    list: [
      {
        component: 'PriceDisplay',
        props: {
          amountField: 'amount',
          currencyField: 'currency',
        },
        priority: 20,
      },
    ],
  },
  actions: [
    {
      name: 'updateBilling',
      label: 'Update Billing',
      icon: 'credit-card',
    },
  ],
};

// Compose the Subscription object
export function createSubscriptionExample() {
  console.log('='.repeat(80));
  console.log('SUBSCRIPTION COMPOSITION EXAMPLE');
  console.log('='.repeat(80));
  console.log('');

  const compositor = new TraitCompositor({
    trackProvenance: true,
    trackPerformance: true,
  });

  const result = compositor.compose(
    [StatefulTrait, CancellableTrait, BillableTrait],
    {
      id: 'subscription',
      name: 'Subscription',
      schema: {
        id: { type: 'uuid', required: true },
        customer_id: { type: 'uuid', required: true },
        plan_id: { type: 'string', required: true },
        quantity: { type: 'number', required: true, default: 1 },
        created_at: { type: 'timestamp', required: true },
        updated_at: { type: 'timestamp', required: true },
      },
    }
  );

  if (!result.success) {
    console.error('❌ Composition failed:', result.errors);
    return null;
  }

  console.log('✅ Composition successful!');
  console.log('');

  // Generate and display report
  const report = compositor.generateReport(result.data!);
  console.log(report);

  return result.data;
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  createSubscriptionExample();
}
