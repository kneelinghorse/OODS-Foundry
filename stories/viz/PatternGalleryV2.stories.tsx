// @types/react 19 no longer declares a global JSX namespace; it is exported from 'react'.
import type { JSX } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import type { NormalizedVizSpec } from '@oods/viz-core';
import { chartPatterns, type PatternHeuristics } from '@oods/viz-core';
import {
  RESPONSIVE_BREAKPOINT_MIN_PX,
  scoreResponsiveStrategies,
} from '@oods/viz-core';
import { BarChart } from '~/src/components/viz/BarChart';
import { LineChart } from '~/src/components/viz/LineChart';
import { AreaChart } from '~/src/components/viz/AreaChart';
import { ScatterChart } from '~/src/components/viz/ScatterChart';
import { BubbleChart } from '~/src/components/viz/BubbleChart';
import { Heatmap } from '~/src/components/viz/Heatmap';

// Vite is transitive here, not a root-resolvable type package. Keep the augmentation local
// to the one eager/default glob shape this story executes instead of widening the story lens.
declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly eager: true; readonly import: 'default' },
    ): Record<string, T>;
  }
}

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
  // `chartPatterns` retains its literal registry union, so optional heuristic keys disappear
  // from members that omit them even though every member satisfies PatternHeuristics.
  const heuristics = pattern.heuristics as Pick<
    PatternHeuristics,
    'measures' | 'dimensions' | 'goal'
  > & Partial<PatternHeuristics>;

  return {
    measures: heuristics.measures.min,
    dimensions: heuristics.dimensions.min,
    temporals: heuristics.temporals?.min,
    goal: heuristics.goal,
    stacking: heuristics.stacking,
    matrix: heuristics.matrix,
    partToWhole: heuristics.partToWhole,
    multiMetrics: heuristics.multiMetrics,
    requiresGrouping: heuristics.requiresGrouping,
    allowNegative: heuristics.allowNegative,
    density: heuristics.density,
  };
}

/**
 * s173 m04 — the story's `viewport` arg now selects a REAL canvas width.
 *
 * It used to select a Tailwind `max-w-[…]` class, which framed the cards at 420/820px on a
 * canvas that stayed as wide as the browser. The recipes the gallery narrates are about what
 * a chart does at a breakpoint, so the arg has to move the breakpoint, not draw a margin.
 */
const VIEWPORT_GLOBALS: Record<ResponsiveViewport, string> = {
  mobile: 'oods-mobile',
  tablet: 'oods-tablet',
  desktop: 'oods-desktop',
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
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
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
              <strong>
                Responsive ({recipe.breakpoint} ≥ {RESPONSIVE_BREAKPOINT_MIN_PX[recipe.breakpoint]}px):
              </strong>{' '}
              {recipe.layout} layout · score {(recipe.score * 100).toFixed(0)}%
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
  globals: { viewport: { value: VIEWPORT_GLOBALS.desktop, isRotated: false } },
};

export const GalleryAtTablet: Story = {
  name: 'Responsive Pattern Gallery (tablet)',
  args: {
    viewport: 'tablet',
  },
  globals: { viewport: { value: VIEWPORT_GLOBALS.tablet, isRotated: false } },
};

export const GalleryAtMobile: Story = {
  name: 'Responsive Pattern Gallery (mobile)',
  args: {
    viewport: 'mobile',
  },
  globals: { viewport: { value: VIEWPORT_GLOBALS.mobile, isRotated: false } },
};
