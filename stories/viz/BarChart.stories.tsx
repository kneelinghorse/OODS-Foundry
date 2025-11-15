import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { useHighlight } from '~/src/viz/hooks/useHighlight';
import { useTooltip } from '~/src/viz/hooks/useTooltip';
import { BarChart } from '~/src/components/viz/BarChart';

const meta: Meta<typeof BarChart> = {
  title: 'Visualization/BarChart',
  component: BarChart,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof BarChart>;

const simpleSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:bar:simple',
  name: 'Monthly Recurring Revenue by Region',
  data: {
    values: [
      { region: 'North', mrr: 120000 },
      { region: 'South', mrr: 135000 },
      { region: 'East', mrr: 98000 },
      { region: 'West', mrr: 150000 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending', title: 'Region' },
        y: { field: 'mrr', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', aggregate: 'sum', title: 'MRR (USD)' },
        color: { field: 'region', trait: 'EncodingColor', channel: 'color', legend: { title: 'Region' } },
      },
    },
  ],
  encoding: {
    x: { field: 'region', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending', title: 'Region' },
    y: { field: 'mrr', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', aggregate: 'sum', title: 'MRR (USD)' },
    color: { field: 'region', trait: 'EncodingColor', channel: 'color', legend: { title: 'Region' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 560, height: 340, padding: 16 },
  },
  a11y: {
    description: 'Bar chart comparing recurring revenue by sales region. West leads at $150k while East trails.',
    ariaLabel: 'MRR by region bar chart',
    narrative: {
      summary: 'Revenue is highest in the West region and lowest in the East region.',
      keyFindings: ['West: $150k', 'South: $135k', 'North: $120k', 'East: $98k'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly recurring revenue by region',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['region', 'mrr'],
    preferredRenderer: 'vega-lite',
  },
};

const interactiveBaseSpec: NormalizedVizSpec = {
  ...simpleSpec,
  id: 'stories:viz:bar:interactive',
};

const groupedSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:bar:grouped',
  name: 'Pipeline Coverage by Segment',
  data: {
    values: [
      { quarter: 'Q1', segment: 'Growth', coverage: 2.1 },
      { quarter: 'Q1', segment: 'Enterprise', coverage: 3.4 },
      { quarter: 'Q2', segment: 'Growth', coverage: 2.6 },
      { quarter: 'Q2', segment: 'Enterprise', coverage: 3.1 },
      { quarter: 'Q3', segment: 'Growth', coverage: 2.8 },
      { quarter: 'Q3', segment: 'Enterprise', coverage: 3.8 },
      { quarter: 'Q4', segment: 'Growth', coverage: 2.5 },
      { quarter: 'Q4', segment: 'Enterprise', coverage: 3.6 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'quarter', trait: 'EncodingPositionX', channel: 'x', title: 'Quarter' },
        y: {
          field: 'coverage',
          trait: 'EncodingPositionY',
          channel: 'y',
          scale: 'linear',
          title: 'Pipeline Coverage (× ARR)',
        },
        color: {
          field: 'segment',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Segment' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'quarter', trait: 'EncodingPositionX', channel: 'x', title: 'Quarter' },
    y: {
      field: 'coverage',
      trait: 'EncodingPositionY',
      channel: 'y',
      scale: 'linear',
      title: 'Pipeline Coverage (× ARR)',
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
    layout: { width: 640, height: 360, padding: 20 },
  },
  a11y: {
    description: 'Grouped bar chart comparing pipeline coverage ratios for Growth and Enterprise segments across quarters.',
    ariaLabel: 'Pipeline coverage grouped bar chart',
    narrative: {
      summary: 'Enterprise coverage stays above the Growth segment every quarter.',
      keyFindings: ['Enterprise peaks at 3.8× in Q3', 'Growth never exceeds 2.8× coverage'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Quarterly pipeline coverage by segment',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['quarter', 'segment', 'coverage'],
    preferredRenderer: 'vega-lite',
  },
};

const stackedSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:bar:stacked',
  name: 'Support Hours by Category',
  data: {
    values: [
      { month: 'Jan', category: 'Bug Fix', hours: 420 },
      { month: 'Jan', category: 'Feature', hours: 180 },
      { month: 'Jan', category: 'Incident', hours: 120 },
      { month: 'Feb', category: 'Bug Fix', hours: 380 },
      { month: 'Feb', category: 'Feature', hours: 210 },
      { month: 'Feb', category: 'Incident', hours: 90 },
      { month: 'Mar', category: 'Bug Fix', hours: 360 },
      { month: 'Mar', category: 'Feature', hours: 260 },
      { month: 'Mar', category: 'Incident', hours: 140 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
        y: {
          field: 'hours',
          trait: 'EncodingPositionY',
          channel: 'y',
          scale: 'linear',
          aggregate: 'sum',
          title: 'Hours Logged',
        },
        color: {
          field: 'category',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Work Category' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', title: 'Month' },
    y: {
      field: 'hours',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      scale: 'linear',
      title: 'Hours Logged',
    },
    color: {
      field: 'category',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Work Category' },
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 560, height: 360, padding: 20 },
    mark: {
      tooltip: true,
    },
  },
  a11y: {
    description: 'Stacked bars show how support teams divide time between bug fix, feature, and incident work.',
    ariaLabel: 'Stacked bar chart of support hours',
    narrative: {
      summary: 'Bug fixes dominate every month while feature requests spike in March.',
      keyFindings: ['Bug fix work stays above 350 hours monthly', 'Feature work grows 80 hours from Jan to Mar'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Monthly support hours by work category',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['month', 'category', 'hours'],
    preferredRenderer: 'vega-lite',
  },
};

const temporalSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:bar:temporal',
  name: 'Weekly Deployments',
  data: {
    values: [
      { week: '2025-01-05', deployments: 8 },
      { week: '2025-01-12', deployments: 12 },
      { week: '2025-01-19', deployments: 10 },
      { week: '2025-01-26', deployments: 14 },
      { week: '2025-02-02', deployments: 16 },
      { week: '2025-02-09', deployments: 11 },
      { week: '2025-02-16', deployments: 13 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: {
          field: 'week',
          trait: 'EncodingPositionX',
          channel: 'x',
          timeUnit: 'week',
          title: 'Week',
        },
        y: {
          field: 'deployments',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          scale: 'linear',
          title: 'Deployments',
        },
        color: {
          field: 'deployments',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Deployments' },
        },
      },
    },
  ],
  encoding: {
    x: {
      field: 'week',
      trait: 'EncodingPositionX',
      channel: 'x',
      timeUnit: 'week',
      title: 'Week',
    },
    y: {
      field: 'deployments',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      scale: 'linear',
      title: 'Deployments',
    },
    color: {
      field: 'deployments',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Deployments' },
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 620, height: 320, padding: 20 },
  },
  a11y: {
    description: 'Weekly deployment counts climb through February before settling mid-month.',
    ariaLabel: 'Temporal deployment bar chart',
    narrative: {
      summary: 'Deployments peak the week of February 2 with 16 pushes.',
      keyFindings: ['Steady climb across January', 'Sharp drop from Feb 2 to Feb 9'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Weekly deployment counts',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['week', 'deployments'],
    preferredRenderer: 'vega-lite',
  },
};

const sortedSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:bar:sorted',
  name: 'Top Performing Reps',
  data: {
    values: [
      { rep: 'A. Chen', bookings: 410000 },
      { rep: 'J. Patel', bookings: 360000 },
      { rep: 'C. Gomez', bookings: 330000 },
      { rep: 'L. Romero', bookings: 280000 },
      { rep: 'S. Nash', bookings: 250000 },
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        y: { field: 'rep', trait: 'EncodingPositionY', channel: 'y', sort: 'descending', title: 'Account Executive' },
        x: {
          field: 'bookings',
          trait: 'EncodingPositionX',
          channel: 'x',
          aggregate: 'sum',
          scale: 'linear',
          title: 'Bookings (USD)',
        },
        color: {
          field: 'rep',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Rep' },
        },
      },
    },
  ],
  encoding: {
    y: { field: 'rep', trait: 'EncodingPositionY', channel: 'y', sort: 'descending', title: 'Account Executive' },
    x: {
      field: 'bookings',
      trait: 'EncodingPositionX',
      channel: 'x',
      aggregate: 'sum',
      scale: 'linear',
      title: 'Bookings (USD)',
    },
    color: {
      field: 'rep',
      trait: 'EncodingColor',
      channel: 'color',
      legend: { title: 'Rep' },
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 360, padding: 24 },
  },
  a11y: {
    description: 'Horizontal bars rank the top five account executives by quarterly bookings.',
    ariaLabel: 'Ranked performance bar chart',
    narrative: {
      summary: 'A. Chen leads the team with $410k in bookings.',
      keyFindings: ['Top two reps contribute 52% of bookings', 'Gap between 3rd and 4th is $50k'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Quarterly bookings by account executive',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['rep', 'bookings'],
    preferredRenderer: 'vega-lite',
  },
};

export const Simple: Story = {
  name: 'Simple (Regional)',
  render: () => <BarChart spec={simpleSpec} />,
};

export const Grouped: Story = {
  name: 'Grouped Segments',
  render: () => <BarChart spec={groupedSpec} />,
};

export const Stacked: Story = {
  name: 'Stacked Categories',
  render: () => <BarChart spec={stackedSpec} />,
};

export const Temporal: Story = {
  name: 'Temporal Buckets',
  render: () => <BarChart spec={temporalSpec} />,
};

export const Sorted: Story = {
  name: 'Sorted Horizontal',
  render: () => <BarChart spec={sortedSpec} />,
};

export const Interactive: Story = {
  name: 'Interactive (Hooks)',
  render: () => <InteractiveBarChartStory />,
};

function InteractiveBarChartStory(): JSX.Element {
  const highlight = useHighlight({ fields: ['region'] });
  const tooltip = useTooltip({ fields: ['region', 'mrr'] });
  const spec = useMemo<NormalizedVizSpec>(() => ({
    ...interactiveBaseSpec,
    interactions: [highlight, tooltip],
  }), [highlight, tooltip]);

  return <BarChart spec={spec} />;
}
