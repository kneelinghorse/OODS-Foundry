import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { VizFacetGrid } from '~/src/components/viz/VizFacetGrid';

const meta: Meta<typeof VizFacetGrid> = {
  title: 'Visualization/VizFacetGrid',
  component: VizFacetGrid,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof VizFacetGrid>;

const gridSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:facet:grid',
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
        x: { field: 'metric', trait: 'EncodingPositionX', channel: 'x', title: 'Metric', sort: 'ascending' },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          title: 'Value (USD)',
          scale: 'linear',
        },
        color: { field: 'metric', trait: 'EncodingColor', channel: 'color', legend: { title: 'Metric' } },
      },
    },
  ],
  encoding: {
    x: { field: 'metric', trait: 'EncodingPositionX', channel: 'x', title: 'Metric', sort: 'ascending' },
    y: {
      field: 'value',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      title: 'Value (USD)',
    },
    color: { field: 'metric', trait: 'EncodingColor', channel: 'color', legend: { title: 'Metric' } },
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
    description: 'Facet grid comparing MRR vs pipeline across regions and segments.',
    ariaLabel: 'MRR vs pipeline facet grid',
    tableFallback: { enabled: true, caption: 'Facet grid table' },
  },
  portability: {
    tableColumnOrder: ['region', 'segment', 'metric', 'value'],
  },
};

export const RegionSegmentGrid: Story = {
  args: {
    spec: gridSpec,
  },
};

const rowOnlySpec: NormalizedVizSpec = {
  ...gridSpec,
  id: 'stories:viz:facet:rowOnly',
  layout: {
    trait: 'LayoutFacet',
    rows: { field: 'region', title: 'Region', sort: 'ascending' },
    gap: 12,
    sharedScales: { x: 'shared', y: 'shared' },
  },
};

export const RegionStack: Story = {
  args: {
    spec: rowOnlySpec,
    showLegend: false,
  },
};
