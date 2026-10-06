import path from 'node:path';

import type { BaseObjectDefinition } from '../../../src/core/compositor.js';

export interface TraitParameterSet {
  trait: string;
  values: Record<string, unknown>;
}

export interface TraitStackFixture {
  id: string;
  title: string;
  description: string;
  traitPaths: string[];
  base: BaseObjectDefinition;
  parameters: TraitParameterSet[];
}

export const TRAITS_DIR = path.resolve('traits');

function traitPath(relative: string): string {
  return path.join(TRAITS_DIR, relative);
}

const FOUNDATION_TOKENS: Record<string, string> = {
  'identity.id.primary': 'var(--identity-id-primary)',
  'identity.email.primary': 'var(--identity-email-primary)',
  'text.body.primary': 'var(--text-body-primary)',
  'timeline.status.default': 'var(--timeline-status-default)',
  'taxonomy.tag.count': 'var(--taxonomy-tag-count)',
  'status.archive.timestamp': 'var(--status-archive-timestamp)',
  'status.archive.restore': 'var(--status-archive-restore)',
  'status.archive.reason': 'var(--status-archive-reason)',
  'status.archive.actor': 'var(--status-archive-actor)',
  'status.cancel.reason': 'var(--status-cancel-reason)',
  'status.cancel.code.primary': 'var(--status-cancel-code)',
  'status.cancel.timestamp': 'var(--status-cancel-timestamp)',
  'product.sku.primary': 'var(--product-sku-primary)',
  'commerce.price.primary': 'var(--commerce-price-primary)',
  'commerce.amount.primary': 'var(--commerce-amount-primary)',
  'commerce.currency.primary': 'var(--commerce-currency-primary)',
  'organization.id.primary': 'var(--organization-id-primary)',
  'organization.domain.primary': 'var(--organization-domain-primary)',
  'graph.relationship.type': 'var(--graph-relationship-type)',
};

function withFoundationTokens(
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    ...FOUNDATION_TOKENS,
    ...extra,
  };
}

const SHARED_PARAMETERS: Record<string, TraitParameterSet> = {
  Stateful: {
    trait: 'Stateful',
    values: {
      states: ['draft', 'active', 'paused', 'archived'],
      initialState: 'draft',
    },
  },
  Colorized: {
    trait: 'Colorized',
    values: {
      colorStates: ['neutral', 'info', 'success', 'warning', 'critical'],
    },
  },
  Taggable: {
    trait: 'Taggable',
    values: {
      maxTags: 16,
      allowCustomTags: false,
      allowedTags: ['customer', 'partner', 'internal'],
      caseSensitive: false,
    },
  },
  Archivable: {
    trait: 'Archivable',
    values: {
      gracePeriodDays: 30,
      retainHistory: true,
      restoreWindowDays: 90,
    },
  },
  Cancellable: {
    trait: 'Cancellable',
    values: {
      allowCancellationAfterStart: true,
      cancellationWindowHours: 72,
      requireReason: true,
      allowedReasons: ['customer_request', 'fraud_signal', 'duplicate'],
    },
  },
};

