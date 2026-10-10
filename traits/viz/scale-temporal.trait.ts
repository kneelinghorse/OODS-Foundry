import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const ScaleTemporalTrait = {
  trait: {
    name: 'ScaleTemporal',
    version: '0.3.0',
    description: 'Temporal scale metadata with UTC rendering. Version 0.3.0 removes the unused timezone parameter (breaking).',
    category: 'viz.scale',
    tags: ['viz', 'scale', 'temporal'],
  },

  parameters: [
    {"name": "renderIntent", "type": "string", "required": false, "default": "{}", "description": "JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand."},

    {
      name: 'domainStart',
      type: 'string',
      required: true,
      description: 'ISO-8601 timestamp representing the lower bound.',
      default: '2024-01-01T00:00:00Z',
    },
    {
      name: 'domainEnd',
      type: 'string',
      required: true,
      description: 'ISO-8601 timestamp representing the upper bound.',
      default: '2024-12-31T23:59:59Z',
    },
    {
      name: 'rangeMin',
      type: 'number',
      required: true,
      description: 'Normalized lower range bound (0-1).',
      default: 0,
    },
    {
      name: 'rangeMax',
      type: 'number',
      required: true,
      description: 'Normalized upper range bound (0-1).',
      default: 1,
    },
    {
      name: 'nice',
      type: 'string',
      required: false,
      description: 'Interval used when rounding ticks.',
      default: 'month',
      validation: {
        enum: ['day', 'week', 'month', 'quarter', 'year'],
      },
    },
    {
      name: 'outputFormat',
      type: 'string',
      required: false,
      description: 'Default date format string for axes + fallbacks.',
      default: 'YYYY-MM-DD',
    },
  ] as const,

  schema: {
    viz_scale_temporal_domain_start: {
      type: 'string',
      required: true,
      description: 'ISO timestamp representing lower bound.',
      default: '2024-01-01T00:00:00Z',
    },
    viz_scale_temporal_domain_end: {
      type: 'string',
      required: true,
      description: 'ISO timestamp representing upper bound.',
      default: '2024-12-31T23:59:59Z',
    },
    viz_scale_temporal_range_min: {
      type: 'number',
      required: true,
      description: 'Normalized lower range bound.',
      default: 0,
    },
    viz_scale_temporal_range_max: {
      type: 'number',
      required: true,
      description: 'Normalized upper range bound.',
      default: 1,
    },
    viz_scale_temporal_nice: {
      type: 'string',
      required: false,
      description: 'Interval used when rounding ticks.',
      default: 'month',
      validation: {
        enum: ['day', 'week', 'month', 'quarter', 'year'],
      },
    },
    viz_scale_temporal_output_format: {
      type: 'string',
      required: false,
      description: 'Default format string for textual output.',
      default: 'YYYY-MM-DD',
    },
    viz_scale_temporal_description: {
      type: 'string',
      required: false,
      description: 'Narrative summary for fallback contexts.',
      default: 'Temporal scale rendered in UTC.',
    },
  },

  semantics: {
    viz_scale_temporal_domain_start: {
      semantic_type: 'viz.scale.domain',
      token_mapping: 'tokenMap(viz.scale.domain)',
      ui_hints: {
        component: 'TimestampPreview',
      },
    },
    viz_scale_temporal_domain_end: {
      semantic_type: 'viz.scale.domain',
      token_mapping: 'tokenMap(viz.scale.domain)',
      ui_hints: {
        component: 'TimestampPreview',
      },
    },
    viz_scale_temporal_nice: {
      semantic_type: 'viz.scale.nice',
      token_mapping: 'tokenMap(viz.scale.nice)',
      ui_hints: {
        component: 'TextBadge',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'VizScaleSummary',
        position: 'sidebar',
        props: {
          intentParameter: 'renderIntent',
          type: 'temporal',
          domainMinField: 'viz_scale_temporal_domain_start',
          domainMaxField: 'viz_scale_temporal_domain_end',
          niceField: 'viz_scale_temporal_nice',
        },
      },
    ],
    form: [
      {
        component: 'VizScaleControls',
        position: 'top',
        props: {
          intentParameter: 'renderIntent',
          type: 'temporal',
          domainMinField: 'viz_scale_temporal_domain_start',
          domainMaxField: 'viz_scale_temporal_domain_end',
          rangeMinField: 'viz_scale_temporal_range_min',
          rangeMaxField: 'viz_scale_temporal_range_max',
          niceField: 'viz_scale_temporal_nice',
          formatField: 'viz_scale_temporal_output_format',
        },
      },
    ],
  },

  tokens: {
    'viz.scale.temporal.grid': 'var(--cmp-viz-grid-line)',
    'viz.scale.temporal.axis': 'var(--cmp-viz-axis-line)',
    'viz.scale.temporal.tick': 'var(--cmp-viz-axis-tick)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-15',
    owners: ['Viz team'],
    maturity: 'alpha',
    regionsUsed: ['detail', 'form'],
    allows: ['EncodingPositionX', 'EncodingPositionY'],
    references: [
      'RDS.7 Trait-Driven Visualization System Specification (v0.1)',
    ],
  },
} as const satisfies TraitDefinition;

export default ScaleTemporalTrait;
