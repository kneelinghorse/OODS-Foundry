import type { FC, JSX } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import type { SubscriptionRecord } from '../../src/objects/subscription/types.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';
import { AreaChart } from '../../src/components/viz/AreaChart.js';
import { LineChart } from '../../src/components/viz/LineChart.js';
import { VizLayeredView } from '../../src/components/viz/VizLayeredView.js';
import {
  createChartRegionExtensions,
  type ChartPanelDefinition,
} from '../../src/contexts/regions/chart-regions.js';
import { Text } from '../../src/components/base/Text.js';
import activeSubscription from '../../src/fixtures/subscription/active.json' assert { type: 'json' };
import type { DashboardExample } from './user-adoption.js';
import { createSubscriptionStatefulTraitAdapter } from '../../src/traits/Stateful/view.js';
import { createCancellableTraitAdapter } from '../../src/traits/Cancellable/view.js';
import { createSubscriptionTimestampableTraitAdapter } from '../../src/traits/Timestampable/view.js';
import { createBillableTraitAdapter } from '../../src/traits/Billable/view.js';
import { createTaggableTraitAdapter } from '../../src/traits/Taggable/view.js';

export interface SubscriptionDashboardMetrics {
  readonly arr: number;
  readonly netExpansion: number;
  readonly churnRisk: number;
  readonly seats: number;
}

export interface SubscriptionDashboardRecord extends SubscriptionRecord {
  readonly metrics: SubscriptionDashboardMetrics;
  readonly insights: readonly string[];
  readonly revenueSpec: NormalizedVizSpec;
  readonly churnSpec: NormalizedVizSpec;
  readonly mixSpec: NormalizedVizSpec;
}

const SUBSCRIPTION_PANELS: ChartPanelDefinition<SubscriptionDashboardRecord>[] = [
  {
    id: 'subscription:revenue',
    title: 'Recurring revenue',
    description: 'Stacked view by revenue source',
    render: ({ data }) => <AreaChart spec={data.revenueSpec} showDescription={false} />,
  },
  {
    id: 'subscription:churn',
    title: 'Churn outlook',
    description: 'Modeled churn risk vs mitigations',
    render: ({ data }) => <VizLayeredView spec={data.churnSpec} />,
  },
  {
    id: 'subscription:mix',
    title: 'Plan mix',
    description: 'Seat distribution by plan family',
    render: ({ data }) => <LineChart spec={data.mixSpec} showDescription={false} />,
    footer: ({ data }) => (
      <span>
        Active seats <strong>{data.metrics.seats}</strong>
      </span>
    ),
  },
];

function createSubscriptionDashboardTrait(): TraitAdapter<SubscriptionDashboardRecord> {
  return {
    id: 'SubscriptionDashboardPanels',
    view: () =>
      createChartRegionExtensions<SubscriptionDashboardRecord>({
        traitId: 'SubscriptionDashboardPanels',
        variant: 'dashboard',
        hero: ({ data }) => <SubscriptionHero metrics={data.metrics} />,
        toolbar: () => <SubscriptionToolbar />,
        insights: ({ data }) => <SubscriptionInsights insights={data.insights} />,
        panels: SUBSCRIPTION_PANELS,
      }),
  };
}

function createSubscriptionDashboardObject(): ObjectSpec<SubscriptionDashboardRecord> {
  return {
    id: 'object:SubscriptionDashboard',
    name: 'Subscription Dashboard',
    version: '1.0.0',
    traits: [
      createSubscriptionStatefulTraitAdapter<SubscriptionDashboardRecord>(),
      createCancellableTraitAdapter<SubscriptionDashboardRecord>(),
      createBillableTraitAdapter<SubscriptionDashboardRecord>(),
      createSubscriptionTimestampableTraitAdapter<SubscriptionDashboardRecord>(),
      createTaggableTraitAdapter<SubscriptionDashboardRecord>(),
      createSubscriptionDashboardTrait(),
    ],
    metadata: {
      category: 'billing',
      status: 'internal',
    },
  };
}

export function createSubscriptionDashboardExample(): DashboardExample<SubscriptionDashboardRecord> {
  return {
    object: createSubscriptionDashboardObject(),
    data: SUBSCRIPTION_DASHBOARD_DATA,
  };
}

export function SubscriptionDashboardPreview(): JSX.Element {
  const { object, data } = createSubscriptionDashboardExample();
  const DashboardRender = RenderObject as FC<RenderObjectProps<SubscriptionDashboardRecord>>;
  return <DashboardRender context="dashboard" object={object} data={data} />;
}

function SubscriptionHero({ metrics }: { readonly metrics: SubscriptionDashboardMetrics }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="ARR" value={`$${(metrics.arr / 1_000_000).toFixed(1)}M`} hint="+18% YoY" />
      <Metric label="Net expansion" value={`${metrics.netExpansion.toFixed(1)}%`} hint="Target ≥ 115%" />
      <Metric label="Churn risk" value={`${metrics.churnRisk.toFixed(1)}%`} hint="Forecast" />
      <Metric label="Active seats" value={metrics.seats.toLocaleString()} />
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
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

function SubscriptionToolbar(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-slate-600 dark:text-slate-300">
        Scenario
        <select className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="conservative">Conservative</option>
          <option value="baseline">Baseline</option>
          <option value="accelerated">Accelerated</option>
        </select>
      </label>
      <label className="text-sm text-slate-600 dark:text-slate-300">
        Currency
        <select className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="usd">USD</option>
          <option value="eur">EUR</option>
          <option value="gbp">GBP</option>
        </select>
      </label>
    </div>
  );
}

