import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_SCATTER_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:scatter-chart',
  name: 'Win Rate vs. Lead Time',
  data: {
    values: [
      { leadTime: 12, winRate: 34, pipeline: 450000, segment: 'Growth' },
      { leadTime: 18, winRate: 28, pipeline: 520000, segment: 'Growth' },
      { leadTime: 8, winRate: 46, pipeline: 610000, segment: 'Enterprise' },
      { leadTime: 15, winRate: 31, pipeline: 480000, segment: 'Mid-Market' },
      { leadTime: 10, winRate: 44, pipeline: 570000, segment: 'Enterprise' },
    ],
  },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
        y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
        size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size', title: 'Pipeline ($)' },
        color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
      },
    },
  ],
  encoding: {
    x: { field: 'leadTime', trait: 'EncodingPositionX', channel: 'x', scale: 'linear', title: 'Lead Time (weeks)' },
    y: { field: 'winRate', trait: 'EncodingPositionY', channel: 'y', scale: 'linear', title: 'Win Rate (%)' },
    size: { field: 'pipeline', trait: 'EncodingSize', channel: 'size', title: 'Pipeline ($)' },
    color: { field: 'segment', trait: 'EncodingColor', channel: 'color', legend: { title: 'Segment' } },
  },
  interactions: [
    {
      id: 'point-highlight',
      select: { type: 'point', on: 'hover', fields: ['segment'] },
      rule: {
        bindTo: 'visual',
        property: 'fillOpacity',
        condition: { value: 1 },
        else: { value: 0.35 },
      },
    },
    {
      id: 'point-tooltip',
      select: { type: 'point', on: 'hover', fields: ['leadTime', 'winRate', 'pipeline'] },
      rule: {
        bindTo: 'tooltip',
        fields: ['leadTime', 'winRate', 'pipeline'],
      },
    },
  ],
  config: {
    theme: 'brand-a',
    layout: { width: 560, height: 360, padding: 20 },
  },
  a11y: {
    description: 'Scatterplot showing correlation between sales cycle length and win rate by segment, sized by pipeline value.',
    ariaLabel: 'Win rate vs lead time scatterplot',
    narrative: {
      summary: 'Enterprise deals close faster and with higher win rates; growth deals slow down and drop below 35%.',
      keyFindings: ['Enterprise maintains 44-46% win rate under 12 weeks', 'Growth dips below 30% past 16 weeks'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Opportunities by lead time, win rate, and pipeline value',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['segment', 'leadTime', 'winRate', 'pipeline'],
    preferredRenderer: 'vega-lite',
  },
};

export function createScatterChartSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_SCATTER_SPEC, overrides);
}

export function createDenseScatterSpec(points: number = 650): NormalizedVizSpec {
  const values = Array.from({ length: points }, (_, index) => ({
    leadTime: 8 + (index % 24),
    winRate: 25 + Math.round((index % 50) * 0.6),
    pipeline: 400000 + index * 750,
    segment: index % 3 === 0 ? 'Enterprise' : index % 2 === 0 ? 'Mid-Market' : 'Growth',
  }));

  return createScatterChartSpec({
    id: `tests:viz:scatter-chart:dense:${points}`,
    data: { values },
    portability: {
      fallbackType: 'table',
      tableColumnOrder: ['segment', 'leadTime', 'winRate', 'pipeline'],
      preferredRenderer: 'echarts',
    },
  });
}
