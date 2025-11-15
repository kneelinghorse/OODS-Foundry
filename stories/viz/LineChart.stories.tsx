import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { LineChart } from '~/src/components/viz/LineChart';

const meta: Meta<typeof LineChart> = {
  title: 'Visualization/LineChart',
  component: LineChart,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof LineChart>;

const simpleTrendSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:line:simple',
  name: 'Active Subscribers',
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
    { type: 'calculate', params: { field: 'month', format: '%Y-%m' } },
  ],
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
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
        point: { filled: true, size: 90 },
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
    y: {
      field: 'subscribers',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      title: 'Active Subscribers',
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 340, padding: 20 },
    mark: {
      tooltip: true,
    },
  },
  a11y: {
    description: 'Line chart showing subscribers steadily increasing from 4.2k to 6.1k between June and November 2025.',
    ariaLabel: 'Subscriber growth line chart',
    narrative: {
      summary: 'Subscribers grow every month with an inflection between September and October.',
      keyFindings: ['+600 net new subscribers between August and October', 'No regressions across the period'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly active subscriber counts',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'subscribers'],
    preferredRenderer: 'vega-lite',
  },
};

const segmentedTrendSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:line:segments',
  name: 'Pipeline Velocity by Segment',
  data: {
    values: [
      { month: '2025-06', segment: 'Growth', velocity: 18 },
      { month: '2025-06', segment: 'Enterprise', velocity: 11 },
      { month: '2025-07', segment: 'Growth', velocity: 20 },
      { month: '2025-07', segment: 'Enterprise', velocity: 12 },
      { month: '2025-08', segment: 'Growth', velocity: 21 },
      { month: '2025-08', segment: 'Enterprise', velocity: 13 },
      { month: '2025-09', segment: 'Growth', velocity: 24 },
      { month: '2025-09', segment: 'Enterprise', velocity: 14 },
      { month: '2025-10', segment: 'Growth', velocity: 23 },
      { month: '2025-10', segment: 'Enterprise', velocity: 16 },
      { month: '2025-11', segment: 'Growth', velocity: 25 },
      { month: '2025-11', segment: 'Enterprise', velocity: 17 },
    ],
  },
  transforms: [{ type: 'calculate', params: { field: 'month', format: '%Y-%m' } }],
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
        y: {
          field: 'velocity',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Pipeline Velocity (days)',
        },
        color: {
          field: 'segment',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Segment' },
        },
      },
      options: {
        strokeWidth: 3,
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Month' },
    y: {
      field: 'velocity',
      trait: 'EncodingPositionY',
      channel: 'y',
      title: 'Pipeline Velocity (days)',
    },
    color: {
      field: 'segment',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Segment' },
    },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 720, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Two-line chart comparing pipeline velocity for Growth vs Enterprise segments. Growth consistently exceeds Enterprise by ~7 days.',
    ariaLabel: 'Pipeline velocity trend chart',
    narrative: {
      summary: 'Growth deals progress ~7 days faster than Enterprise through the entire window.',
      keyFindings: ['Enterprise velocity improves by 6 days between July and November', 'Growth velocity peaks at 24 days in September'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Pipeline velocity by segment and month',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'segment', 'velocity'],
    preferredRenderer: 'vega-lite',
  },
};

const benchmarkTrendSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:line:benchmark',
  name: 'Deployment Frequency vs Target',
  data: {
    values: [
      { week: '2025-08-01', series: 'Actual', value: 24 },
      { week: '2025-08-01', series: 'Target', value: 20 },
      { week: '2025-08-08', series: 'Actual', value: 22 },
      { week: '2025-08-08', series: 'Target', value: 20 },
      { week: '2025-08-15', series: 'Actual', value: 25 },
      { week: '2025-08-15', series: 'Target', value: 20 },
      { week: '2025-08-22', series: 'Actual', value: 28 },
      { week: '2025-08-22', series: 'Target', value: 21 },
      { week: '2025-08-29', series: 'Actual', value: 26 },
      { week: '2025-08-29', series: 'Target', value: 21 },
      { week: '2025-09-05', series: 'Actual', value: 27 },
      { week: '2025-09-05', series: 'Target', value: 22 },
      { week: '2025-09-12', series: 'Actual', value: 29 },
      { week: '2025-09-12', series: 'Target', value: 22 },
      { week: '2025-09-19', series: 'Actual', value: 30 },
      { week: '2025-09-19', series: 'Target', value: 22 },
    ],
  },
  transforms: [{ type: 'calculate', params: { field: 'week', format: '%Y-%m-%d' } }],
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Week' },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          scale: 'linear',
          title: 'Deployments per week',
        },
        color: {
          field: 'series',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Series' },
        },
      },
      options: {
        strokeWidth: 3,
      },
    },
  ],
  encoding: {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal', title: 'Week' },
    y: {
      field: 'value',
      trait: 'EncodingPositionY',
      channel: 'y',
      scale: 'linear',
      title: 'Deployments per week',
    },
    color: {
      field: 'series',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Series' },
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 700, height: 360, padding: 20 },
  },
  a11y: {
    description: 'Dual-line visualization comparing actual deployment frequency to a flat weekly target line.',
    ariaLabel: 'Deployments vs target line chart',
    narrative: {
      summary: 'Deployments stay above the target line all quarter with a widening gap after August.',
      keyFindings: ['Actual deployments peak at 30 per week', 'Target remains flat at 20-22 deployments'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Weekly deployments and targets',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['week', 'series', 'value'],
  },
};

const denseTemporalSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:line:dense',
  name: 'Latency P95 (24h)',
  data: {
    values: [
      { timestamp: '2025-11-14T00:00:00Z', latency: 182 },
      { timestamp: '2025-11-14T04:00:00Z', latency: 175 },
      { timestamp: '2025-11-14T08:00:00Z', latency: 164 },
      { timestamp: '2025-11-14T12:00:00Z', latency: 158 },
      { timestamp: '2025-11-14T16:00:00Z', latency: 165 },
      { timestamp: '2025-11-14T20:00:00Z', latency: 172 },
      { timestamp: '2025-11-15T00:00:00Z', latency: 166 },
      { timestamp: '2025-11-15T04:00:00Z', latency: 155 },
      { timestamp: '2025-11-15T08:00:00Z', latency: 149 },
      { timestamp: '2025-11-15T12:00:00Z', latency: 152 },
      { timestamp: '2025-11-15T16:00:00Z', latency: 160 },
      { timestamp: '2025-11-15T20:00:00Z', latency: 170 },
    ],
  },
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: {
          field: 'timestamp',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'UTC Timestamp',
        },
        y: {
          field: 'latency',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Latency (ms)',
        },
      },
      options: {
        curve: 'step-after',
      },
    },
  ],
  encoding: {
    x: {
      field: 'timestamp',
      trait: 'EncodingPositionX',
      channel: 'x',
      scale: 'temporal',
      title: 'UTC Timestamp',
    },
    y: {
      field: 'latency',
      trait: 'EncodingPositionY',
      channel: 'y',
      title: 'Latency (ms)',
    },
  },
  config: {
    theme: 'brand-c',
    layout: { width: 600, height: 320, padding: 16 },
  },
  a11y: {
    description: 'Line chart of P95 latency sampled every four hours across a 24 hour window.',
    ariaLabel: 'Latency over time line chart',
    narrative: {
      summary: 'Latency dips below 160ms for most of the window but spikes back toward 170ms near 20:00 UTC.',
      keyFindings: ['Two dips below 150ms', 'Highest reading 182ms at the beginning of the window'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Latency readings table',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['timestamp', 'latency'],
  },
};

export const SimpleTrend: Story = {
  render: () => <LineChart spec={simpleTrendSpec} />,
};

export const SegmentedTrend: Story = {
  render: () => <LineChart spec={segmentedTrendSpec} />,
};

export const BenchmarkVsTarget: Story = {
  render: () => <LineChart spec={benchmarkTrendSpec} />,
};

const ResponsivePlaygroundTemplate = (): JSX.Element => {
  const [width, setWidth] = useState(720);

  return (
    <div className="mx-auto max-w-full space-y-4 px-4 py-6">
      <label className="flex flex-col gap-2 text-sm text-text">
        <span className="font-medium">Resize container (width: {width}px)</span>
        <input
          type="range"
          min={360}
          max={960}
          step={20}
          value={width}
        onChange={(event) => setWidth(Number(event.target.value))}
        aria-label="Adjust chart width"
        className="w-full"
      />
      </label>
      <div style={{ width }} className="transition-all duration-200">
        <LineChart spec={denseTemporalSpec} />
      </div>
    </div>
  );
};

export const ResponsivePlayground: Story = {
  render: () => <ResponsivePlaygroundTemplate />,
};
