import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:line-chart',
  name: 'Active Subscribers Over Time',
  data: {
    values: [
      { month: '2025-06', subscribers: 4200 },
      { month: '2025-07', subscribers: 4600 },
      { month: '2025-08', subscribers: 5100 },
      { month: '2025-09', subscribers: 5450 },
      { month: '2025-10', subscribers: 5800 },
      { month: '2025-11', subscribers: 6100 },
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
  ],
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'Month',
        },
        y: {
          field: 'subscribers',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          scale: 'linear',
          title: 'Active Subscribers',
        },
      },
      options: {
        curve: 'monotone',
        point: { filled: true },
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
      field: 'subscribers',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      scale: 'linear',
      title: 'Active Subscribers',
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 600, height: 320, padding: 24 },
    mark: {
      tooltip: true,
    },
  },
  a11y: {
    description: 'Line chart showing subscriber growth from June to November 2025, climbing from 4.2k to 6.1k active users.',
    ariaLabel: 'Subscriber growth trend line chart',
    narrative: {
      summary: 'Active subscribers trend upward every month with the steepest increase in October.',
      keyFindings: ['+400 subscribers in July', 'September plateaus before October spike'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly active subscribers table',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'subscribers'],
    preferredRenderer: 'vega-lite',
  },
};

export function createLineChartSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_SPEC, overrides);
}
