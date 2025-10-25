#!/usr/bin/env node
/**
 * Billing ACL Translation CLI
 *
 * Demonstrates provider payload translation through the Billing ACL adapters.
 * Usage: pnpm billing:translate [--provider <provider>] [--resource subscription] [--tenant tenant-1]
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ChargebeeAdapter,
  StripeAdapter,
  ZuoraAdapter,
} from '../integrations/billing/index.js';
import type {
  BillingAdapter,
  ProviderName,
} from '../integrations/billing/adapter.js';
import {
  chargebeeSamples,
  stripeSamples,
  zuoraSamples,
} from '../integrations/billing/samples/index.js';
import type { ProviderSampleSet } from '../integrations/billing/samples/index.js';
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

type ProviderAssets = {
  adapter: BillingAdapter;
  samples: ProviderSampleSet;
};

const providerCatalog: Map<ProviderName, ProviderAssets> = new Map();

const registerProvider = (adapter: BillingAdapter, samples: ProviderSampleSet) => {
  providerCatalog.set(adapter.providerName, { adapter, samples });
};

registerProvider(new StripeAdapter(), stripeSamples);
registerProvider(new ChargebeeAdapter(), chargebeeSamples);
registerProvider(new ZuoraAdapter(), zuoraSamples);

const providerChoices = Array.from(providerCatalog.keys());

if (providerChoices.length === 0) {
  throw new Error('No billing providers registered for translation CLI.');
}

function parseArgs(
  argv: string[],
  providers: ProviderName[]
): CliOptions {
  const args = argv.slice(2);
  const [defaultProvider] = providers;

  if (!defaultProvider) {
    throw new Error('No default provider available for translation CLI.');
  }

  const options: CliOptions = {
    provider: defaultProvider,
    resource: 'subscription',
  };

  for (const arg of args) {
    if (arg.startsWith('--provider=')) {
      const provider = arg.split('=')[1] as ProviderName;
      if (!providerCatalog.has(provider)) {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      options.provider = provider;
    } else if (arg.startsWith('--resource=')) {
      options.resource = arg.split('=')[1] as ResourceType;
    } else if (arg.startsWith('--tenant=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp(providers);
      process.exit(0);
    }
  }

  return options;
}

function printHelp(providers: ProviderName[]): void {
  const providerOptions = providers.join(' | ');
  const defaultProvider = providers[0];

  console.log(`
Billing ACL Translation CLI

Usage:
  pnpm billing:translate [--provider ${providerOptions}] [--resource subscription] [--tenant tenant-1] [--output ./canonical.json]

Options:
  --provider   ${providerOptions} (default: ${defaultProvider})
  --resource   subscription | invoice (default: subscription)
  --tenant     Optional tenant identifier to stamp on canonical payloads
  --output     Optional path to write canonical JSON (defaults to stdout)
  --help       Show this message
`);
}

const options = parseArgs(process.argv, providerChoices);

function translate(
  provider: ProviderName,
  resource: ResourceType,
  tenantId?: string
) {
  const entry = providerCatalog.get(provider);

  if (!entry) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const { adapter, samples } = entry;

  return resource === 'subscription'
    ? adapter.translateSubscription(samples.subscription, tenantId)
    : adapter.translateInvoice(samples.invoice, tenantId);
}

const canonical:
  | CanonicalSubscriptionWithProvider
  | CanonicalInvoiceWithProvider = translate(
    options.provider,
    options.resource,
    options.tenantId
  );

const output = JSON.stringify(canonical, null, 2);

if (options.output) {
  const outputPath = resolve(process.cwd(), options.output);
  writeFileSync(outputPath, output);
  console.log(`Canonical ${options.resource} written to ${outputPath}`);
} else {
  console.log(output);
}

