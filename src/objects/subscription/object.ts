import type { ObjectSpec } from '../../types/render-context.js';
import { createSubscriptionStatefulTraitAdapter } from '../../traits/Stateful/view.js';
import { createCancellableTraitAdapter } from '../../traits/Cancellable/view.js';
import { createSubscriptionTimestampableTraitAdapter } from '../../traits/Timestampable/view.js';
import { createBillableTraitAdapter } from '../../traits/Billable/view.js';
import { createTaggableTraitAdapter } from '../../traits/Taggable/view.js';
import type { SubscriptionRecord } from './types.js';

export interface CreateSubscriptionObjectOptions {
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
  readonly includeCancellable?: boolean;
  readonly includeBillable?: boolean;
  readonly includeTimestampable?: boolean;
  readonly includeTaggable?: boolean;
}

export type SubscriptionObjectSpec = ObjectSpec<SubscriptionRecord>;

export function createSubscriptionObjectSpec(
  options: CreateSubscriptionObjectOptions = {}
): SubscriptionObjectSpec {
  const {
    id = 'object:Subscription',
    name = 'Subscription',
    version = '1.0.0',
    includeCancellable = true,
    includeBillable = true,
    includeTimestampable = true,
    includeTaggable = true,
  } = options;

  const traits = [
    createSubscriptionStatefulTraitAdapter<SubscriptionRecord>(),
  ];

  if (includeTaggable) {
    traits.push(createTaggableTraitAdapter<SubscriptionRecord>());
  }

  if (includeCancellable) {
    traits.push(createCancellableTraitAdapter<SubscriptionRecord>());
  }

  if (includeBillable) {
    traits.push(createBillableTraitAdapter<SubscriptionRecord>());
  }

  if (includeTimestampable) {
    traits.push(createSubscriptionTimestampableTraitAdapter<SubscriptionRecord>());
  }

  return {
    id,
    name,
    version,
    traits,
    metadata: {
      category: 'billing',
      status: 'beta',
    },
  };
}

export const SubscriptionObject = Object.freeze(createSubscriptionObjectSpec());
