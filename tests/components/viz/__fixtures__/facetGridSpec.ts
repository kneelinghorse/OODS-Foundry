import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:facet-grid',
  name: 'MRR vs Pipeline by Region × Segment',
  data: {
    values: [
      { region: 'North', segment: 'Enterprise', metric: 'MRR', value: 120000 },
      { region: 'North', segment: 'Enterprise', metric: 'Pipeline', value: 95000 },
      { region: 'North', segment: 'Growth', metric: 'MRR', value: 68000 },
      { region: 'North', segment: 'Growth', metric: 'Pipeline', value: 54000 },
      { region: 'South', segment: 'Enterprise', metric: 'MRR', value: 108000 },
      { region: 'South', segment: 'Enterprise', metric: 'Pipeline', value: 87000 },
      { region: 'South', segment: 'Growth', metric: 'MRR', value: 72000 },
      { region: 'South', segment: 'Growth', metric: 'Pipeline', value: 61000 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: {
          field: 'metric',
          trait: 'EncodingPositionX',
          channel: 'x',
          title: 'Metric',
          sort: 'ascending',
        },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          scale: 'linear',
          title: 'Value (USD)',
        },
        color: {
          field: 'metric',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Metric' },
        },
      },
    },
  ],
  encoding: {
    x: {
      field: 'metric',
      trait: 'EncodingPositionX',
      channel: 'x',
      title: 'Metric',
    },
    y: {
      field: 'value',
      trait: 'EncodingPositionY',
      channel: 'y',
      title: 'Value (USD)',
      aggregate: 'sum',
    },
    color: {
      field: 'metric',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Metric' },
    },
  },
  layout: {
    trait: 'LayoutFacet',
    rows: { field: 'region', title: 'Region', sort: 'ascending' },
    columns: { field: 'segment', title: 'Segment', sort: 'ascending' },
    gap: 12,
    sharedScales: { x: 'shared', y: 'shared', color: 'shared' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 360, height: 260, padding: 16 },
  },
  a11y: {
    description: 'Grid of bar charts comparing MRR and pipeline totals by region and segment.',
    ariaLabel: 'Facet grid of revenue metrics',
    tableFallback: { enabled: true, caption: 'Facet table' },
  },
  portability: {
    tableColumnOrder: ['region', 'segment', 'metric', 'value'],
  },
};

export function createFacetGridSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_SPEC, overrides);
}
