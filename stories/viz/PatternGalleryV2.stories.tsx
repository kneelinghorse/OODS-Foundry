import type { Meta, StoryObj } from '@storybook/react';
import React, { useMemo } from 'react';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec.js';
import { chartPatterns } from '~/src/viz/patterns/index.js';
import { scoreResponsiveStrategies } from '~/src/viz/patterns/responsive-scorer.js';
import { BarChart } from '~/src/components/viz/BarChart';
import { LineChart } from '~/src/components/viz/LineChart';
import { AreaChart } from '~/src/components/viz/AreaChart';
import { ScatterChart } from '~/src/components/viz/ScatterChart';
import { BubbleChart } from '~/src/components/viz/BubbleChart';
import { Heatmap } from '~/src/components/viz/Heatmap';

type ResponsiveViewport = 'mobile' | 'tablet' | 'desktop';

interface PatternGalleryV2Props {
  viewport?: ResponsiveViewport;
}

interface PatternCard {
  readonly pattern: (typeof chartPatterns)[number];
  readonly spec: NormalizedVizSpec;
  readonly ChartComponent: typeof BarChart;
  readonly recipe: ReturnType<typeof scoreResponsiveStrategies>['recipes'][number];
}

const componentMap = {
  bar: BarChart,
  line: LineChart,
  area: AreaChart,
  scatter: ScatterChart,
  heatmap: Heatmap,
} as const;

const specModules = import.meta.glob<NormalizedVizSpec>('../../examples/viz/patterns-v2/*.spec.json', {
  eager: true,
  import: 'default',
});

function resolveSpec(pattern: (typeof chartPatterns)[number]): NormalizedVizSpec | undefined {
  const normalizedPath = pattern.specPath.startsWith('examples/')
    ? `../../${pattern.specPath}`
    : pattern.specPath;
  return specModules[normalizedPath];
}

function buildSchemaFromPattern(pattern: (typeof chartPatterns)[number]) {
  return {
    measures: pattern.heuristics.measures.min,
    dimensions: pattern.heuristics.dimensions.min,
    temporals: pattern.heuristics.temporals?.min,
    goal: pattern.heuristics.goal,
    stacking: pattern.heuristics.stacking,
    matrix: pattern.heuristics.matrix,
    partToWhole: pattern.heuristics.partToWhole,
    multiMetrics: pattern.heuristics.multiMetrics,
    requiresGrouping: pattern.heuristics.requiresGrouping,
    allowNegative: pattern.heuristics.allowNegative,
    density: pattern.heuristics.density,
  };
}

const viewportMaxWidth: Record<ResponsiveViewport, string> = {
  mobile: 'max-w-[420px]',
  tablet: 'max-w-[820px]',
  desktop: 'max-w-full',
};

export function PatternGalleryV2({ viewport = 'desktop' }: PatternGalleryV2Props): JSX.Element {
  const cards = useMemo<PatternCard[]>(() => {
    return chartPatterns
      .map((pattern) => {
        const spec = resolveSpec(pattern);
        const ChartComponent =
          pattern.id === 'bubble-distribution'
            ? BubbleChart
            : componentMap[pattern.chartType as keyof typeof componentMap];
        if (!ChartComponent || !spec) {
          return null;
        }
        const schema = buildSchemaFromPattern(pattern);
        const responsive = scoreResponsiveStrategies(pattern.id, schema);
        const recipe = responsive.recipes.find((entry) => entry.breakpoint === viewport) ?? responsive.recipes[0];
        return { pattern, spec, ChartComponent, recipe };
      })
      .filter((entry): entry is PatternCard => Boolean(entry));
  }, [viewport]);

  return (
    <div className="space-y-8">
      {cards.map(({ pattern, spec, ChartComponent, recipe }) => (
        <section
          key={pattern.id}
          className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${viewportMaxWidth[viewport]}`}
        >
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">{pattern.chartType}</p>
              <h3 className="text-xl font-semibold text-neutral-900">{pattern.name}</h3>
              <p className="text-sm text-neutral-600">{pattern.summary}</p>
            </div>
            <p className="text-xs text-neutral-500">
              <strong>Schema:</strong> {pattern.schema.structure} · <strong>Confidence:</strong>{' '}
              {pattern.confidence.score.toFixed(2)} ({pattern.confidence.level}) · <strong>Spec:</strong>{' '}
              <code>{pattern.specPath}</code>
            </p>
            <p className="text-xs text-neutral-500">
              <strong>Responsive ({recipe.breakpoint}):</strong> {recipe.layout} layout · score{' '}
              {(recipe.score * 100).toFixed(0)}%
            </p>
            <ul className="list-disc pl-5 text-xs text-neutral-500">
              {recipe.adjustments.map((adjustment) => (
                <li key={`${pattern.id}-${adjustment.action}`}>{adjustment.description}</li>
              ))}
            </ul>
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <ChartComponent spec={spec} showDescription={false} showTable={false} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof PatternGalleryV2> = {
  title: 'Visualization/Patterns/Responsive Library',
  component: PatternGalleryV2,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'responsive',
    },
    docs: {
      description: {
        component:
          'Curated gallery that renders every v2 pattern spec from `examples/viz/patterns-v2`. Use the viewport control to emulate breakpoints and inspect the responsive recipe guidance for each pattern.',
      },
    },
  },
  argTypes: {
    viewport: {
      options: ['mobile', 'tablet', 'desktop'],
      control: { type: 'inline-radio' },
      description: 'Virtual viewport sizing + responsive recipe context.',
    },
  },
};

export default meta;

type Story = StoryObj<typeof PatternGalleryV2>;

export const Gallery: Story = {
  name: 'Responsive Pattern Gallery',
  args: {
    viewport: 'desktop',
  },
};
