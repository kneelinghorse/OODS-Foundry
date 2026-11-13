import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const STATEFUL_STATES = ['draft', 'active', 'paused', 'archived'] as const;

export type StatefulState = (typeof STATEFUL_STATES)[number];

export type TransitionRules = Record<string, string[]>;

const StatefulTrait = {
  trait: {
    name: 'Stateful',
    version: '2.3.0',
    description:
      'Normalizes lifecycle state transitions, exposes canonical status semantics, and provides ' +
      'optional transition governance for production workflows. Most-composed trait (18 objects).',
    category: 'lifecycle',
    tags: ['lifecycle', 'status', 'workflow', 'state', 'governance', 'audit'],
  },

  parameters: [
    {
      name: 'states',
      type: 'string[]',
      required: true,
      description: 'Ordered list of valid lifecycle states. Order represents typical forward progression.',
      default: STATEFUL_STATES,
    },
    {
      name: 'initialState',
      type: 'string',
      required: true,
      description: 'State assigned when an entity is created. Must be a member of the states parameter.',
      default: 'draft' as StatefulState,
      validation: {
        enumFromParameter: 'states',
      },
    },
    {
      name: 'transitionRules',
      type: 'string',
      required: false,
      description:
        'JSON-encoded allowed state transition map (Record<string, string[]>). Keys are source states; ' +
        'values are arrays of permitted targets, and an empty array marks a final state. An order that names a state ' +
        'the lifecycle lacks is refused. The product enforces the order. When null, all transitions are allowed (open model).',
      default: null,
    },
    {
      name: 'requireTransitionReason',
      type: 'boolean' as const,
      required: false,
      description:
        'When true, every state transition must include a reason. Enforced at the application layer.',
      default: false,
    },
  ] as const,

  schema: {
    status: {
      type: 'string',
      required: true,
      description:
        'Canonical lifecycle state. Consumed by Colorized for visual tokens and by view extensions for rendering.',
      validation: {
        enumFromParameter: 'states',
      },
    },
    state_history: {
      type: 'StateTransition[]',
      required: false,
      description:
        'Chronological log of state transitions with from, to, timestamp, actor_id, reason, and transition_metadata.',
      default: [],
    },
    allowed_transitions: {
      type: 'string[]',
      required: false,
      description:
        'Materialized next states the product allows from the current status, written by the product from transitionRules. ' +
        'Listed by StatusTimeline; a generated StatusSelector offers every state.',
      default: [],
    },
  },

  semantics: {
    status: {
      semantic_type: 'status.state',
      token_mapping: 'tokenMap(status.state.*)',
      ui_hints: {
        component: 'StatusBadge',
        showIcon: true,
      },
    },
    state_history: {
      semantic_type: 'timeline.state_transition',
      token_mapping: 'tokenMap(timeline.status.*)',
      ui_hints: {
        component: 'StatusTimeline',
        collapseWhenEmpty: true,
      },
    },
    allowed_transitions: {
      semantic_type: 'status.navigation',
      token_mapping: 'computed',
      ui_hints: {
        component: 'StatusSelector',
        description: 'The next states the product allows, as the product writes them; listed on the detail page, never used to disable an option.',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'StatusBadge',
        props: {
          field: 'status',
          tone: 'lifecycle',
        },
      },
    ],
    detail: [
      {
        component: 'StatusTimeline',
        position: 'top',
        priority: 40,
        props: {
          field: 'status',
          historyField: 'state_history',
          statesParameter: 'states',
          showActorId: true,
          showReason: true,
        },
      },
    ],
    form: [
      {
        component: 'StatusSelector',
        position: 'top',
        props: {
          field: 'status',
          optionsParameter: 'states',
          initialParameter: 'initialState',
          allowedTransitionsField: 'allowed_transitions',
          requireReasonParameter: 'requireTransitionReason',
        },
      },
    ],
    card: [
      {
        component: 'StatusBadge',
        position: 'before',
        props: {
          field: 'status',
          variant: 'subtle',
        },
      },
    ],
  },

  tokens: {
    'status.state.default.bg': 'var(--status-neutral-bg)',
    'status.state.default.text': 'var(--status-neutral-text)',
    'status.timeline.connector': 'var(--border-subtle)',
    'status.timeline.node.bg': 'var(--sys-surface-raised)',
    'status.timeline.node.border': 'var(--sys-border-default)',
    'status.timeline.actor.text': 'var(--sys-text-secondary)',
    'status.timeline.reason.text': 'var(--sys-text-tertiary)',
    'status.timeline.reason.bg': 'var(--sys-surface-neutral)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-10-12',
    updated: '2026-11-13',
    owners: ['Design team', 'Engineering team'],
    maturity: 'stable',
    accessibility: {
      keyboard:
        'StatusSelector is a labelled native select: arrow keys move through the states. It offers every state and disables none.',
      screenreader:
        'StatusBadge announces the current state ("Status: Active"). ' +
        'StateTransitionEvent entries announce from-state, to-state, actor, and reason.',
    },
    regionsUsed: ['list', 'detail', 'form', 'card'],
    examples: ['Subscription', 'Project Workflow', 'Order', 'User', 'Invoice'],
    references: [
      'Trait Engine Spec v0.1 section 2',
      'src/components/statusables/statusRegistry.ts',
      'tokens/maps/saas-billing.status-map.json',
    ],
  },
} as const satisfies TraitDefinition;

export default StatefulTrait;
