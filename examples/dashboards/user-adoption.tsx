import type { FC, JSX } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import type { UserRecord } from '../../src/objects/user/types.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';
import { VizFacetGrid } from '../../src/components/viz/VizFacetGrid.js';
import { LineChart } from '../../src/components/viz/LineChart.js';
import { BarChart } from '../../src/components/viz/BarChart.js';
import {
  createChartRegionExtensions,
  type ChartPanelDefinition,
} from '../../src/contexts/regions/chart-regions.js';
import { Text } from '../../src/components/base/Text.js';
import activeUser from '../../src/fixtures/user/active.json' assert { type: 'json' };
import { createStatefulTraitAdapter } from '../../src/traits/Stateful/view.js';
import { createTimestampableTraitAdapter } from '../../src/traits/Timestampable/view.js';
import { createTaggableTraitAdapter } from '../../src/traits/Taggable/view.js';

export interface DashboardExample<Data> {
  readonly object: ObjectSpec<Data>;
  readonly data: Data;
}

export interface UserDashboardMetrics {
  readonly activeUsers: number;
  readonly adoptionDelta: number;
  readonly retentionAvg: number;
  readonly activeRegions: number;
}

export interface UserDashboardRecord extends UserRecord {
  readonly metrics: UserDashboardMetrics;
  readonly insights: readonly string[];
  readonly adoptionSpec: NormalizedVizSpec;
  readonly retentionSpec: NormalizedVizSpec;
  readonly sentimentSpec: NormalizedVizSpec;
}

const USER_DASHBOARD_PANELS: ChartPanelDefinition<UserDashboardRecord>[] = [
  {
    id: 'user-dashboard:adoption-grid',
    title: 'Activation coverage',
    description: 'Facet grid by region × segment',
    render: ({ data }) => <VizFacetGrid spec={data.adoptionSpec} showDescription={false} />,
  },
  {
    id: 'user-dashboard:retention',
    title: 'Weekly retention',
    description: 'Rolling eight-week trend',
    render: ({ data }) => <LineChart spec={data.retentionSpec} showTable={false} />,
    footer: ({ data }) => (
      <span>
        Trailing average{' '}
        <strong>{data.metrics.retentionAvg.toFixed(1)}%</strong>
      </span>
    ),
  },
  {
    id: 'user-dashboard:sentiment',
    title: 'Channel sentiment',
    description: 'Survey responses by channel',
    render: ({ data }) => <BarChart spec={data.sentimentSpec} showTable={false} />,
  },
];

function createUserDashboardTrait(): TraitAdapter<UserDashboardRecord> {
  return {
    id: 'UserDashboardPanels',
    view: () =>
      createChartRegionExtensions<UserDashboardRecord>({
        traitId: 'UserDashboardPanels',
        variant: 'dashboard',
        hero: ({ data }) => <UserDashboardHero metrics={data.metrics} />,
        toolbar: () => <UserDashboardToolbar />,
        insights: ({ data }) => <InsightList insights={data.insights} />,
        panels: USER_DASHBOARD_PANELS,
      }),
  };
}

function createUserDashboardObject(): ObjectSpec<UserDashboardRecord> {
  return {
    id: 'object:UserDashboard',
    name: 'User Dashboard',
    version: '1.0.0',
    traits: [
      createStatefulTraitAdapter<UserDashboardRecord>(),
      createTimestampableTraitAdapter<UserDashboardRecord>(),
      createTaggableTraitAdapter<UserDashboardRecord>(),
      createUserDashboardTrait(),
    ],
    metadata: {
      category: 'identity',
      status: 'internal',
    },
  };
}

export function createUserDashboardExample(): DashboardExample<UserDashboardRecord> {
  return {
    object: createUserDashboardObject(),
    data: USER_DASHBOARD_DATA,
  };
}

export function UserDashboardPreview(): JSX.Element {
  const { object, data } = createUserDashboardExample();
  const DashboardRender = RenderObject as FC<RenderObjectProps<UserDashboardRecord>>;
  return <DashboardRender context="dashboard" object={object} data={data} />;
}

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly trend?: string;
}

function MetricCard({ label, value, trend }: MetricCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <Text as="span" size="lg" weight="semibold">
        {value}
      </Text>
      {trend ? (
        <Text as="span" size="sm" className="text-emerald-600 dark:text-emerald-400">
          {trend}
        </Text>
      ) : null}
    </div>
  );
}

function UserDashboardHero({ metrics }: { readonly metrics: UserDashboardMetrics }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-dashboard-hero="user">
      <MetricCard
        label="Active users"
        value={metrics.activeUsers.toLocaleString()}
        trend={`+${metrics.adoptionDelta}% vs last month`}
      />
      <MetricCard label="Retention avg" value={`${metrics.retentionAvg.toFixed(1)}%`} />
      <MetricCard label="Active regions" value={metrics.activeRegions.toString()} />
      <MetricCard label="SLA breaches" value="0" trend="No incidents in 45 days" />
    </div>
  );
}

