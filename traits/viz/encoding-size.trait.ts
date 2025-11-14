import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const EncodingSizeTrait = {
  trait: {
    name: 'EncodingSize',
    version: '0.1.0',
    description: 'Maps a quantitative field to glyph size with governed ranges.',
    category: 'viz.encoding',
    tags: ['viz', 'encoding', 'size'],
  },

  parameters: [
    {
      name: 'rangeMin',
      type: 'number',
      required: true,
      description: 'Minimum rendered size in device-independent pixels.',
      default: 6,
      validation: {
        minimum: 2,
        maximum: 32,
      },
    },
    {
      name: 'rangeMax',
      type: 'number',
      required: true,
      description: 'Maximum rendered size in device-independent pixels.',
      default: 36,
      validation: {
        minimum: 12,
        maximum: 96,
      },
    },
    {
      name: 'strategy',
      type: 'string',
      required: true,
      description: 'Interprets values as area or radius for perceptual scaling.',
      default: 'area',
      validation: {
        enum: ['area', 'radius'],
      },
    },
    {
      name: 'minPixelArea',
      type: 'number',
      required: false,
      description: 'Minimum accessible area to avoid disappearing glyphs.',
      default: 36,
    },
    {
      name: 'maxPixelArea',
      type: 'number',
      required: false,
      description: 'Maximum accessible area to avoid dominating layout.',
      default: 576,
    },
  ] as const,

  schema: {
    viz_encoding_size_field: {
      type: 'string',
      required: true,
      description: 'Data field bound to glyph size.',
    },
    viz_encoding_size_strategy: {
      type: 'string',
      required: true,
      description: 'Defines whether size is derived from area or radius.',
      default: 'area',
      validation: {
        enum: ['area', 'radius'],
      },
    },
    viz_encoding_size_range_min: {
      type: 'number',
      required: true,
      description: 'Minimum rendered size in pixels.',
      default: 6,
    },
    viz_encoding_size_range_max: {
      type: 'number',
      required: true,
      description: 'Maximum rendered size in pixels.',
      default: 36,
    },
    viz_encoding_size_min_area: {
      type: 'number',
      required: false,
      description: 'Minimum accessible area to prevent underflow.',
      default: 36,
    },
    viz_encoding_size_max_area: {
      type: 'number',
      required: false,
      description: 'Maximum accessible area to prevent overflow.',
      default: 576,
    },
    viz_encoding_size_description: {
      type: 'string',
      required: false,
      description: 'Narrative summary for fallback text/table output.',
      default: 'Size encodes magnitude using governed perceptual scaling.',
    },
  },

  semantics: {
    viz_encoding_size_field: {
      semantic_type: 'viz.encoding.field',
      token_mapping: 'tokenMap(viz.encoding.field)',
      ui_hints: {
        component: 'FieldReference',
      },
    },
    viz_encoding_size_strategy: {
      semantic_type: 'viz.encoding.size_strategy',
      token_mapping: 'tokenMap(viz.encoding.size_strategy)',
      ui_hints: {
        component: 'TextBadge',
      },
    },
    viz_encoding_size_range_min: {
      semantic_type: 'viz.encoding.size_range',
      token_mapping: 'tokenMap(viz.encoding.size_range)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'px',
      },
    },
    viz_encoding_size_range_max: {
      semantic_type: 'viz.encoding.size_range',
      token_mapping: 'tokenMap(viz.encoding.size_range)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'px',
      },
    },
    viz_encoding_size_min_area: {
      semantic_type: 'viz.encoding.a11y_min',
      token_mapping: 'tokenMap(viz.a11y.min_target)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'px^2',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'VizSizeSummary',
        position: 'sidebar',
        props: {
          field: 'viz_encoding_size_field',
          strategyField: 'viz_encoding_size_strategy',
          minField: 'viz_encoding_size_range_min',
          maxField: 'viz_encoding_size_range_max',
        },
      },
    ],
    form: [
      {
        component: 'VizSizeControls',
        position: 'top',
        props: {
          strategyField: 'viz_encoding_size_strategy',
          minField: 'viz_encoding_size_range_min',
          maxField: 'viz_encoding_size_range_max',
          minAreaField: 'viz_encoding_size_min_area',
          maxAreaField: 'viz_encoding_size_max_area',
        },
      },
    ],
    list: [
      {
        component: 'VizEncodingBadge',
        props: {
          axis: 'size',
          fieldField: 'viz_encoding_size_field',
        },
      },
    ],
  },

  tokens: {
    'viz.encoding.size.range.min': 'var(--cmp-viz-size-min)',
    'viz.encoding.size.range.max': 'var(--cmp-viz-size-max)',
    'viz.encoding.size.stroke': 'var(--cmp-viz-size-stroke)',
  },

  dependencies: ['ScaleLinear'] as const,

  metadata: {
    created: '2025-11-15',
    owners: ['viz@oods.systems', 'research@oods.systems'],
    maturity: 'alpha',
    accessibility: {
      rule_reference: 'A11Y-R-02',
      notes: 'Ensures glyphs remain perceivable within governed range.',
    },
    regionsUsed: ['detail', 'form', 'list'],
    references: [
      'cmos/research/data-viz-oods/RDS.7_synthesis_Mission Completion Report- Trait-Driven Visualization System Specification (v0.1).md',
    ],
  },
} as const satisfies TraitDefinition;

export default EncodingSizeTrait;
