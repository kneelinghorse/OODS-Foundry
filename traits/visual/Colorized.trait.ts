import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const COLORIZED_STATES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

const ColorizedTrait = {
  trait: {
    name: 'Colorized',
    version: '1.0.0',
    description: 'Maps lifecycle states to semantic color tokens for consistent status theming.',
    category: 'visual',
    tags: ['color', 'semantic', 'status', 'theming'],
  },

  parameters: [
    {
      name: 'colorStates',
      type: 'string[]',
      required: true,
      description: 'Semantic color keys applied to the status badge.',
      default: COLORIZED_STATES,
    },
  ] as const,

  schema: {
    color_state: {
      type: 'string',
      required: true,
      description: 'Semantic color token key derived from the provided color states.',
      validation: {
        enumFromParameter: 'colorStates',
      },
    },
  },

  semantics: {
    color_state: {
      semantic_type: 'status.visual',
      token_mapping: 'tokenMap(status.state.*)',
      ui_hints: {
        component: 'ColorTokenBadge',
        parameterSource: 'colorStates',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'ColorSwatch',
        props: {
          field: 'color_state',
          size: 'sm',
        },
      },
    ],
    detail: [
      {
        component: 'StatusColorLegend',
        position: 'top',
        props: {
          parameter: 'colorStates',
          badgeField: 'color_state',
        },
      },
    ],
    form: [
      {
        component: 'ColorStatePicker',
        position: 'top',
        props: {
          parameter: 'colorStates',
          field: 'color_state',
        },
      },
    ],
    card: [
      {
        component: 'ColorizedBadge',
        position: 'before',
        props: {
          field: 'color_state',
          tone: 'status',
        },
      },
    ],
  },

  tokens: {
    'status.state.badge.radius': 'var(--radius-md)',
    'status.state.badge.gap': 'var(--space-1)',
    'status.state.badge.icon.size': 'var(--size-2)',
  },

  dependencies: ['Stateful'] as const,

  metadata: {
    created: '2025-10-12',
    owners: ['design@oods.systems', 'engineering@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'n/a',
    },
    regionsUsed: ['badges', 'forms', 'detail'],
    examples: ['Incident', 'Release'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default ColorizedTrait;
