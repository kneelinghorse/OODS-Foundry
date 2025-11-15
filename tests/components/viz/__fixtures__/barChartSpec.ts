import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:bar-chart',
  name: 'Example Revenue by Region',
  data: {
    values: [
      { region: 'North', revenue: 125000 },
      { region: 'South', revenue: 98000 },
      { region: 'East', revenue: 143000 },
      { region: 'West', revenue: 158000 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending', title: 'Region' },
        y: {
          field: 'revenue',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          scale: 'linear',
          title: 'Revenue (USD)',
        },
        color: { field: 'region', trait: 'EncodingColor', channel: 'color', legend: { title: 'Region' } },
      },
    },
  ],
  encoding: {
    x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending', title: 'Region' },
    y: {
      field: 'revenue',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      scale: 'linear',
      title: 'Revenue (USD)',
    },
    color: { field: 'region', trait: 'EncodingColor', channel: 'color', legend: { title: 'Region' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 520, height: 320, padding: 16 },
  },
  a11y: {
    description: 'Regional revenue comparison highlighting West as the leader and South as lowest.',
    ariaLabel: 'Revenue by region bar chart',
    narrative: {
      summary: 'West outperforms other regions by at least $15k.',
      keyFindings: ['West is $33k above South', 'East exceeds North by $18k'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Regional revenue table',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['region', 'revenue'],
    preferredRenderer: 'vega-lite',
  },
};

export function createBarChartSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_SPEC, overrides);
}
