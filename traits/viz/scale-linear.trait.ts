import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const ScaleLinearTrait = {
  trait: {
    name: 'ScaleLinear',
    version: '0.1.0',
    description: 'Shared linear/continuous scale definition.',
    category: 'viz.scale',
    tags: ['viz', 'scale', 'linear'],
  },

  parameters: [
    {
      name: 'domainMin',
      type: 'number',
      required: true,
      description: 'Default lower domain bound applied when unspecified.',
      default: 0,
    },
    {
      name: 'domainMax',
      type: 'number',
      required: true,
      description: 'Default upper domain bound applied when unspecified.',
      default: 1,
    },
    {
      name: 'rangeMin',
      type: 'number',
      required: true,
      description: 'Default lower range bound (normalized 0-1).',
      default: 0,
    },
    {
      name: 'rangeMax',
      type: 'number',
      required: true,
      description: 'Default upper range bound (normalized 0-1).',
      default: 1,
    },
    {
      name: 'clamp',
      type: 'boolean',
      required: false,
      description: 'Whether values outside the domain should clamp to edges.',
      default: true,
    },
    {
      name: 'zeroBaseline',
      type: 'boolean',
      required: false,
      description: 'Forces zero to be included in the domain.',
      default: true,
    },
    {
      name: 'mode',
      type: 'string',
      required: false,
      description: 'Whether this scale behaves as continuous or band.',
      default: 'continuous',
      validation: {
        enum: ['continuous', 'band'],
      },
    },
  ] as const,

  schema: {
    viz_scale_linear_domain_min: {
      type: 'number',
      required: true,
      description: 'Lower domain bound for continuous encodings.',
      default: 0,
    },
    viz_scale_linear_domain_max: {
      type: 'number',
      required: true,
      description: 'Upper domain bound for continuous encodings.',
      default: 1,
    },
    viz_scale_linear_range_min: {
      type: 'number',
      required: true,
      description: 'Lower range bound (normalized 0-1).',
      default: 0,
    },
    viz_scale_linear_range_max: {
      type: 'number',
      required: true,
      description: 'Upper range bound (normalized 0-1).',
      default: 1,
    },
    viz_scale_linear_clamp: {
      type: 'boolean',
      required: false,
      description: 'Indicates whether values outside the domain clamp to bounds.',
      default: true,
    },
    viz_scale_linear_zero_baseline: {
      type: 'boolean',
      required: false,
      description: 'Forces zero within the domain for accessibility compliance.',
      default: true,
    },
    viz_scale_linear_mode: {
      type: 'string',
      required: false,
      description: 'Distinguishes continuous vs band heuristics.',
      default: 'continuous',
      validation: {
        enum: ['continuous', 'band'],
      },
    },
    viz_scale_linear_description: {
      type: 'string',
      required: false,
      description: 'Narrative summary for fallbacks.',
      default: 'Linear scale with governed domain/range.',
    },
  },

  semantics: {
    viz_scale_linear_domain_min: {
      semantic_type: 'viz.scale.domain',
      token_mapping: 'tokenMap(viz.scale.domain)',
      ui_hints: {
        component: 'NumericPreview',
      },
    },
    viz_scale_linear_domain_max: {
      semantic_type: 'viz.scale.domain',
      token_mapping: 'tokenMap(viz.scale.domain)',
      ui_hints: {
        component: 'NumericPreview',
      },
    },
    viz_scale_linear_mode: {
      semantic_type: 'viz.scale.mode',
      token_mapping: 'tokenMap(viz.scale.mode)',
      ui_hints: {
        component: 'TextBadge',
      },
    },
    viz_scale_linear_zero_baseline: {
      semantic_type: 'viz.scale.zero',
      token_mapping: 'tokenMap(viz.scale.zero)',
      ui_hints: {
        component: 'BooleanBadge',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'VizScaleSummary',
        position: 'sidebar',
        props: {
          type: 'linear',
          domainMinField: 'viz_scale_linear_domain_min',
          domainMaxField: 'viz_scale_linear_domain_max',
          modeField: 'viz_scale_linear_mode',
          zeroField: 'viz_scale_linear_zero_baseline',
        },
      },
    ],
    form: [
      {
        component: 'VizScaleControls',
        position: 'top',
        props: {
          type: 'linear',
          domainMinField: 'viz_scale_linear_domain_min',
          domainMaxField: 'viz_scale_linear_domain_max',
          rangeMinField: 'viz_scale_linear_range_min',
          rangeMaxField: 'viz_scale_linear_range_max',
          zeroField: 'viz_scale_linear_zero_baseline',
          modeField: 'viz_scale_linear_mode',
        },
      },
    ],
  },

  tokens: {
    'viz.scale.linear.grid': 'var(--cmp-viz-grid-line)',
    'viz.scale.linear.axis': 'var(--cmp-viz-axis-line)',
    'viz.scale.linear.zero': 'var(--cmp-viz-zero-line)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-15',
    owners: ['viz@oods.systems', 'platform@oods.systems'],
    maturity: 'alpha',
    regionsUsed: ['detail', 'form'],
    allows: ['EncodingPositionX', 'EncodingPositionY', 'EncodingSize', 'EncodingColor'],
    references: [
      'cmos/research/data-viz-oods/RDS.7_synthesis_Mission Completion Report- Trait-Driven Visualization System Specification (v0.1).md',
    ],
  },
} as const satisfies TraitDefinition;

export default ScaleLinearTrait;
