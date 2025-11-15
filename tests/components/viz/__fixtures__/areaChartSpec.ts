import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_AREA_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:area-chart',
  name: 'Monthly Revenue Contribution',
  data: {
    values: [
      { month: '2025-06', segment: 'Growth', revenue: 420 },
      { month: '2025-06', segment: 'Enterprise', revenue: 360 },
      { month: '2025-06', segment: 'Mid-Market', revenue: 180 },
      { month: '2025-07', segment: 'Growth', revenue: 480 },
      { month: '2025-07', segment: 'Enterprise', revenue: 390 },
      { month: '2025-07', segment: 'Mid-Market', revenue: 220 },
      { month: '2025-08', segment: 'Growth', revenue: 510 },
      { month: '2025-08', segment: 'Enterprise', revenue: 420 },
      { month: '2025-08', segment: 'Mid-Market', revenue: 250 },
    ],
  },
  transforms: [
    {
      type: 'calculate',
      params: {
        field: 'month',
        format: '%Y-%m',
      },
    },
    {
      type: 'stack',
      params: {
        stack: 'revenue',
        groupby: ['month'],
        sort: [{ field: 'segment', order: 'ascending' }],
        as: ['stack_start', 'stack_end'],
      },
    },
  ],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'Month',
        },
        y: {
          field: 'revenue',
          trait: 'EncodingPositionY',
          channel: 'y',
          scale: 'linear',
          title: 'Revenue ($k)',
        },
        color: {
          field: 'segment',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Segment' },
        },
      },
      options: {
        baseline: 'zero',
        curve: 'monotone',
        stack: 'revenue',
      },
    },
  ],
  encoding: {
    x: {
      field: 'month',
      trait: 'EncodingPositionX',
      channel: 'x',
      scale: 'temporal',
      title: 'Month',
    },
    y: {
      field: 'revenue',
      trait: 'EncodingPositionY',
      channel: 'y',
      scale: 'linear',
      title: 'Revenue ($k)',
    },
    color: {
      field: 'segment',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Segment' },
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 720, height: 360, padding: 24 },
    mark: {
      tooltip: true,
    },
  },
  a11y: {
    description: 'Stacked area chart showing how Growth, Enterprise, and Mid-Market segments contribute to revenue between June and August 2025.',
    ariaLabel: 'Revenue contribution stacked area chart',
    narrative: {
      summary: 'Growth drives most month-over-month gains while Enterprise rises steadily.',
      keyFindings: ['Growth segment grows by 90k between June and August', 'Mid-Market holds 20–25% share'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly revenue contribution by segment',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'segment', 'revenue'],
    preferredRenderer: 'vega-lite',
  },
};

export function createAreaChartSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_AREA_SPEC, overrides);
}
