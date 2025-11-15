import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const InteractionHighlightTrait: TraitDefinition = {
  trait: {
    name: 'InteractionHighlight',
    version: '0.1.0',
    description: 'Emphasizes hovered or selected points by adjusting a visual property.',
    category: 'viz.interaction',
    tags: ['viz', 'interaction', 'highlight'],
  },

  parameters: [
    {
      name: 'fields',
      type: 'string[]',
      required: true,
      description: 'Data fields that define the highlight predicate.',
    },
    {
      name: 'trigger',
      type: 'string',
      required: false,
      description: 'Event stream that activates the highlight.',
      default: 'hover',
      validation: {
        enum: ['hover', 'click', 'focus'],
      },
    },
    {
      name: 'property',
      type: 'string',
      required: false,
      description: 'Visual property to adjust when the predicate is active.',
      default: 'fillOpacity',
    },
    {
      name: 'activeValue',
      type: 'number',
      required: false,
      description: 'Value applied to highlighted marks.',
      default: 1,
      validation: {
        minimum: 0,
        maximum: 1,
      },
    },
    {
      name: 'inactiveValue',
      type: 'number',
      required: false,
      description: 'Value applied to non-highlighted marks.',
      default: 0.35,
      validation: {
        minimum: 0,
        maximum: 1,
      },
    },
  ] as const,

  schema: {
    viz_interaction_highlight_fields: {
      type: 'string[]',
      required: true,
      description: 'Fields copied into the interaction predicate.',
    },
    viz_interaction_highlight_trigger: {
      type: 'string',
      required: true,
      description: 'Event stream used for highlight activation.',
      defaultFromParameter: 'trigger',
      validation: {
        enum: ['hover', 'click', 'focus'],
      },
    },
    viz_interaction_highlight_property: {
      type: 'string',
      required: true,
      description: 'Visual property that is conditionally modified.',
      defaultFromParameter: 'property',
    },
    viz_interaction_highlight_active_value: {
      type: 'number',
      required: true,
      description: 'Value applied when the predicate matches.',
      defaultFromParameter: 'activeValue',
      validation: {
        minimum: 0,
        maximum: 1,
      },
    },
    viz_interaction_highlight_inactive_value: {
      type: 'number',
      required: true,
      description: 'Value applied when the predicate does not match.',
      defaultFromParameter: 'inactiveValue',
      validation: {
        minimum: 0,
        maximum: 1,
      },
    },
  },

  semantics: {
    viz_interaction_highlight_fields: {
      semantic_type: 'viz.interaction.fields',
      ui_hints: {
        component: 'ListSummary',
      },
    },
    viz_interaction_highlight_trigger: {
      semantic_type: 'viz.interaction.trigger',
      ui_hints: {
        component: 'Badge',
      },
    },
    viz_interaction_highlight_property: {
      semantic_type: 'viz.interaction.property',
      ui_hints: {
        component: 'Code',
      },
    },
    viz_interaction_highlight_active_value: {
      semantic_type: 'viz.interaction.value_active',
      ui_hints: {
        component: 'NumericPreview',
      },
    },
    viz_interaction_highlight_inactive_value: {
      semantic_type: 'viz.interaction.value_inactive',
      ui_hints: {
        component: 'NumericPreview',
      },
    },
  },

  state_machine: {
    states: ['idle', 'highlighted'],
    initial: 'idle',
    transitions: [
      { from: 'idle', to: 'highlighted', trigger: 'select' },
      { from: 'highlighted', to: 'idle', trigger: 'clear' },
    ],
  },
};

export default InteractionHighlightTrait;
