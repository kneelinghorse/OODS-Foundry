import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const MarkBarTrait = {
  trait: {
    name: 'MarkBar',
    version: '0.1.0',
    description:
      'Canonical rectangular mark for magnitude comparisons with stacked/grouped support.',
    category: 'viz.mark',
    tags: ['viz', 'mark', 'bar', 'comparison'],
  },

  parameters: [
    {
      name: 'orientation',
      type: 'string',
      required: true,
      description: 'Axis orientation used for laying out bar rectangles.',
      default: 'vertical',
      validation: {
        enum: ['vertical', 'horizontal'],
      },
    },
    {
      name: 'bandPadding',
      type: 'number',
      required: false,
      description: 'Fractional padding between category bands (0-0.5).',
      default: 0.1,
      validation: {
        minimum: 0,
        maximum: 0.5,
      },
    },
    {
      name: 'cornerRadius',
      type: 'number',
      required: false,
      description: 'Pixel radius applied to bar corners.',
      default: 2,
      validation: {
        minimum: 0,
        maximum: 12,
      },
    },
    {
      name: 'stacking',
      type: 'string',
      required: false,
      description: 'Aggregation strategy when multiple series share the mark.',
      default: 'auto',
      validation: {
        enum: ['auto', 'normalize', 'none'],
      },
    },
  ] as const,

  schema: {
    viz_mark_type: {
      type: 'string',
      required: true,
      description: 'Normalized mark identifier consumed by renderer adapters.',
      default: 'bar',
      validation: {
        enum: ['bar'],
      },
    },
    viz_mark_orientation: {
      type: 'string',
      required: true,
      description: 'Orientation flag for aligning axes and fallbacks.',
      default: 'vertical',
      validation: {
        enum: ['vertical', 'horizontal'],
      },
    },
    viz_mark_band_padding: {
      type: 'number',
      required: false,
      description: 'Fractional padding between bars within a category.',
      default: 0.1,
      validation: {
        minimum: 0,
        maximum: 0.5,
      },
    },
    viz_mark_corner_radius: {
      type: 'number',
      required: false,
      description: 'Corner radius applied to rendered bars.',
      default: 2,
      validation: {
        minimum: 0,
        maximum: 12,
      },
    },
    viz_mark_stacking: {
      type: 'string',
      required: false,
      description: 'Stacking semantics applied to grouped series.',
      default: 'auto',
      validation: {
        enum: ['auto', 'normalize', 'none'],
      },
    },
    viz_mark_role: {
      type: 'string',
      required: true,
      description: 'Semantic role used by heuristics, docs, and filtering.',
      default: 'comparison',
    },
    viz_mark_a11y_label: {
      type: 'string',
      required: true,
      description: 'Accessible description fragment for assistive tech fallbacks.',
      default: 'Bar mark showing magnitude per category.',
    },
  },

  semantics: {
    viz_mark_type: {
      semantic_type: 'viz.mark.type',
      token_mapping: 'tokenMap(viz.mark.type)',
      ui_hints: {
        component: 'VizMarkSummary',
      },
    },
    viz_mark_orientation: {
      semantic_type: 'viz.mark.orientation',
      token_mapping: 'tokenMap(viz.mark.orientation)',
      ui_hints: {
        component: 'VizOrientationBadge',
      },
    },
    viz_mark_band_padding: {
      semantic_type: 'viz.mark.spacing',
      token_mapping: 'tokenMap(viz.mark.spacing)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'fraction',
      },
    },
    viz_mark_corner_radius: {
      semantic_type: 'viz.mark.corner_radius',
      token_mapping: 'tokenMap(viz.mark.corner_radius)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'px',
      },
    },
    viz_mark_stacking: {
      semantic_type: 'viz.mark.stacking',
      token_mapping: 'tokenMap(viz.mark.stacking)',
      ui_hints: {
        component: 'VizStackingHint',
      },
    },
    viz_mark_a11y_label: {
      semantic_type: 'a11y.description',
      token_mapping: 'tokenMap(a11y.chart.description)',
      ui_hints: {
        component: 'ScreenReaderHint',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'VizMarkPreview',
        position: 'top',
        priority: 60,
        props: {
          typeField: 'viz_mark_type',
          orientationField: 'viz_mark_orientation',
          stackingField: 'viz_mark_stacking',
        },
      },
    ],
    form: [
      {
        component: 'VizMarkControls',
        position: 'top',
        props: {
          orientationField: 'viz_mark_orientation',
          paddingField: 'viz_mark_band_padding',
          stackingField: 'viz_mark_stacking',
          cornerRadiusField: 'viz_mark_corner_radius',
        },
      },
    ],
    list: [
      {
        component: 'VizRoleBadge',
        props: {
          labelField: 'viz_mark_role',
        },
      },
    ],
  },

  tokens: {
    'viz.mark.bar.fill.default': 'var(--cmp-viz-mark-bar-fill)',
    'viz.mark.bar.stroke.default': 'var(--cmp-viz-mark-bar-stroke)',
    'viz.mark.bar.spacing': 'var(--cmp-viz-mark-spacing)',
  },

  dependencies: ['EncodingPositionX', 'EncodingPositionY'] as const,

  metadata: {
    created: '2025-11-15',
    owners: ['viz@oods.systems', 'design@oods.systems'],
    maturity: 'alpha',
    conflicts_with: ['MarkLine', 'MarkPoint', 'MarkArea'],
    accessibility: {
      rule_reference: 'A11Y-R-04',
      notes: 'Requires redundant text/table fallback in paired specs.',
    },
    regionsUsed: ['detail', 'form', 'list'],
    examples: ['RevenueByRegion', 'TicketVolumeByQueue'],
    references: [
      'cmos/research/data-viz-oods/RDS.7_synthesis_Mission Completion Report- Trait-Driven Visualization System Specification (v0.1).md',
    ],
  },
} as const satisfies TraitDefinition;

export default MarkBarTrait;
