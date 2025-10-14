import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const CancellableTrait = {
  trait: {
    name: 'Cancellable',
    version: '1.0.0',
    description:
      'Adds lifecycle-aware cancellation workflows with policy guardrails and semantic token mappings.',
    category: 'lifecycle',
    tags: ['lifecycle', 'cancellation', 'retention', 'workflow'],
  },

  parameters: [
    {
      name: 'allowCancellationAfterStart',
      type: 'boolean',
      required: false,
      description:
        'Whether cancellation may occur after the entity transitions to an active state.',
      default: true,
    },
    {
      name: 'cancellationWindowHours',
      type: 'number',
      required: false,
      description: 'Number of hours after activation where cancellation is permitted.',
      validation: {
        minimum: 0,
        maximum: 720,
      },
    },
    {
      name: 'requireReason',
      type: 'boolean',
      required: false,
      description: 'Whether a structured cancellation reason must be supplied by the actor.',
      default: false,
    },
    {
      name: 'allowedReasons',
      type: 'string[]',
      required: false,
      description: 'Allow list of valid cancellation reason codes when requireReason is true.',
      validation: {
        minItems: 1,
        uniqueItems: true,
        items: {
          pattern: '^[a-z0-9_\\-]+$',
          minLength: 1,
          maxLength: 64,
        },
      },
    },
  ] as const,

  schema: {
    cancel_at_period_end: {
      type: 'boolean',
      required: true,
      description:
        'Indicates whether cancellation occurs at the natural period end instead of immediately.',
      default: false,
    },
    cancellation_reason: {
      type: 'string',
      required: false,
      description: 'Free-form detail describing why cancellation occurred.',
      validation: {
        maxLength: 160,
      },
    },
    cancellation_reason_code: {
      type: 'string',
      required: false,
      description: 'Structured reason code chosen from the allowedReasons parameter.',
      validation: {
        enumFromParameter: 'allowedReasons',
      },
    },
    cancellation_requested_at: {
      type: 'datetime',
      required: false,
      description: 'Timestamp capturing when the cancellation workflow was initiated.',
    },
  },

  semantics: {
    cancel_at_period_end: {
      semantic_type: 'status.cancel.deferred',
      token_mapping: 'tokenMap(status.cancel.*)',
      ui_hints: {
        component: 'CancellationToggle',
        emphasizeWhenTrue: true,
      },
    },
    cancellation_reason: {
      semantic_type: 'status.cancel.reason',
      token_mapping: 'tokenMap(status.cancel.reason)',
      ui_hints: {
        component: 'CancellationReason',
        multiline: true,
        maxLength: 160,
      },
    },
    cancellation_reason_code: {
      semantic_type: 'status.cancel.reason_code',
      token_mapping: 'tokenMap(status.cancel.code.*)',
      ui_hints: {
        component: 'ReasonPicker',
        parameterSource: 'allowedReasons',
      },
    },
    cancellation_requested_at: {
      semantic_type: 'status.cancel.timestamp',
      token_mapping: 'tokenMap(status.cancel.timestamp)',
      ui_hints: {
        component: 'TimelineTimestamp',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'CancellationSummary',
        position: 'top',
        props: {
          cancelAtPeriodEndField: 'cancel_at_period_end',
          reasonField: 'cancellation_reason',
          codeField: 'cancellation_reason_code',
          requestedAtField: 'cancellation_requested_at',
        },
      },
    ],
    timeline: [
      {
        component: 'CancellationEvent',
        props: {
          timestampField: 'cancellation_requested_at',
          labelField: 'cancellation_reason',
          codeField: 'cancellation_reason_code',
        },
      },
    ],
    form: [
      {
        component: 'CancellationForm',
        position: 'top',
        props: {
          reasonField: 'cancellation_reason',
          codeField: 'cancellation_reason_code',
          requireReasonParameter: 'requireReason',
          allowedReasonsParameter: 'allowedReasons',
          windowParameter: 'cancellationWindowHours',
        },
      },
    ],
    card: [
      {
        component: 'CancellationBadge',
        position: 'before',
        props: {
          field: 'cancel_at_period_end',
        },
      },
    ],
  },

  tokens: {
    'status.cancel.primary.bg': 'var(--status-cancel-bg)',
    'status.cancel.primary.text': 'var(--status-cancel-text)',
    'status.cancel.reason.text': 'var(--text-default)',
    'status.cancel.timestamp.text': 'var(--text-subtle)',
  },

  dependencies: ['Stateful'] as const,

  metadata: {
    created: '2025-10-12',
    owners: ['lifecycle@oods.systems', 'support@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'Supports toggling of cancellation switches.',
      screenreader: 'Announces cancellation state and reason.',
    },
    regionsUsed: ['detail', 'timeline', 'forms', 'card'],
    examples: ['Subscription', 'Reservation'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default CancellableTrait;
