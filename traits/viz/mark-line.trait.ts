import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const MarkLineTrait = {
  trait: {
    name: 'MarkLine',
    version: '0.1.0',
    description: 'Canonical line mark for trends, rates, and progressions.',
    category: 'viz.mark',
    tags: ['viz', 'mark', 'line', 'trend'],
  },

  parameters: [
    {"name": "chart", "type": "object", "required": false, "description": "Optional read-only chart declaration binding existing domain fields; projects into supported detail and dashboard views."},
    {"name": "title", "type": "string", "required": false, "description": "Title for the bound chart and its accessible figure."},
    {"name": "description", "type": "string", "required": false, "description": "Description of the bound chart measurements and units."},
    {"name": "renderIntent", "type": "string", "required": false, "default": "{}", "description": "JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand."},
    {"name": "previewSvg", "type": "string", "required": false, "description": "Static SVG returned by viz.render for the authored sample; omitted until a chart is rendered."},

    {
      name: 'curve',
      type: 'string',
      required: false,
      description: 'Curve interpolation strategy applied between data points.',
      default: 'linear',
      validation: {
        enum: ['linear', 'monotone', 'step'],
      },
    },
    {
      name: 'strokeWidth',
      type: 'number',
      required: false,
      description: 'Stroke width in device-independent pixels.',
      default: 2,
      validation: {
        minimum: 1,
        maximum: 8,
      },
    },
    {
      name: 'join',
      type: 'string',
      required: false,
      description: 'Join style applied when segments meet.',
      default: 'round',
      validation: {
        enum: ['miter', 'round', 'bevel'],
      },
    },
    {
      name: 'enableMarkers',
      type: 'boolean',
      required: false,
      description: 'Adds optional point markers on line vertices.',
      default: false,
    },
  ] as const,

  schema: {
    viz_mark_type: {
      type: 'string',
      required: true,
      description: 'Normalized mark identifier consumed by renderer adapters.',
      default: 'line',
      validation: {
        enum: ['line'],
      },
    },
    viz_line_curve: {
      type: 'string',
      required: false,
      description: 'Curve interpolation strategy derived from parameters.',
      default: 'linear',
      validation: {
        enum: ['linear', 'monotone', 'step'],
      },
    },
    viz_line_stroke_width: {
      type: 'number',
      required: false,
      description: 'Stroke width in pixels.',
      default: 2,
      validation: {
        minimum: 1,
        maximum: 8,
      },
    },
    viz_line_join: {
      type: 'string',
      required: false,
      description: 'Join style used for connecting segments.',
      default: 'round',
      validation: {
        enum: ['miter', 'round', 'bevel'],
      },
    },
    viz_line_markers: {
      type: 'boolean',
      required: false,
      description: 'Indicates whether point markers render along the series.',
      default: false,
    },
    viz_mark_role: {
      type: 'string',
      required: true,
      description: 'Semantic role used for heuristics and docs.',
      default: 'trend',
    },
    viz_mark_a11y_label: {
      type: 'string',
      required: true,
      description: 'Accessible description fragment for describing the line mark.',
      default: 'Line mark showing change over time or ordered categories.',
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
    viz_line_curve: {
      semantic_type: 'viz.mark.curve',
      token_mapping: 'tokenMap(viz.mark.curve)',
      ui_hints: {
        component: 'VizCurveHint',
      },
    },
    viz_line_stroke_width: {
      semantic_type: 'viz.mark.stroke_width',
      token_mapping: 'tokenMap(viz.mark.stroke_width)',
      ui_hints: {
        component: 'NumericPreview',
        unit: 'px',
      },
    },
    viz_line_join: {
      semantic_type: 'viz.mark.join',
      token_mapping: 'tokenMap(viz.mark.join)',
      ui_hints: {
        component: 'TextBadge',
      },
    },
    viz_line_markers: {
      semantic_type: 'viz.mark.markers',
      token_mapping: 'tokenMap(viz.mark.marker)',
      ui_hints: {
        component: 'BooleanBadge',
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
        component: 'VizLinePreview',
        position: 'top',
        priority: 60,
        props: {
          svgParameter: 'previewSvg',
          curveField: 'viz_line_curve',
          strokeWidthField: 'viz_line_stroke_width',
          markersField: 'viz_line_markers',
        },
      },
    ],
    dashboard: [
      {
        component: 'VizLinePreview',
        position: 'top',
        priority: 60,
        props: {
          svgParameter: 'previewSvg',
          curveField: 'viz_line_curve',
          strokeWidthField: 'viz_line_stroke_width',
          markersField: 'viz_line_markers',
        },
      },
    ],
    form: [
      {
        component: 'VizLineControls',
        position: 'top',
        props: {
          intentParameter: 'renderIntent',
          curveField: 'viz_line_curve',
          strokeField: 'viz_line_stroke_width',
          joinField: 'viz_line_join',
          markersField: 'viz_line_markers',
        },
      },
    ],
    list: [
      {
        component: 'VizRoleBadge',
        props: {
          intentParameter: 'renderIntent',
          labelField: 'viz_mark_role',
        },
      },
    ],
  },

  tokens: {
    'viz.mark.line.stroke.default': 'var(--cmp-viz-mark-line-stroke)',
    'viz.mark.line.stroke.highlight': 'var(--cmp-viz-mark-line-highlight)',
    'viz.mark.line.marker.fill': 'var(--cmp-viz-mark-point-fill)',
  },

  dependencies: ['EncodingPositionX', 'EncodingPositionY'] as const,

  metadata: {
    created: '2025-11-15',
    owners: ['Viz team', 'Design team'],
    maturity: 'alpha',
    conflicts_with: ['MarkBar', 'MarkPoint', 'MarkArea'],
    accessibility: {
      rule_reference: 'A11Y-R-05',
      notes: 'Provide textual summary for trend direction and extrema.',
    },
    regionsUsed: ['detail', 'dashboard', 'form', 'list'],
    examples: ['ActiveUsersTrend', 'ConversionRateTimeline'],
    references: [
      'RDS.7 Trait-Driven Visualization System Specification (v0.1)',
    ],
  },
} as const satisfies TraitDefinition;

export default MarkLineTrait;
