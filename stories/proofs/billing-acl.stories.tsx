/**
 * Billing ACL Proof Stories
 * 
 * Demonstrates provider adapters translating third-party payloads
 * into canonical domain types, proving the Anti-Corruption Layer works.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { StripeAdapter } from '../../src/integrations/billing/stripe-adapter.js';
import { ChargebeeAdapter } from '../../src/integrations/billing/chargebee-adapter.js';
import { ZuoraAdapter } from '../../src/integrations/billing/zuora-adapter.js';
import type { CanonicalSubscriptionWithProvider, CanonicalInvoiceWithProvider } from '../../src/domain/billing/core.js';
import { formatAmount } from '../../src/domain/billing/core.js';

/**
 * Component to display canonical billing objects
 */
interface BillingObjectViewerProps {
  title: string;
  subscription?: CanonicalSubscriptionWithProvider;
  invoice?: CanonicalInvoiceWithProvider;
}

function BillingObjectViewer({ title, subscription, invoice }: BillingObjectViewerProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      
      {subscription && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Canonical Subscription</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Subscription ID</div>
              <div className="text-base text-gray-900 dark:text-gray-100">{subscription.subscriptionId}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
              <div className="text-base">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscription.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : subscription.status === 'trialing'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : subscription.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : subscription.status === 'pending_cancellation'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : subscription.status === 'delinquent'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan</div>
              <div className="text-base text-gray-900 dark:text-gray-100">{subscription.plan.planName}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {formatAmount(subscription.plan.amountMinor, subscription.plan.currency)} / {subscription.plan.billingInterval}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Period</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {new Date(subscription.currentPeriod.start).toLocaleDateString()} - {new Date(subscription.currentPeriod.end).toLocaleDateString()}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</div>
              <div className="text-base">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {subscription.provider.provider}
                </span>
              </div>
            </div>
          </div>
          
          {subscription.statusNote && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status Note</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">{subscription.statusNote}</div>
            </div>
          )}
        </div>
      )}
      
      {invoice && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Canonical Invoice</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</div>
              <div className="text-base text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
              <div className="text-base">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  invoice.status === 'past_due' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  invoice.status === 'posted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {formatAmount(invoice.totalMinor, invoice.currency)}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance Due</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {formatAmount(invoice.balanceMinor, invoice.currency)}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Issued</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {new Date(invoice.issuedAt).toLocaleDateString()}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Due</div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {new Date(invoice.dueAt).toLocaleDateString()}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</div>
              <div className="text-base">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {invoice.provider.provider}
                </span>
              </div>
            </div>
          </div>
          
          {invoice.lineItems.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Line Items</div>
              <div className="space-y-2">
                {invoice.lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                    <span className="text-gray-900 dark:text-gray-100">{item.description}</span>
                    <span className="text-gray-600 dark:text-gray-300">{formatAmount(item.amountMinor, invoice.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const meta: Meta<typeof BillingObjectViewer> = {
  title: 'Explorer/Proofs/Billing ACL',
  component: BillingObjectViewer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Demonstrates the Billing Anti-Corruption Layer translating provider payloads into canonical domain types. Provider-specific details are isolated to adapter modules, preventing leakage into core code.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BillingObjectViewer>;

// Sample provider payloads
const stripeSubscriptionPayload = {
  id: 'sub_abc123',
  customer: 'cus_xyz789',
  status: 'active',
  currency: 'usd',
  current_period_start: Date.now() / 1000,
  current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
  created: Date.now() / 1000,
  items: [
    {
      price: {
        id: 'price_pro_2025',
        nickname: 'Pro Plan',
        unit_amount: 9900,
        currency: 'usd',
        recurring: { interval: 'month', interval_count: 1 },
      },
    },
  ],
  collection_method: 'charge_automatically',
  description: 'Healthy subscription with automatic payments',
};

const stripeInvoicePayload = {
  id: 'in_def456',
  subscription: 'sub_abc123',
  status: 'open',
  number: 'INV-2025-001',
  currency: 'usd',
  created: Date.now() / 1000,
  due_date: (Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000,
  total: 9900,
  amount_due: 9900,
  subtotal: 9000,
  tax: 900,
  lines: [
    { id: 'li_1', description: 'Pro Plan - Monthly', quantity: 1, amount: 9000, unit_amount: 9000 },
  ],
  hosted_invoice_url: 'https://invoice.stripe.com/i/acct_abc/test_xyz',
  payment_method_type: 'card',
};

export const StripeTranslation: Story = {
  render: () => {
    const adapter = new StripeAdapter();
    const subscription = adapter.translateSubscription(stripeSubscriptionPayload, 'tenant-demo');
    const invoice = adapter.translateInvoice(stripeInvoicePayload, 'tenant-demo');
    
    return <BillingObjectViewer title="Stripe → Canonical" subscription={subscription} invoice={invoice} />;
  },
};

export const ChargebeeTranslation: Story = {
  render: () => {
    const chargebeePayload = {
      id: 'cb_sub_456',
      customer_id: 'cb_cus_789',
      status: 'active',
      plan_id: 'plus-monthly',
      plan_name: 'Plus Plan',
      currency_code: 'USD',
      plan_unit_price: 4900,
      plan_quantity: 1,
      billing_period: 1,
      billing_period_unit: 'month',
      current_term_start: Date.now() / 1000,
      current_term_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
      auto_collection: 'on',
    };
    
    const adapter = new ChargebeeAdapter();
    const subscription = adapter.translateSubscription(chargebeePayload, 'tenant-demo');
    
    return <BillingObjectViewer title="Chargebee → Canonical" subscription={subscription} />;
  },
};

export const ZuoraTranslation: Story = {
  render: () => {
    const zuoraPayload = {
      Id: 'zuora-sub-789',
      Status: 'Active',
      AccountId: 'zuora-acct-123',
      Name: 'Enterprise Subscription',
      TermStartDate: new Date().toISOString(),
      TermEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      CreatedDate: new Date().toISOString(),
      UpdatedDate: new Date().toISOString(),
      AutoRenew: 'true',
      RatePlans: [
        {
          ProductRatePlanId: 'rp-enterprise',
          ProductRatePlanName: 'Enterprise Plan',
          RatePlanCharges: [
            { Price: 299.00, Currency: 'USD', BillingPeriod: 'Annual' },
          ],
        },
      ],
    };
    
    const adapter = new ZuoraAdapter();
    const subscription = adapter.translateSubscription(zuoraPayload, 'tenant-demo');
    
    return <BillingObjectViewer title="Zuora → Canonical" subscription={subscription} />;
  },
};

export const AllProviders: Story = {
  render: () => {
    const stripeAdapter = new StripeAdapter();
    const chargebeeAdapter = new ChargebeeAdapter();
    const zuoraAdapter = new ZuoraAdapter();
    
    const stripeSubscription = stripeAdapter.translateSubscription(stripeSubscriptionPayload, 'tenant-demo');
    
    const chargebeePayload = {
      id: 'cb_sub_456',
      customer_id: 'cb_cus_789',
      status: 'active',
      plan_id: 'plus-monthly',
      plan_name: 'Plus Plan',
      currency_code: 'USD',
      plan_unit_price: 4900,
      plan_quantity: 1,
      billing_period: 1,
      billing_period_unit: 'month',
      current_term_start: Date.now() / 1000,
      current_term_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    };
    const chargebeeSubscription = chargebeeAdapter.translateSubscription(chargebeePayload, 'tenant-demo');
    
    const zuoraPayload = {
      Id: 'zuora-sub-789',
      Status: 'Active',
      AccountId: 'zuora-acct-123',
      TermStartDate: new Date().toISOString(),
      TermEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      RatePlans: [
        {
          ProductRatePlanId: 'rp-enterprise',
          ProductRatePlanName: 'Enterprise Plan',
          RatePlanCharges: [{ Price: 299.00, Currency: 'USD', BillingPeriod: 'Annual' }],
        },
      ],
    };
    const zuoraSubscription = zuoraAdapter.translateSubscription(zuoraPayload, 'tenant-demo');
    
    return (
      <div className="space-y-8 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Billing ACL Proof</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Three different providers, one canonical data model
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <BillingObjectViewer title="Stripe → Canonical" subscription={stripeSubscription} />
          <BillingObjectViewer title="Chargebee → Canonical" subscription={chargebeeSubscription} />
          <BillingObjectViewer title="Zuora → Canonical" subscription={zuoraSubscription} />
        </div>
      </div>
    );
  },
};
