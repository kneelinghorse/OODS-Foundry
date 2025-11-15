import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { useHighlight } from '~/src/viz/hooks/useHighlight';
import { useTooltip } from '~/src/viz/hooks/useTooltip';
import { Heatmap } from '~/src/components/viz/Heatmap';

const meta: Meta<typeof Heatmap> = {
  title: 'Visualization/Heatmap',
  component: Heatmap,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof Heatmap>;

const timeOfDaySpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:viz:heatmap:time-of-day',
  name: 'Support Load by Day + Hour',
  data: {
    values: [
      { day: 'Monday', hour: '08:00', tickets: 12 },
      { day: 'Monday', hour: '12:00', tickets: 28 },
      { day: 'Monday', hour: '16:00', tickets: 34 },
      { day: 'Tuesday', hour: '08:00', tickets: 15 },
      { day: 'Tuesday', hour: '12:00', tickets: 33 },
      { day: 'Tuesday', hour: '16:00', tickets: 26 },
      { day: 'Wednesday', hour: '08:00', tickets: 9 },
      { day: 'Wednesday', hour: '12:00', tickets: 24 },
      { day: 'Wednesday', hour: '16:00', tickets: 21 },
      { day: 'Thursday', hour: '08:00', tickets: 7 },
      { day: 'Thursday', hour: '12:00', tickets: 18 },
      { day: 'Thursday', hour: '16:00', tickets: 19 },
      { day: 'Friday', hour: '08:00', tickets: 10 },
      { day: 'Friday', hour: '12:00', tickets: 22 },
      { day: 'Friday', hour: '16:00', tickets: 17 },
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: { field: 'hour', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Hour of day' },
        y: { field: 'day', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Day of week' },
        color: { field: 'tickets', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Tickets' },
      },
      options: { borderRadius: 4 },
    },
  ],
  encoding: {
    x: { field: 'hour', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Hour of day' },
    y: { field: 'day', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Day of week' },
    color: { field: 'tickets', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Tickets' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 720, height: 420, padding: 24 },
  },
  a11y: {
    ariaLabel: 'Support ticket heatmap',
    description: 'Heatmap showing lunch spikes for mid-week support load.',
    narrative: {
      summary: 'Tuesday lunch drives the highest volume, while Thursday mornings dip below 10 tickets.',
      keyFindings: ['Lunch blocks trend hotter than mornings', 'Week tapers toward Friday afternoon'],
    },
    tableFallback: { enabled: true, caption: 'Tickets by day of week and hour of day' },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['day', 'hour', 'tickets'],
  },
};

const correlationSpec: NormalizedVizSpec = {
  ...timeOfDaySpec,
  id: 'stories:viz:heatmap:correlation',
  name: 'Feature Usage vs Conversion',
  data: {
    values: [
      { feature: 'Workflows', segment: 'Growth', conversion: 24 },
      { feature: 'Workflows', segment: 'Enterprise', conversion: 46 },
      { feature: 'Automation', segment: 'Growth', conversion: 32 },
      { feature: 'Automation', segment: 'Enterprise', conversion: 51 },
      { feature: 'AI Assist', segment: 'Growth', conversion: 29 },
      { feature: 'AI Assist', segment: 'Enterprise', conversion: 41 },
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: { field: 'segment', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Segment' },
        y: { field: 'feature', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Feature' },
        color: {
          field: 'conversion',
          trait: 'EncodingColor',
          channel: 'color',
          scale: 'linear',
          title: 'Conversion rate (%)',
        },
      },
    },
  ],
  encoding: {
    x: { field: 'segment', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Segment' },
    y: { field: 'feature', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Feature' },
    color: {
      field: 'conversion',
      trait: 'EncodingColor',
      channel: 'color',
      scale: 'linear',
      title: 'Conversion rate (%)',
    },
  },
  a11y: {
    ariaLabel: 'Conversion heatmap',
    description: 'Enterprise workflows convert twice as high as Growth segments; AI assist lags across the board.',
    narrative: {
      summary: 'Workflows + Automation carry enterprise deals while AI assist underperforms.',
      keyFindings: ['Automation leads both segments', 'Growth adoption trails by ~15 points'],
    },
    tableFallback: { enabled: true, caption: 'Conversion by segment and feature' },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['segment', 'feature', 'conversion'],
  },
};

const annotatedSpec: NormalizedVizSpec = {
  ...timeOfDaySpec,
  id: 'stories:viz:heatmap:annotated',
  name: 'Build Throughput by Squad & Week',
  data: {
    values: [
      { squad: 'Atlas', week: 'Week 1', stories: 14 },
      { squad: 'Atlas', week: 'Week 2', stories: 16 },
      { squad: 'Atlas', week: 'Week 3', stories: 19 },
      { squad: 'Nova', week: 'Week 1', stories: 11 },
      { squad: 'Nova', week: 'Week 2', stories: 13 },
      { squad: 'Nova', week: 'Week 3', stories: 21 },
      { squad: 'Kite', week: 'Week 1', stories: 8 },
      { squad: 'Kite', week: 'Week 2', stories: 9 },
      { squad: 'Kite', week: 'Week 3', stories: 12 },
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Iteration' },
        y: { field: 'squad', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Squad' },
        color: { field: 'stories', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Stories completed' },
      },
    },
  ],
  encoding: {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'band', title: 'Iteration' },
    y: { field: 'squad', trait: 'EncodingPositionY', channel: 'y', scale: 'band', title: 'Squad' },
    color: { field: 'stories', trait: 'EncodingColor', channel: 'color', scale: 'linear', title: 'Stories completed' },
  },
  a11y: {
    ariaLabel: 'Squad throughput heatmap',
    description: 'Nova accelerates during Week 3 while Kite remains steady.',
    narrative: {
      summary: 'Nova doubles throughput mid sprint; Atlas climbs gradually; Kite remains flat.',
      keyFindings: ['Nova stories jump to 21 in Week 3', 'Atlas grows 35% over the sprint'],
    },
    tableFallback: { enabled: true, caption: 'Stories completed per squad and week' },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['squad', 'week', 'stories'],
  },
};

function useHeatmapInteractions(): [ReturnType<typeof useHighlight>, ReturnType<typeof useTooltip>] {
  const highlight = useHighlight({ fields: ['day', 'hour', 'segment', 'feature', 'week', 'squad'] });
  const tooltip = useTooltip({ fields: ['day', 'hour', 'tickets', 'segment', 'feature', 'conversion', 'stories'] });
  return useMemo(() => [highlight, tooltip], [highlight, tooltip]);
}

export const TimeOfDay: Story = {
  name: 'Time-of-day Heatmap',
  render: () => {
    const [highlight, tooltip] = useHeatmapInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...timeOfDaySpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return <Heatmap spec={spec} />;
  },
};

export const CorrelationMatrix: Story = {
  name: 'Correlation Matrix',
  render: () => {
    const [highlight, tooltip] = useHeatmapInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...correlationSpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return <Heatmap spec={spec} />;
  },
};

export const AnnotatedThroughput: Story = {
  name: 'Annotated Throughput',
  render: () => {
    const [highlight, tooltip] = useHeatmapInteractions();
    const spec = useMemo<NormalizedVizSpec>(
      () => ({ ...annotatedSpec, interactions: [highlight, tooltip] }),
      [highlight, tooltip]
    );
    return (
      <div className="space-y-6">
        <Heatmap spec={spec} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Annotations</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text">
            <li>Nova sprint 3 surge (21 stories) indicates stable lead time.</li>
            <li>Atlas shows steady climb; highlight as new baseline beyond Week 1.</li>
            <li>Kite remains flat → candidate for pairing swap.</li>
          </ul>
        </div>
      </div>
    );
  },
};
