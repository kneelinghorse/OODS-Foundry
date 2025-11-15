import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { AreaChart } from '~/src/components/viz/AreaChart';

const meta: Meta<typeof AreaChart> = {
  title: 'Visualization/AreaChart',
  component: AreaChart,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof AreaChart>;

const singleSeriesSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:area:single',
  name: 'Net ARR Added',
  data: {
    values: [
      { month: '2025-06', arr: 180 },
      { month: '2025-07', arr: 220 },
      { month: '2025-08', arr: 260 },
      { month: '2025-09', arr: 235 },
      { month: '2025-10', arr: 295 },
      { month: '2025-11', arr: 320 },
    ],
  },
  transforms: [{ type: 'calculate', params: { field: 'month', format: '%Y-%m' } }],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
        y: { field: 'arr', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Net ARR Added ($k)' },
      },
      options: {
        baseline: 'zero',
        curve: 'monotone',
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
    y: { field: 'arr', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Net ARR Added ($k)' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 720, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Area chart showing net ARR growth between June and November 2025.',
    ariaLabel: 'Net ARR area chart',
    narrative: {
      summary: 'ARR accelerates sharply heading into Q4 with a brief plateau in September.',
      keyFindings: ['+115k ARR between August and October', 'September dip recovers the following month'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly net ARR added',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'arr'],
  },
};

const stackedAreaSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:area:stacked',
  name: 'Pipeline Coverage by Segment',
  data: {
    values: [
      { quarter: 'Q1', segment: 'Growth', coverage: 2.4 },
      { quarter: 'Q1', segment: 'Enterprise', coverage: 3.1 },
      { quarter: 'Q1', segment: 'Mid-Market', coverage: 1.2 },
      { quarter: 'Q2', segment: 'Growth', coverage: 2.8 },
      { quarter: 'Q2', segment: 'Enterprise', coverage: 3.4 },
      { quarter: 'Q2', segment: 'Mid-Market', coverage: 1.3 },
      { quarter: 'Q3', segment: 'Growth', coverage: 3.1 },
      { quarter: 'Q3', segment: 'Enterprise', coverage: 3.6 },
      { quarter: 'Q3', segment: 'Mid-Market', coverage: 1.5 },
      { quarter: 'Q4', segment: 'Growth', coverage: 3.5 },
      { quarter: 'Q4', segment: 'Enterprise', coverage: 3.9 },
      { quarter: 'Q4', segment: 'Mid-Market', coverage: 1.7 },
    ],
  },
  transforms: [
    {
      type: 'stack',
      params: {
        stack: 'coverage',
        groupby: ['quarter'],
        sort: [{ field: 'segment', order: 'ascending' }],
        as: ['stack_start', 'stack_end'],
      },
    },
  ],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: { field: 'quarter', trait: 'EncodingPositionX', channel: 'x', title: 'Quarter' },
        y: { field: 'coverage', trait: 'EncodingPositionY', channel: 'y', title: 'Coverage (× quota)' },
        color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
      },
      options: {
        baseline: 'zero',
        stack: 'coverage',
      },
    },
  ],
  encoding: {
    x: { field: 'quarter', trait: 'EncodingPositionX', channel: 'x', title: 'Quarter' },
    y: { field: 'coverage', trait: 'EncodingPositionY', channel: 'y', title: 'Coverage (× quota)' },
    color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 720, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Stacked area chart showing quarterly pipeline coverage split by segment.',
    ariaLabel: 'Pipeline coverage stacked area chart',
    narrative: {
      summary: 'Enterprise coverage leads every quarter, Growth narrows the gap by Q4.',
      keyFindings: ['Growth coverage crosses 3× in Q4', 'Mid-Market contributes ~1.5× consistently'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Pipeline coverage by segment and quarter',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['quarter', 'segment', 'coverage'],
  },
};

const overlappingSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:area:overlapping',
  name: 'Support Capacity vs Workload',
  data: {
    values: [
      { week: '2025-08-01', type: 'Capacity', hours: 320 },
      { week: '2025-08-01', type: 'Workload', hours: 300 },
      { week: '2025-08-08', type: 'Capacity', hours: 320 },
      { week: '2025-08-08', type: 'Workload', hours: 340 },
      { week: '2025-08-15', type: 'Capacity', hours: 320 },
      { week: '2025-08-15', type: 'Workload', hours: 335 },
      { week: '2025-08-22', type: 'Capacity', hours: 320 },
      { week: '2025-08-22', type: 'Workload', hours: 360 },
      { week: '2025-08-29', type: 'Capacity', hours: 320 },
      { week: '2025-08-29', type: 'Workload', hours: 310 },
    ],
  },
  transforms: [{ type: 'calculate', params: { field: 'week', format: '%Y-%m-%d' } }],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Week' },
        y: { field: 'hours', trait: 'EncodingPositionY', channel: 'y', title: 'Hours' },
        color: { field: 'type', trait: 'EncodingColor', channel: 'color', legend: { title: 'Measure' } },
      },
      options: {
        baseline: 'zero',
        curve: 'step',
      },
    },
  ],
  encoding: {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Week' },
    y: { field: 'hours', trait: 'EncodingPositionY', channel: 'y', title: 'Hours' },
    color: { field: 'type', trait: 'EncodingColor', channel: 'color', legend: { title: 'Measure' } },
  },
  config: {
    theme: 'brand-c',
    layout: { width: 720, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Overlapping area chart comparing support capacity with actual workload.',
    ariaLabel: 'Support capacity vs workload area chart',
    narrative: {
      summary: 'Capacity sits flat while workload occasionally exceeds the threshold, signaling staffing pressure.',
      keyFindings: ['Workload spikes above capacity mid-month', 'Final week dips below capacity'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Weekly support capacity vs workload',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['week', 'type', 'hours'],
  },
};

const gapsSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:area:gaps',
  name: 'Content Production Velocity',
  data: {
    values: [
      { sprint: 'Sprint 10', category: 'Articles', shipped: 12 },
      { sprint: 'Sprint 10', category: 'Videos', shipped: 4 },
      { sprint: 'Sprint 11', category: 'Articles', shipped: 15 },
      { sprint: 'Sprint 11', category: 'Videos', shipped: null },
      { sprint: 'Sprint 12', category: 'Articles', shipped: 9 },
      { sprint: 'Sprint 12', category: 'Videos', shipped: 5 },
      { sprint: 'Sprint 13', category: 'Articles', shipped: null },
      { sprint: 'Sprint 13', category: 'Videos', shipped: 3 },
    ],
  },
  transforms: [
    {
      type: 'stack',
      params: {
        stack: 'shipped',
        groupby: ['sprint'],
        sort: [{ field: 'category', order: 'ascending' }],
        as: ['stack_start', 'stack_end'],
      },
    },
  ],
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: { field: 'sprint', trait: 'EncodingPositionX', channel: 'x', title: 'Sprint' },
        y: { field: 'shipped', trait: 'EncodingPositionY', channel: 'y', title: 'Assets Shipped' },
        color: { field: 'category', trait: 'EncodingColor', channel: 'color', legend: { title: 'Category' } },
      },
      options: {
        baseline: 'zero',
        stack: 'shipped',
      },
    },
  ],
  encoding: {
    x: { field: 'sprint', trait: 'EncodingPositionX', channel: 'x', title: 'Sprint' },
    y: { field: 'shipped', trait: 'EncodingPositionY', channel: 'y', title: 'Assets Shipped' },
    color: { field: 'category', trait: 'EncodingColor', channel: 'color', legend: { title: 'Category' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 720, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Stacked area chart with intentional gaps where no assets shipped for a category.',
    ariaLabel: 'Content production velocity area chart with gaps',
    narrative: {
      summary: 'Articles pause during Sprint 13 while videos skip Sprint 11, revealing resourcing gaps.',
      keyFindings: ['Sprint 11 missing videos', 'Articles skip Sprint 13 entirely'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Assets shipped per sprint by category',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['sprint', 'category', 'shipped'],
  },
};

export const SingleSeries: Story = {
  render: () => <AreaChart spec={singleSeriesSpec} />,
};

export const Stacked: Story = {
  render: () => <AreaChart spec={stackedAreaSpec} />,
};

export const Overlapping: Story = {
  render: () => <AreaChart spec={overlappingSpec} />,
};

export const WithGaps: Story = {
  render: () => <AreaChart spec={gapsSpec} />,
};
