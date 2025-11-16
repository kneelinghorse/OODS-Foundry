import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';
import { mergeSpec } from './mergeSpec.js';

const BASE_SPEC: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'tests:viz:layered-view',
  name: 'Actuals vs Target',
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
      options: {
        id: 'forecast-band',
        title: 'Forecast band',
      },
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          title: 'Month',
        },
        y: {
          field: 'target',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Target',
        },
      },
    },
    {
      trait: 'MarkLine',
      options: {
        id: 'actuals-line',
        title: 'Actuals',
      },
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          title: 'Month',
        },
        y: {
          field: 'actual',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Actual (Index)',
          scale: 'linear',
        },
      },
    },
  ],
  encoding: {
    x: {
      field: 'month',
      trait: 'EncodingPositionX',
      channel: 'x',
      title: 'Month',
    },
    y: {
      field: 'actual',
      trait: 'EncodingPositionY',
      channel: 'y',
      title: 'Actual (Index)',
    },
  },
  layout: {
    trait: 'LayoutLayer',
    order: ['forecast-band', 'actuals-line'],
    sharedScales: { x: 'shared', y: 'shared' },
    blendMode: 'normal',
  },
  config: {
    theme: 'brand-a',
    layout: { width: 520, height: 320, padding: 16 },
  },
  a11y: {
    description: 'Layered line and area chart comparing actual performance against targets.',
    ariaLabel: 'Layered actual vs target chart',
    tableFallback: { enabled: true, caption: 'Layered data' },
  },
  portability: {
    tableColumnOrder: ['month', 'actual', 'target'],
  },
};

export function createLayeredViewSpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return mergeSpec(BASE_SPEC, overrides);
}