function UserDashboardToolbar(): JSX.Element {
  const filters = ['Last 30 days', 'Quarter to date', 'FY 2025'];
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          className="rounded-xl border border-slate-300/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

function InsightList({ insights }: { readonly insights: readonly string[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-3" data-dashboard-insights="user">
      <Text as="h3" size="md" weight="semibold">
        Narrative highlights
      </Text>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {insights.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

const adoptionSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:user:adoption-facet',
  name: 'Activation coverage by region and segment',
  data: {
    values: [
      { region: 'North America', segment: 'Enterprise', metric: 'Activation', value: 78 },
      { region: 'North America', segment: 'Growth', metric: 'Activation', value: 65 },
      { region: 'North America', segment: 'Enterprise', metric: 'Target', value: 84 },
      { region: 'North America', segment: 'Growth', metric: 'Target', value: 68 },
      { region: 'EMEA', segment: 'Enterprise', metric: 'Activation', value: 71 },
      { region: 'EMEA', segment: 'Growth', metric: 'Activation', value: 59 },
      { region: 'EMEA', segment: 'Enterprise', metric: 'Target', value: 76 },
      { region: 'EMEA', segment: 'Growth', metric: 'Target', value: 61 },
      { region: 'APAC', segment: 'Enterprise', metric: 'Activation', value: 69 },
      { region: 'APAC', segment: 'Growth', metric: 'Activation', value: 63 },
      { region: 'APAC', segment: 'Enterprise', metric: 'Target', value: 72 },
      { region: 'APAC', segment: 'Growth', metric: 'Target', value: 64 }
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: {
          field: 'metric',
          trait: 'EncodingPositionX',
          channel: 'x',
          sort: 'ascending',
          title: 'Metric',
        },
        y: {
          field: 'value',
          trait: 'EncodingPositionY',
          channel: 'y',
          aggregate: 'sum',
          title: 'Coverage (%)',
        },
        color: {
          field: 'metric',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Series' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'metric', trait: 'EncodingPositionX', channel: 'x', sort: 'ascending' },
    y: {
      field: 'value',
      trait: 'EncodingPositionY',
      channel: 'y',
      aggregate: 'sum',
      title: 'Coverage (%)',
    },
    color: { field: 'metric', trait: 'EncodingColor', channel: 'color', legend: { title: 'Series' } },
  },
  layout: {
    trait: 'LayoutFacet',
    rows: { field: 'region', title: 'Region' },
    columns: { field: 'segment', title: 'Segment' },
    gap: 12,
    sharedScales: { x: 'shared', y: 'shared', color: 'shared' },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 320, height: 240, padding: 18 },
  },
  a11y: {
    description: 'Facet grid comparing activation against target by region and segment.',
    ariaLabel: 'Activation facet grid',
  },
};

const retentionSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:user:retention-line',
  name: 'Weekly retention trend',
  data: {
    values: [
      { week: '2025-08-04', retention: 91 },
      { week: '2025-08-11', retention: 92 },
      { week: '2025-08-18', retention: 93 },
      { week: '2025-08-25', retention: 92 },
      { week: '2025-09-01', retention: 94 },
      { week: '2025-09-08', retention: 95 },
      { week: '2025-09-15', retention: 95.3 },
      { week: '2025-09-22', retention: 95.8 }
    ],
  },
  marks: [
    {
      trait: 'MarkLine',
      encodings: {
        x: {
          field: 'week',
          trait: 'EncodingPositionX',
          channel: 'x',
          scale: 'temporal',
          title: 'Week starting',
        },
        y: {
          field: 'retention',
          trait: 'EncodingPositionY',
          channel: 'y',
          title: 'Retention %',
        },
      },
      options: {
        curve: 'monotone',
      },
    },
  ],
  encoding: {
    x: { field: 'week', trait: 'EncodingPositionX', channel: 'x', scale: 'temporal' },
    y: { field: 'retention', trait: 'EncodingPositionY', channel: 'y', title: 'Retention %' },
  },
  config: {
    theme: 'brand-b',
    layout: { width: 520, height: 260, padding: 20 },
  },
  a11y: {
    description: 'Retention climbed from 91% to 95.8% over the last eight weeks.',
    ariaLabel: 'Weekly retention line chart',
  },
};

const sentimentSpec: NormalizedVizSpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'dashboard:user:sentiment-bars',
  name: 'Channel sentiment',
  data: {
    values: [
      { channel: 'Guided onboarding', score: 4.6 },
      { channel: 'Self-serve setup', score: 4.1 },
      { channel: 'Webinars', score: 4.4 },
      { channel: 'Community', score: 3.9 }
    ],
  },
  marks: [
    {
      trait: 'MarkBar',
      encodings: {
        x: {
          field: 'score',
          trait: 'EncodingPositionX',
          channel: 'x',
          title: 'Satisfaction',
        },
        y: {
          field: 'channel',
          trait: 'EncodingPositionY',
          channel: 'y',
          sort: 'descending',
          title: 'Channel',
        },
        color: {
          field: 'channel',
          trait: 'EncodingColor',
          channel: 'color',
          legend: { title: 'Channel' },
        },
      },
    },
  ],
  encoding: {
    x: { field: 'score', trait: 'EncodingPositionX', channel: 'x', title: 'Satisfaction' },
    y: { field: 'channel', trait: 'EncodingPositionY', channel: 'y', sort: 'descending' },
    color: { field: 'channel', trait: 'EncodingColor', channel: 'color', legend: { title: 'Channel' } },
  },
  config: {
    theme: 'brand-a',
    layout: { width: 420, height: 260, padding: 20 },
  },
  a11y: {
    description: 'Guided onboarding scores highest at 4.6 while the community channel trails at 3.9.',
    ariaLabel: 'Channel sentiment bar chart',
  },
};

const baseUser = activeUser as UserRecord;

const USER_DASHBOARD_DATA: UserDashboardRecord = {
  ...baseUser,
  metrics: {
    activeUsers: 1284,
    adoptionDelta: 14,
    retentionAvg: 95.1,
    activeRegions: 8,
  },
  insights: [
    'North America regained target parity after the sales enablement refresh.',
    'Guided onboarding remains the top satisfaction channel; community program requires investment.',
    'Retention improvements correlate with the revamped review cadence.',
  ],
  adoptionSpec,
  retentionSpec,
  sentimentSpec,
};
