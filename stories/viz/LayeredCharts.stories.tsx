import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { VizLayeredView } from '~/src/components/viz/VizLayeredView';

const meta: Meta<typeof VizLayeredView> = {
  title: 'Visualization/VizLayeredView',
  component: VizLayeredView,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof VizLayeredView>;

const layeredSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:layered:actuals',
  name: 'Actuals vs Target Index',
  data: {
    values: [
      { month: '2025-01', actual: 94, target: 90 },
      { month: '2025-02', actual: 97, target: 92 },
      { month: '2025-03', actual: 99, target: 94 },
      { month: '2025-04', actual: 101, target: 95 },
      { month: '2025-05', actual: 106, target: 97 },
      { month: '2025-06', actual: 110, target: 100 },
    ],
  },
  marks: [
    {
      trait: 'MarkArea',
      options: { id: 'target-band', title: 'Target band' },
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
        y: {
          field: 'target',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Target index',
          scale: 'linear',
        },
      },
    },
    {
      trait: 'MarkLine',
      options: { id: 'actual', title: 'Actuals' },
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
        y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y', title: 'Actual index', scale: 'linear' },
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
    y: { field: 'actual', trait: 'EncodingPositionY', channel: 'y', title: 'Actual index' },
  },
  layout: {
    trait: 'LayoutLayer',
    order: ['target-band', 'actual'],
    sharedScales: { x: 'shared', y: 'shared' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 620, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Line overlaid on an area band showing how actual performance compares against targets.',
    ariaLabel: 'Layered actual vs target chart',
    tableFallback: { enabled: true, caption: 'Actual vs target index' },
  },
  portability: {
    tableColumnOrder: ['month', 'actual', 'target'],
  },
};

export const DefaultLayeredView: Story = {
  args: {
    spec: layeredSpec,
  },
};

export const WithoutLegend: Story = {
  args: {
    spec: layeredSpec,
    showLegend: false,
  },
};
