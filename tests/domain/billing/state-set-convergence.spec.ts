/**
 * Single-source-of-truth guard for the subscription state set (s126-m01).
 *
 * `SUBSCRIPTION_STATES` in src/domain/billing/states.ts is the ONE authority for the
 * canonical Stripe-literal extend-8 subscription states. The Subscription object YAML
 * declares the same set in its `lifecycle/Stateful` parameters and pins it as a status
 * enum. This guard asserts both are byte-identical (same members, same order) to
 * `SUBSCRIPTION_STATES`, so the sources cannot silently re-diverge — the divergence
 * (states.ts/core 7-state `delinquent` vs saas-billing 10-state) s126 converged. The
 * saas-billing pack's own Subscription, never served, was removed in s220-m01 (audit F12).
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { SUBSCRIPTION_STATES } from '../../../src/domain/billing/states.js';

const CANONICAL = [...SUBSCRIPTION_STATES];

interface SubscriptionObjectYaml {
  traits?: Array<{
    name?: string;
    parameters?: { states?: string[] };
  }>;
  schema?: {
    status?: { validation?: { enum?: string[] } };
  };
}

function loadObject(relPath: string): SubscriptionObjectYaml {
  const abs = path.resolve(relPath);
  return yaml.load(readFileSync(abs, 'utf8')) as SubscriptionObjectYaml;
}

function statefulStates(obj: SubscriptionObjectYaml): string[] | undefined {
  const stateful = (obj.traits ?? []).find(
    (t) => t.name === 'lifecycle/Stateful'
  );
  return stateful?.parameters?.states;
}

const SOURCES: Array<[string, string]> = [
  ['core', 'objects/core/Subscription.object.yaml'],
];

describe('subscription state-set convergence guard', () => {
  it('canonical authority is the Stripe-literal extend-8 set', () => {
    expect(CANONICAL).toEqual([
      'future',
      'trialing',
      'active',
      'paused',
      'pending_cancellation',
      'past_due',
      'unpaid',
      'terminated',
    ]);
  });

  it.each(SOURCES)(
    '%s Subscription object Stateful.states is byte-identical to SUBSCRIPTION_STATES',
    (_label, relPath) => {
      const states = statefulStates(loadObject(relPath));
      expect(states).toBeDefined();
      expect(states).toEqual(CANONICAL);
    }
  );

  it('core Subscription object status enum is byte-identical to SUBSCRIPTION_STATES', () => {
    const core = loadObject('objects/core/Subscription.object.yaml');
    expect(core.schema?.status?.validation?.enum).toEqual(CANONICAL);
  });
});

/**
 * Account billing-status convergence guard (s127-m01).
 *
 * `Organization.billing_status` is a SEPARATE, deliberately COARSER account-health
 * vocabulary than the subscription lifecycle — a 4-state set, not the 8-state
 * `SUBSCRIPTION_STATES`. The s126 review caught that it still carried the retired
 * consolidated `delinquent` value after Subscription converged. This guard pins:
 *   (a) the Organization account vocabulary, order-exact, with no `delinquent`; and
 *   (b) the saas-billing token-map subscription domain == `SUBSCRIPTION_STATES`, so the
 *       presentation-token source cannot silently re-diverge from the canonical set or
 *       re-introduce an orphaned `delinquent` subscription token.
 */
const ACCOUNT_BILLING_STATES = [
  'good_standing',
  'past_due',
  'unpaid',
  'suspended',
] as const;

interface OrganizationObjectYaml {
  schema?: {
    billing_status?: { validation?: { enum?: string[] } };
  };
}

interface StatusTokenMap {
  domains?: Record<string, Record<string, unknown>>;
}

function loadJsonFile<T>(relPath: string): T {
  return JSON.parse(readFileSync(path.resolve(relPath), 'utf8')) as T;
}

describe('account billing-status convergence guard', () => {
  it('Organization.billing_status is the coarse 4-state account vocabulary, order-exact', () => {
    const org = yaml.load(
      readFileSync(path.resolve('objects/core/Organization.object.yaml'), 'utf8')
    ) as OrganizationObjectYaml;
    const enumValues = org.schema?.billing_status?.validation?.enum;
    expect(enumValues).toEqual([...ACCOUNT_BILLING_STATES]);
    // The retired consolidated `delinquent` account state must not reappear.
    expect(enumValues).not.toContain('delinquent');
  });

  it('the saas-billing token-map subscription domain == SUBSCRIPTION_STATES with no orphaned delinquent', () => {
    const tokenMap = loadJsonFile<StatusTokenMap>('packages/tokens/src/maps/saas-billing.status-map.json');
    const subscriptionStatuses = Object.keys(tokenMap.domains?.subscription ?? {});
    expect(subscriptionStatuses).toEqual(CANONICAL);
    expect(subscriptionStatuses).not.toContain('delinquent');
  });
});
