import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_HEATMAP_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:heatmap',
  name: 'Support Load by Day and Hour',
  data: {
    values: [
      { day: 'Monday', hour: '08:00', tickets: 12 },
      { day: 'Monday', hour: '12:00', tickets: 26 },
      { day: 'Monday', hour: '16:00', tickets: 31 },
      { day: 'Tuesday', hour: '08:00', tickets: 15 },
      { day: 'Tuesday', hour: '12:00', tickets: 32 },
      { day: 'Tuesday', hour: '16:00', tickets: 28 },
      { day: 'Wednesday', hour: '08:00', tickets: 9 },
      { day: 'Wednesday', hour: '12:00', tickets: 22 },
      { day: 'Wednesday', hour: '16:00', tickets: 24 },
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: {
          field: 'hour',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'band',
          title: 'Hour of day',
        },
        y: {
          field: 'day',
          trait: 'EncodingPositionY',
          channel: 'y',
          scale: 'band',
          title: 'Day of week',
        },
        color: {
          field: 'tickets',
          trait: 'EncodingColor',
          channel: 'color',
          scale: 'linear',
          title: 'Tickets',
          legend: { title: 'Tickets' },
        },
      },
      options: {
        borderRadius: 4,
      },
    },
  ],
  encoding: {
    x: {
      field: 'hour',
      trait: 'EncodingPositionX',
      channel: 'x',
      scale: 'band',
      title: 'Hour of day',
    },
    y: {
      field: 'day',
      trait: 'EncodingPositionY',
      channel: 'y',
      scale: 'band',
      title: 'Day of week',
    },
    color: {
      field: 'tickets',
      trait: 'EncodingColor',
      channel: 'color',
      scale: 'linear',
      title: 'Tickets',
    },
  },
  interactions: [
    {
      id: 'cell-highlight',
      select: { type: 'point', on: 'hover', fields: ['day', 'hour'] },
      rule: {
        bindTo: 'visual',
        property: 'fillOpacity',
        condition: { value: 1 },
        else: { value: 0.35 },
      },
    },
    {
      id: 'cell-tooltip',
      select: { type: 'point', on: 'hover', fields: ['day', 'hour', 'tickets'] },
      rule: {
        bindTo: 'tooltip',
        fields: ['day', 'hour', 'tickets'],
      },
    },
  ],
  config: {
    theme: 'brand-a',
    layout: { width: 640, height: 420, padding: 24 },
  },
  a11y: {
    description: 'Heatmap showing support ticket volume by day of week and hour of day.',
    ariaLabel: 'Support load heatmap',
    narrative: {
      summary: 'Lunch hour spikes mid-week while mornings taper as the week progresses.',
      keyFindings: ['Tuesday lunch is busiest at 32 tickets', 'Wednesday mornings are the quietest'],
    },
    tableFallback: {
      enabled: true,
      caption: 'Ticket volume by day of week and hour of day',
    },
  },
  portability: {
    fallbackType: 'table',
    tableColumnOrder: ['day', 'hour', 'tickets'],
    preferredRenderer: 'vega-lite',
  },
};

export function createHeatmapSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_HEATMAP_SPEC, overrides);
}
