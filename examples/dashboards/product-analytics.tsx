import type { FC, JSX } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';
import { Heatmap } from '../../src/components/viz/Heatmap.js';
import { ScatterChart } from '../../src/components/viz/ScatterChart.js';
import { VizFacetGrid } from '../../src/components/viz/VizFacetGrid.js';
import {
  createChartRegionExtensions,
  type ChartPanelDefinition,
} from '../../src/contexts/regions/chart-regions.js';
import { Text } from '../../src/components/base/Text.js';
import type { DashboardExample } from './user-adoption.js';

export interface ProductDashboardMetrics {
  readonly adoptionScore: number;
  readonly usageDelta: number;
  readonly csat: number;
  readonly featureCoverage: number;
}

export interface ProductDashboardRecord {
  readonly product_id: string;
  readonly name: string;
  readonly category: string;
  readonly metrics: ProductDashboardMetrics;
  readonly insights: readonly string[];
  readonly usageSpec: NormalizedVizSpec;
  readonly satisfactionSpec: NormalizedVizSpec;
  readonly pipelineSpec: NormalizedVizSpec;
}

const PRODUCT_PANELS: ChartPanelDefinition<ProductDashboardRecord>[] = [
  {
    id: 'product:usage-grid',
    title: 'Feature usage grid',
    description: 'Segment × capability heatmap',
    render: ({ data }) => <Heatmap spec={data.usageSpec} />,
  },
  {
    id: 'product:satisfaction',
    title: 'Satisfaction vs usage',
    description: 'Scatter highlighting outliers',
    render: ({ data }) => <ScatterChart spec={data.satisfactionSpec} />,
  },
  {
    id: 'product:pipeline',
    title: 'Release readiness',
    description: 'Facet grid across epic streams',
    render: ({ data }) => <VizFacetGrid spec={data.pipelineSpec} showLegend={false} />,
  },
];

function createProductDashboardTrait(): TraitAdapter<ProductDashboardRecord> {
  return {
    id: 'ProductDashboardPanels',
    view: () =>
      createChartRegionExtensions<ProductDashboardRecord>({
        traitId: 'ProductDashboardPanels',
        variant: 'dashboard',
        hero: ({ data }) => <ProductHero metrics={data.metrics} />,
        toolbar: () => <ProductToolbar />,
        insights: ({ data }) => <ProductInsights insights={data.insights} />,
        panels: PRODUCT_PANELS,
      }),
  };
}

const PRODUCT_DASHBOARD_OBJECT: ObjectSpec<ProductDashboardRecord> = {
  id: 'object:ProductDashboard',
  name: 'Product Analytics',
  version: '1.0.0',
  traits: [createProductDashboardTrait()],
  metadata: {
    category: 'product',
    status: 'experimental',
  },
};

export function createProductDashboardExample(): DashboardExample<ProductDashboardRecord> {
  return {
    object: PRODUCT_DASHBOARD_OBJECT,
    data: PRODUCT_DASHBOARD_DATA,
  };
}

export function ProductDashboardPreview(): JSX.Element {
  const { object, data } = createProductDashboardExample();
  const DashboardRender = RenderObject as FC<RenderObjectProps<ProductDashboardRecord>>;
  return <DashboardRender context="dashboard" object={object} data={data} />;
}

function ProductHero({ metrics }: { readonly metrics: ProductDashboardMetrics }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Adoption score" value={`${metrics.adoptionScore.toFixed(1)}/5`} />
      <Metric label="Usage delta" value={`${metrics.usageDelta.toFixed(1)}%`} hint="QoQ" />
      <Metric label="CSAT" value={`${metrics.csat.toFixed(1)} / 5`} />
      <Metric label="Feature coverage" value={`${metrics.featureCoverage}%`} />
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text as="span" size="lg" weight="semibold">
        {value}
      </Text>
      {hint ? (
        <Text as="span" size="sm" className="text-emerald-600 dark:text-emerald-400">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

function ProductToolbar(): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] dark:border-slate-700 dark:bg-slate-900"
      >
        All cohorts
      </button>
      <button
        type="button"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] dark:border-slate-700 dark:bg-slate-900"
      >
        Net new
      </button>
      <button
        type="button"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] dark:border-slate-700 dark:bg-slate-900"
      >
        Expansion
      </button>
    </div>
  );
}

function ProductInsights({ insights }: { readonly insights: readonly string[] }): JSX.Element {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <Text as="h3" size="md" weight="semibold">
        Observations
      </Text>
      {insights.map((entry) => (
        <p key={entry}>{entry}</p>
      ))}
    </div>
  );
}

const usageSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:product:usage-heatmap',
  name: 'Feature usage',
  data: {
    values: [
      { segment: 'Enterprise', capability: 'Automation', intensity: 0.92 },
      { segment: 'Enterprise', capability: 'AI suggestions', intensity: 0.81 },
      { segment: 'Enterprise', capability: 'Workflows', intensity: 0.77 },
      { segment: 'Growth', capability: 'Automation', intensity: 0.74 },
      { segment: 'Growth', capability: 'AI suggestions', intensity: 0.68 },
      { segment: 'Growth', capability: 'Workflows', intensity: 0.59 },
      { segment: 'SMB', capability: 'Automation', intensity: 0.55 },
      { segment: 'SMB', capability: 'AI suggestions', intensity: 0.49 },
      { segment: 'SMB', capability: 'Workflows', intensity: 0.42 }
    ],
  },
  marks: [
    {
      trait: 'MarkRect',
      encodings: {
        x: { field: 'capability', trait: 'EncodingPositionX', channel: 'x', title: 'Capability' },
        y: { field: 'segment', trait: 'EncodingPositionY', channel: 'y', title: 'Segment' },
        color: {
          field: 'intensity',
          trait: 'EncodingColor',
          channel: 'color',
          title: 'Usage',
        },
      },
    },
  ],
  encoding: {
    x: { field: 'capability', trait: 'EncodingPositionX', channel: 'x' },
    y: { field: 'segment', trait: 'EncodingPositionY', channel: 'y' },
    color: {
      field: 'intensity',
      trait: 'EncodingColor',
      channel: 'color',
      title: 'Usage',
    },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 420, height: 240, padding: 16 },
  },
  a11y: {
    description: 'Heatmap showing automation usage highest among enterprise and lowest for SMB.',
    ariaLabel: 'Feature usage heatmap',
  },
};

const satisfactionSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:product:satisfaction-scatter',
  name: 'Usage vs satisfaction',
  data: {
    values: [
      { feature: 'Automation', usage: 82, csat: 4.6 },
      { feature: 'AI suggestions', usage: 69, csat: 4.2 },
      { feature: 'Workflows', usage: 58, csat: 4.0 },
      { feature: 'Reporting', usage: 45, csat: 3.7 },
      { feature: 'Mobile app', usage: 33, csat: 3.2 }
    ],
  },
  marks: [
    {
      trait: 'MarkPoint',
      encodings: {
        x: {
          field: 'usage',
          trait: 'EncodingPositionX',
          channel: 'x',
          title: 'Usage %',
        },
        y: {
          field: 'csat',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'CSAT',
        },
        size: {
          field: 'usage',
          trait: 'EncodingSize',
          channel: 'size',
          title: 'Usage weight',
        },
        color: {
          field: 'feature',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Feature' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'usage', trait: 'EncodingPositionX', channel: 'x', title: 'Usage %' },
    y: { field: 'csat', trait: 'EncodingPositionY', channel: 'y', title: 'CSAT' },
    size: { field: 'usage', trait: 'EncodingSize', channel: 'size', title: 'Usage weight' },
    color: { field: 'feature', trait: 'EncodingColor', channel: 'color', legend: { title: 'Feature' } },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 460, height: 260, padding: 18 },
  },
  a11y: {
    description: 'Scatter plot showing automation as a strong outlier with high usage and CSAT.',
    ariaLabel: 'Usage vs satisfaction plot',
  },
};

const pipelineSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:product:pipeline-facet',
  name: 'Release readiness',
  data: {
    values: [
      { epic: 'AI Extensions', track: 'Design', milestone: 'M2', completion: 65 },
      { epic: 'AI Extensions', track: 'Engineering', milestone: 'M2', completion: 52 },
      { epic: 'AI Extensions', track: 'QA', milestone: 'M2', completion: 34 },
      { epic: 'Workflow Builder', track: 'Design', milestone: 'M3', completion: 78 },
      { epic: 'Workflow Builder', track: 'Engineering', milestone: 'M3', completion: 71 },
      { epic: 'Workflow Builder', track: 'QA', milestone: 'M3', completion: 60 },
      { epic: 'Reporting 2.0', track: 'Design', milestone: 'M1', completion: 44 },
      { epic: 'Reporting 2.0', track: 'Engineering', milestone: 'M1', completion: 33 },
      { epic: 'Reporting 2.0', track: 'QA', milestone: 'M1', completion: 18 }
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'track', trait: 'EncodingPositionX', channel: 'x', title: 'Track' },
        y: {
          field: 'completion',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Completion %',
        },
        color: {
          field: 'track',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Track' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'track', trait: 'EncodingPositionX', channel: 'x' },
    y: { field: 'completion', trait: 'EncodingPositionY', channel: 'y', title: 'Completion %' },
    color: { field: 'track', trait: 'EncodingColor', channel: 'color', legend: { title: 'Track' } },
  },
  layout: {
    trait: 'LayoutFacet',
    rows: { field: 'epic', title: 'Epic' },
    columns: { field: 'milestone', title: 'Milestone' },
    gap: 8,
  },
  config: {
    theme: 'brand-a',
    layout: { width: 420, height: 260, padding: 16 },
  },
  a11y: {
    description: 'Facet grid summarising completion across epics and milestones.',
    ariaLabel: 'Release readiness facet grid',
  },
};

const PRODUCT_DASHBOARD_DATA: ProductDashboardRecord = {
  product_id: 'prod_analytics:2025',
  name: 'OODS Analytics Suite',
  category: 'Analytics',
  metrics: {
    adoptionScore: 4.3,
    usageDelta: 9.8,
    csat: 4.2,
    featureCoverage: 78,
  },
  insights: [
    'Automation continues to lead activation; invest in SMB onboarding to unlock channel parity.',
    'Reporting 2.0 needs design bandwidth to unblock engineering, currently lagging by two sprints.',
    'Mobile app CSAT remains below target due to offline gaps; coordinate with platform team.',
  ],
  usageSpec,
  satisfactionSpec,
  pipelineSpec,
};
