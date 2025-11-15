import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { useHighlight } from '~/src/viz/hooks/useHighlight';
import { useTooltip } from '~/src/viz/hooks/useTooltip';
import { BubbleChart } from '~/src/components/viz/BubbleChart';
import { ScatterChart } from '~/src/components/viz/ScatterChart';

const meta: Meta<typeof ScatterChart> = {
  title: 'Visualization/ScatterChart',
  component: ScatterChart,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof ScatterChart>;

const baseData = [
  { leadTime: 6, winRate: 52, pipeline: 610000, segment: 'Enterprise' },
  { leadTime: 10, winRate: 46, pipeline: 540000, segment: 'Enterprise' },
  { leadTime: 14, winRate: 34, pipeline: 450000, segment: 'Growth' },
  { leadTime: 18, winRate: 26, pipeline: 420000, segment: 'Growth' },
  { leadTime: 12, winRate: 40, pipeline: 470000, segment: 'Mid-Market' },
  { leadTime: 8, winRate: 48, pipeline: 500000, segment: 'Mid-Market' },
];

const interactionFields = ['leadTime', 'winRate', 'pipeline'] as const;

const scatterSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:scatter:simple',
  name: 'Win Rate vs Lead Time',
  data: { values: baseData },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
        y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
        color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
      },
    },
  ],
  encoding: {
    x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
    y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
    color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 380, padding: 20 },
  },
  a11y: {
    description: 'Scatterplot showing that shorter sales cycles correlate with higher win rates, grouped by segment.',
    ariaLabel: 'Win rate vs lead time scatterplot',
    narrative: {
      summary: 'Closing inside 10 weeks keeps win rate above 45%; growth deals past 16 weeks dip below 30%.',
      keyFindings: ['Enterprise stays above 46% under 12 weeks', 'Growth drops sharply after 16 weeks'],
    },
    tableFallback: { enabled: true, caption: 'Opportunities by lead time, win rate, and segment' },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['segment', 'leadTime', 'winRate'],
  },
};

const bubbleSpec: NormalizedVizSpec = {
  ...scatterSpec,
  id: 'stories:viz:scatter:bubble',
  name: 'Bubble Chart: Pipeline vs Win Rate',
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: scatterSpec.encoding.x,
        y: scatterSpec.encoding.y,
        color: scatterSpec.encoding.color,
        size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size', title: 'Pipeline ($)' },
      },
    },
  ],
  encoding: {
    ...scatterSpec.encoding,
    size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size', title: 'Pipeline ($)' },
  },
  portability: {
    ...scatterSpec.portability,
    preferredRenderer: 'echarts',
  },
};

const categoricalSpec: NormalizedVizSpec = {
  ...scatterSpec,
  id: 'stories:viz:scatter:categorical',
  name: 'Segment Distribution',
  data: {
    values: [
      { leadTime: 9, winRate: 44, pipeline: 480000, segment: 'Enterprise' },
      { leadTime: 16, winRate: 30, pipeline: 410000, segment: 'Growth' },
      { leadTime: 11, winRate: 42, pipeline: 455000, segment: 'Mid-Market' },
      { leadTime: 7, winRate: 50, pipeline: 630000, segment: 'Enterprise' },
      { leadTime: 20, winRate: 24, pipeline: 395000, segment: 'Growth' },
      { leadTime: 13, winRate: 37, pipeline: 430000, segment: 'Mid-Market' },
    ],
  },
};

const regressionSpec: NormalizedVizSpec = {
  ...bubbleSpec,
  id: 'stories:viz:scatter:trendline',
  name: 'Win Rate Trend with Benchmarks',
  data: {
    values: [
      { leadTime: 6, winRate: 54, pipeline: 630000, segment: 'Enterprise' },
      { leadTime: 9, winRate: 50, pipeline: 590000, segment: 'Enterprise' },
      { leadTime: 12, winRate: 43, pipeline: 520000, segment: 'Mid-Market' },
      { leadTime: 15, winRate: 36, pipeline: 470000, segment: 'Mid-Market' },
      { leadTime: 18, winRate: 28, pipeline: 420000, segment: 'Growth' },
      { leadTime: 21, winRate: 24, pipeline: 400000, segment: 'Growth' },
    ],
  },
  marks: [
    bubbleSpec.marks[0],
    {
      trait: 'MarkLine',
      encodings: {
        x: bubbleSpec.encoding.x,
        y: bubbleSpec.encoding.y,
      },
      options: { curve: 'linear', point: { filled: true } },
    },
  ],
};

function useScatterInteractions(): [ReturnType<typeof useHighlight>, ReturnType<typeof useTooltip>] {
  const highlight = useHighlight({ fields: ['segment'] });
  const tooltip = useTooltip({ fields: interactionFields });
  return useMemo(() => [highlight, tooltip], [highlight, tooltip]);
}

export const SimpleScatter: Story = {
  name: 'Simple Scatter',
  render: () => {
    const [highlight, tooltip] = useScatterInteractions();
    const spec = useMemo<NormalizedVizSpec>(() => ({ ...scatterSpec, interactions: [highlight, tooltip] }), [highlight, tooltip]);
    return <ScatterChart spec={spec} />;
  },
};

export const Bubble: Story = {
  name: 'Bubble (Size Encoding)',
  render: () => {
    const [highlight, tooltip] = useScatterInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...bubbleSpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return <BubbleChart spec={spec} />;
  },
};

export const Categorical: Story = {
  name: 'Categorical Scatter',
  render: () => {
    const [highlight, tooltip] = useScatterInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...categoricalSpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return <ScatterChart spec={spec} />;
  },
};

export const WithRegressionLine: Story = {
  name: 'With Regression Line',
  render: () => {
    const [highlight, tooltip] = useScatterInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...regressionSpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return <ScatterChart spec={spec} />;
  },
};
