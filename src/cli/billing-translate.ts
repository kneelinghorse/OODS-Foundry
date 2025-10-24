#!/usr/bin/env node
/**
 * Billing ACL Translation CLI
 *
 * Demonstrates provider payload translation through the Billing ACL adapters.
 * Usage: pnpm billing:translate [--provider stripe] [--resource subscription] [--tenant tenant-1]
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ChargebeeAdapter,
  StripeAdapter,
  ZuoraAdapter,
} from '../integrations/billing/index.js';
import type { ProviderName } from '../integrations/billing/adapter.js';
import type {
  CanonicalInvoiceWithProvider,
  CanonicalSubscriptionWithProvider,
} from '../domain/billing/core.js';

type ResourceType = 'subscription' | 'invoice';

interface CliOptions {
  provider: ProviderName;
  resource: ResourceType;
  tenantId?: string;
  output?: string;
}

const stripeSamples = {
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
};

const chargebeeSamples = {
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
};

const zuoraSamples = {
  subscription: {
    Id: 'zuora-sub-123',
    Status: 'Active',
    AccountId: 'zuora-acct-456',
    Name: 'Enterprise Subscription',
    TermStartDate: '2024-01-01',
    TermEndDate: '2024-12-31',
    CreatedDate: '2024-01-01T00:00:00Z',
    UpdatedDate: '2024-01-01T00:00:00Z',
    AutoRenew: 'true',
    RatePlans: [
      {
        ProductRatePlanId: 'rp-123',
        ProductRatePlanName: 'Enterprise Plan',
        RatePlanCharges: [
          {
            Id: 'rpc-456',
            Price: 299.0,
            Currency: 'USD',
            BillingPeriod: 'Annual',
          },
        ],
      },
    ],
  },
  invoice: {
    Id: 'zuora-inv-123',
    AccountId: 'zuora-acct-456',
    Status: 'Posted',
    InvoiceNumber: 'ZU-001',
    InvoiceDate: '2024-01-01',
    DueDate: '2024-01-31',
    Amount: 299.0,
    Balance: 299.0,
    Currency: 'USD',
    TaxAmount: 29.0,
    CreatedDate: '2024-01-01T00:00:00Z',
    UpdatedDate: '2024-01-01T00:00:00Z',
    InvoiceItems: [
      {
        Id: 'ii-789',
        ServiceStartDate: '2024-01-01',
        Quantity: 1,
        ChargeAmount: 270.0,
        UnitPrice: 270.0,
        ProductName: 'Enterprise Plan',
      },
    ],
    InvoiceURL: 'https://zuora.com/invoice/123',
  },
};

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  const options: CliOptions = {
    provider: 'stripe',
    resource: 'subscription',
  };

  for (const arg of args) {
    if (arg.startsWith('--provider=')) {
      options.provider = arg.split('=')[1] as ProviderName;
    } else if (arg.startsWith('--resource=')) {
      options.resource = arg.split('=')[1] as ResourceType;
    } else if (arg.startsWith('--tenant=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Billing ACL Translation CLI

Usage:
  pnpm billing:translate [--provider stripe] [--resource subscription] [--tenant tenant-1] [--output ./canonical.json]

Options:
  --provider   stripe | chargebee | zuora (default: stripe)
  --resource   subscription | invoice (default: subscription)
  --tenant     Optional tenant identifier to stamp on canonical payloads
  --output     Optional path to write canonical JSON (defaults to stdout)
  --help       Show this message
`);
}

const options = parseArgs(process.argv);

function translate(provider: ProviderName, resource: ResourceType) {
  switch (provider) {
    case 'stripe': {
      const adapter = new StripeAdapter();
      return resource === 'subscription'
        ? adapter.translateSubscription(stripeSamples.subscription, options.tenantId)
        : adapter.translateInvoice(stripeSamples.invoice, options.tenantId);
    }
    case 'chargebee': {
      const adapter = new ChargebeeAdapter();
      return resource === 'subscription'
        ? adapter.translateSubscription(chargebeeSamples.subscription, options.tenantId)
        : adapter.translateInvoice(chargebeeSamples.invoice, options.tenantId);
    }
    case 'zuora': {
      const adapter = new ZuoraAdapter();
      return resource === 'subscription'
        ? adapter.translateSubscription(zuoraSamples.subscription, options.tenantId)
        : adapter.translateInvoice(zuoraSamples.invoice, options.tenantId);
    }
    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck as string}`);
    }
  }
}

let canonical:
  | CanonicalSubscriptionWithProvider
  | CanonicalInvoiceWithProvider;

canonical = translate(options.provider, options.resource);

const output = JSON.stringify(canonical, null, 2);

if (options.output) {
  const outputPath = resolve(process.cwd(), options.output);
  writeFileSync(outputPath, output);
  console.log(`Canonical ${options.resource} written to ${outputPath}`);
} else {
  console.log(output);
}
