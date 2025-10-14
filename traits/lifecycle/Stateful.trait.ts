import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const STATEFUL_STATES = ['draft', 'active', 'paused', 'archived'] as const;

const StatefulTrait = {
  trait: {
    name: 'Stateful',
    version: '1.0.0',
    description: 'Normalizes lifecycle state transitions and exposes canonical status semantics.',
    category: 'lifecycle',
    tags: ['lifecycle', 'status', 'workflow', 'state'],
  },

  parameters: [
    {
      name: 'states',
      type: 'string[]',
      required: true,
      description: 'Ordered list of valid lifecycle states exposed to consumers.',
      default: STATEFUL_STATES,
    },
    {
      name: 'initialState',
      type: 'string',
      required: true,
      description: 'State assigned when an entity is created.',
      default: 'draft' as (typeof STATEFUL_STATES)[number],
      validation: {
        enumFromParameter: 'states',
      },
    },
  ] as const,

  schema: {
    status: {
      type: 'string',
      required: true,
      description: 'Canonical lifecycle state derived from the states parameter.',
      validation: {
        enumFromParameter: 'states',
      },
    },
    state_history: {
      type: 'StateTransition[]',
      required: false,
      description: 'Chronological log of state transitions.',
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
        },
      },
    ],
    timeline: [
      {
        component: 'StateTransitionEvent',
        props: {
          historyField: 'state_history',
          labelField: 'status',
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
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-10-12',
    owners: ['design@oods.systems', 'engineering@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'n/a',
    },
    regionsUsed: ['badges', 'timeline', 'forms'],
    examples: ['Subscription', 'Project Workflow'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default StatefulTrait;