function SubscriptionInsights({ insights }: { readonly insights: readonly string[] }): JSX.Element {
  return (
    <div className="space-y-3">
      <Text as="h3" size="md" weight="semibold">
        Risk watch
      </Text>
      <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {insights.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ol>
    </div>
  );
}

const revenueSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:subscription:revenue-area',
  name: 'Recurring revenue',
  data: {
    values: [
      { month: '2025-04', source: 'New business', value: 310_000 },
      { month: '2025-04', source: 'Expansion', value: 220_000 },
      { month: '2025-04', source: 'Renewal', value: 580_000 },
      { month: '2025-05', source: 'New business', value: 330_000 },
      { month: '2025-05', source: 'Expansion', value: 240_000 },
      { month: '2025-05', source: 'Renewal', value: 600_000 },
      { month: '2025-06', source: 'New business', value: 345_000 },
      { month: '2025-06', source: 'Expansion', value: 255_000 },
      { month: '2025-06', source: 'Renewal', value: 612_000 }
    ],
  },
  marks: [
    {
      trait: 'MarkArea',
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'Month',
        },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          title: 'USD',
        },
        color: {
          field: 'source',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Source' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal' },
    y: { field: 'value', trait: 'EncodingPositionY', channel: 'y', title: 'USD' },
    color: { field: 'source', trait: 'EncodingColor', channel: 'color', legend: { title: 'Source' } },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 540, height: 280, padding: 20 },
  },
  a11y: {
    description: 'Stacked area chart showing new, expansion, and renewal revenue growth over three months.',
    ariaLabel: 'Recurring revenue stacked area chart',
  },
};

const churnSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:subscription:churn-layered',
  name: 'Churn outlook',
  data: {
    values: [
      { stage: 'Discovery', cohort: 'At risk', value: 18 },
      { stage: 'Enablement', cohort: 'At risk', value: 12 },
      { stage: 'Adoption', cohort: 'At risk', value: 8 },
      { stage: 'Discovery', cohort: 'Mitigated', value: 6 },
      { stage: 'Enablement', cohort: 'Mitigated', value: 9 },
      { stage: 'Adoption', cohort: 'Mitigated', value: 12 }
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'stage', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending' },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Accounts',
        },
        color: {
          field: 'cohort',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Cohort' },
        },
      },
      options: {
        dodge: true,
      },
    },
  ],
  encoding: {
    x: { field: 'stage', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending' },
    y: { field: 'value', trait: 'EncodingPositionY', channel: 'y', title: 'Accounts' },
    color: { field: 'cohort', trait: 'EncodingColor', channel: 'color', legend: { title: 'Cohort' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 420, height: 260, padding: 18 },
  },
  a11y: {
    description: 'Layered view comparing at-risk and mitigated accounts by lifecycle stage.',
    ariaLabel: 'Churn risk layered chart',
  },
};

const mixSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:subscription:plan-mix',
  name: 'Plan mix trajectory',
  data: {
    values: [
      { month: '2025-04', plan: 'Starter', seats: 1800 },
      { month: '2025-04', plan: 'Growth', seats: 2600 },
      { month: '2025-04', plan: 'Scale', seats: 1400 },
      { month: '2025-05', plan: 'Starter', seats: 1900 },
      { month: '2025-05', plan: 'Growth', seats: 2750 },
      { month: '2025-05', plan: 'Scale', seats: 1450 },
      { month: '2025-06', plan: 'Starter', seats: 2100 },
      { month: '2025-06', plan: 'Growth', seats: 2900 },
      { month: '2025-06', plan: 'Scale', seats: 1500 }
    ],
  },
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: {
          field: 'month',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'Month',
        },
        y: {
          field: 'seats',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Seats',
        },
        color: {
          field: 'plan',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Plan' },
        },
      },
      options: {
        curve: 'monotone',
      },
    },
  ],
  encoding: {
    x: { field: 'month', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal' },
    y: { field: 'seats', trait: 'EncodingPositionY', channel: 'y', title: 'Seats' },
    color: { field: 'plan', trait: 'EncodingColor', channel: 'color', legend: { title: 'Plan' } },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 460, height: 240, padding: 18 },
  },
  a11y: {
    description: 'Line chart showing seat growth across starter, growth, and scale plans.',
    ariaLabel: 'Plan mix trend chart',
  },
};

const baseSubscription = activeSubscription as SubscriptionRecord;

const SUBSCRIPTION_DASHBOARD_DATA: SubscriptionDashboardRecord = {
  ...baseSubscription,
  metrics: {
    arr: 9_800_000,
    netExpansion: 118.4,
    churnRisk: 2.2,
    seats: 5_500,
  },
  insights: [
    'Enablement-stage attrition is concentrated in the growth plan cohort; playbook refresh planned.',
    'Expansion revenue is pacing ahead of target but requires additional deployment engineers in APAC.',
    'Seat growth is absorbing available support hours; add 2 FTE to maintain SLA buffers.',
  ],
  revenueSpec,
  churnSpec,
  mixSpec,
};