export const UNIVERSAL_QUINTET_STACKS: TraitStackFixture[] = [
  {
    id: 'user',
    title: 'Universal Quintet — User',
    description:
      'Customer-facing user profile with lifecycle + archival semantics.',
    traitPaths: [
      traitPath('content/Labelled.trait.yaml'),
      traitPath('behavioral/Taggable.trait.yaml'),
      traitPath('lifecycle/Stateful.trait.yaml'),
      traitPath('visual/Colorized.trait.yaml'),
      traitPath('lifecycle/Archivable.trait.yaml'),
    ],
    base: {
      id: 'user',
      name: 'User',
      schema: {
        id: { type: 'uuid', required: true },
        email: { type: 'email', required: true },
        created_at: { type: 'datetime', required: true },
      },
      semantics: {
        id: {
          semantic_type: 'identity.id',
          token_mapping: 'tokenMap(identity.id.primary)',
        },
        email: {
          semantic_type: 'identity.email',
          token_mapping: 'tokenMap(identity.email.primary)',
        },
      },
      tokens: withFoundationTokens({
        'identity.id.primary': 'var(--text-strong)',
        'identity.email.primary': 'var(--text-strong)',
      }),
    },
    parameters: [
      SHARED_PARAMETERS.Stateful,
      SHARED_PARAMETERS.Colorized,
      SHARED_PARAMETERS.Taggable,
      SHARED_PARAMETERS.Archivable,
    ],
  },
  {
    id: 'organization',
    title: 'Universal Quintet — Organization',
    description: 'Multi-tenant account with tagging and lifecycle controls.',
    traitPaths: [
      traitPath('content/Labelled.trait.yaml'),
      traitPath('behavioral/Taggable.trait.yaml'),
      traitPath('lifecycle/Stateful.trait.yaml'),
      traitPath('visual/Colorized.trait.yaml'),
    ],
    base: {
      id: 'organization',
      name: 'Organization',
      schema: {
        id: { type: 'uuid', required: true },
        name: { type: 'string', required: true },
        domain: { type: 'string', required: true },
      },
      semantics: {
        id: {
          semantic_type: 'organization.id',
          token_mapping: 'tokenMap(organization.id.primary)',
        },
        domain: {
          semantic_type: 'organization.domain',
          token_mapping: 'tokenMap(organization.domain.primary)',
        },
      },
      tokens: withFoundationTokens({
        'organization.id.primary': 'var(--text-strong)',
        'organization.domain.primary': 'var(--text-strong)',
      }),
    },
    parameters: [
      SHARED_PARAMETERS.Stateful,
      SHARED_PARAMETERS.Colorized,
      SHARED_PARAMETERS.Taggable,
    ],
  },
  {
    id: 'product',
    title: 'Universal Quintet — Product',
    description:
      'Catalog item with cancellation guardrails and semantic labeling.',
    traitPaths: [
      traitPath('content/Labelled.trait.yaml'),
      traitPath('lifecycle/Stateful.trait.yaml'),
      traitPath('lifecycle/Cancellable.trait.yaml'),
      traitPath('visual/Colorized.trait.yaml'),
    ],
    base: {
      id: 'product',
      name: 'Product',
      schema: {
        id: { type: 'uuid', required: true },
        sku: { type: 'string', required: true },
        price_cents: { type: 'number', required: true },
      },
      semantics: {
        sku: {
          semantic_type: 'product.sku',
          token_mapping: 'tokenMap(product.sku.primary)',
        },
        price_cents: {
          semantic_type: 'commerce.price',
          token_mapping: 'tokenMap(commerce.price.primary)',
        },
      },
      tokens: withFoundationTokens({
        'product.sku.primary': 'var(--text-strong)',
        'commerce.price.primary': 'var(--commerce-price-primary)',
      }),
    },
    parameters: [
      SHARED_PARAMETERS.Stateful,
      SHARED_PARAMETERS.Colorized,
      SHARED_PARAMETERS.Cancellable,
    ],
  },
  {
    id: 'transaction',
    title: 'Universal Quintet — Transaction',
    description:
      'Transaction record emphasising lifecycle and cancellation auditing.',
    traitPaths: [
      traitPath('content/Labelled.trait.yaml'),
      traitPath('lifecycle/Stateful.trait.yaml'),
      traitPath('lifecycle/Cancellable.trait.yaml'),
      traitPath('lifecycle/Archivable.trait.yaml'),
    ],
    base: {
      id: 'transaction',
      name: 'Transaction',
      schema: {
        id: { type: 'uuid', required: true },
        amount_cents: { type: 'number', required: true },
        currency: { type: 'string', required: true },
      },
      semantics: {
        amount_cents: {
          semantic_type: 'commerce.amount',
          token_mapping: 'tokenMap(commerce.amount.primary)',
        },
        currency: {
          semantic_type: 'commerce.currency',
          token_mapping: 'tokenMap(commerce.currency.primary)',
        },
      },
      tokens: withFoundationTokens({
        'commerce.amount.primary': 'var(--commerce-amount-primary)',
        'commerce.currency.primary': 'var(--commerce-currency-primary)',
      }),
    },
    parameters: [
      SHARED_PARAMETERS.Stateful,
      SHARED_PARAMETERS.Cancellable,
      SHARED_PARAMETERS.Archivable,
    ],
  },
  {
    id: 'relationship',
    title: 'Universal Quintet — Relationship',
    description:
      'Relationship graph node with provenance tagging and lifecycle.',
    traitPaths: [
      traitPath('content/Labelled.trait.yaml'),
      traitPath('behavioral/Taggable.trait.yaml'),
      traitPath('lifecycle/Stateful.trait.yaml'),
    ],
    base: {
      id: 'relationship',
      name: 'Relationship',
      schema: {
        id: { type: 'uuid', required: true },
        source_id: { type: 'uuid', required: true },
        target_id: { type: 'uuid', required: true },
        relationship_type: { type: 'string', required: true },
      },
      semantics: {
        relationship_type: {
          semantic_type: 'graph.relationship.type',
          token_mapping: 'tokenMap(graph.relationship.type)',
        },
      },
      tokens: withFoundationTokens({
        'graph.relationship.type': 'var(--graph-relationship-type)',
      }),
    },
    parameters: [
      SHARED_PARAMETERS.Stateful,
      SHARED_PARAMETERS.Taggable,
    ],
  },
];
