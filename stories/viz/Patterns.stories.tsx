import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentType, JSX } from 'react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { chartPatterns } from '~/src/viz/patterns/index.js';
import { BarChart } from '~/src/components/viz/BarChart';
import { LineChart } from '~/src/components/viz/LineChart';
import { AreaChart } from '~/src/components/viz/AreaChart';
import { ScatterChart } from '~/src/components/viz/ScatterChart';
import { BubbleChart } from '~/src/components/viz/BubbleChart';
import { Heatmap } from '~/src/components/viz/Heatmap';

import groupedBar from '../../examples/viz/patterns/grouped-bar.spec.json';
import stackedBar from '../../examples/viz/patterns/stacked-bar.spec.json';
import stacked100 from '../../examples/viz/patterns/stacked-100-bar.spec.json';
import divergingBar from '../../examples/viz/patterns/diverging-bar.spec.json';
import multiSeriesLine from '../../examples/viz/patterns/multi-series-line.spec.json';
import targetBand from '../../examples/viz/patterns/target-band-line.spec.json';
import runningArea from '../../examples/viz/patterns/running-total-area.spec.json';
import bubble from '../../examples/viz/patterns/bubble-distribution.spec.json';
import correlationScatter from '../../examples/viz/patterns/correlation-scatter.spec.json';
import timeGrid from '../../examples/viz/patterns/time-grid-heatmap.spec.json';
import correlationMatrix from '../../examples/viz/patterns/correlation-matrix.spec.json';

const specs: Record<string, NormalizedVizSpec> = {
  'grouped-bar': groupedBar as NormalizedVizSpec,
  'stacked-bar': stackedBar as NormalizedVizSpec,
  'stacked-100-bar': stacked100 as NormalizedVizSpec,
  'diverging-bar': divergingBar as NormalizedVizSpec,
  'multi-series-line': multiSeriesLine as NormalizedVizSpec,
  'target-band-line': targetBand as NormalizedVizSpec,
  'running-total-area': runningArea as NormalizedVizSpec,
  'bubble-distribution': bubble as NormalizedVizSpec,
  'correlation-scatter': correlationScatter as NormalizedVizSpec,
  'time-grid-heatmap': timeGrid as NormalizedVizSpec,
  'correlation-matrix': correlationMatrix as NormalizedVizSpec,
};

const componentMap: Record<string, ComponentType<{ spec: NormalizedVizSpec; showDescription?: boolean; showTable?: boolean }>> = {
  bar: BarChart,
  line: LineChart,
  area: AreaChart,
  scatter: ScatterChart,
  heatmap: Heatmap,
};

function PatternGallery(): JSX.Element {
  return (
    <div className="space-y-12">
      {chartPatterns.map((pattern) => {
        const spec = specs[pattern.id];
        if (!spec) {
          return (
            <section key={pattern.id}>
              <h3>{pattern.name}</h3>
              <p className="text-sm text-red-600">Missing spec file: {pattern.specPath}</p>
            </section>
          );
        }
        const ChartComponent = pattern.id === 'bubble-distribution' ? BubbleChart : componentMap[pattern.chartType];
        if (!ChartComponent) {
          return null;
        }
        return (
          <section key={pattern.id} className="space-y-3">
            <div>
              <h3 className="text-xl font-semibold">{pattern.name}</h3>
              <p className="text-neutral-600">{pattern.summary}</p>
            </div>
            <p className="text-sm text-neutral-500">
              <strong>Schema:</strong> {pattern.schema.structure} · <strong>Confidence:</strong>{' '}
              {pattern.confidence.score.toFixed(2)} ({pattern.confidence.level}) · <strong>Spec:</strong>{' '}
              <code>{pattern.specPath}</code>
            </p>
            <p className="text-sm text-neutral-500">
              <strong>Best for:</strong> {pattern.usage.bestFor.join('; ')}
            </p>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <ChartComponent spec={spec} showDescription={false} showTable={false} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

const meta: Meta<typeof PatternGallery> = {
  title: 'Visualization/Patterns/Library',
  component: PatternGallery,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Trait-aware gallery powered by the chart pattern registry. Each section renders the canonical spec from `examples/viz/patterns`.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof PatternGallery>;

export const Gallery: Story = {
  name: 'Chart Pattern Library',
  render: () => <PatternGallery />,
};
