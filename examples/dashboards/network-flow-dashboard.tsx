/**
 * Network & Flow Dashboard Example
 *
 * Demonstrates hierarchical, network, and flow visualizations with cross-filtering.
 * Shows org structure (Treemap/Sunburst), team collaboration (ForceGraph),
 * and budget flow (Sankey) with coordinated selections.
 */
import type { FC, JSX } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';
import type { HierarchyInput, NetworkInput, SankeyInput } from '../../src/types/viz/network-flow.js';
import { Treemap } from '../../src/components/viz/Treemap.js';
import { Sunburst } from '../../src/components/viz/Sunburst.js';
import { ForceGraph } from '../../src/components/viz/ForceGraph.js';
import { Sankey } from '../../src/components/viz/Sankey.js';
import {
  createChartRegionExtensions,
  type ChartPanelDefinition,
} from '../../src/contexts/regions/chart-regions.js';
import { Text } from '../../src/components/base/Text.js';
import type { DashboardExample } from './user-adoption.js';

// -----------------------------------------------------------------------------
// Data Types
// -----------------------------------------------------------------------------

export interface NetworkFlowMetrics {
  readonly totalRevenue: number;
  readonly departmentCount: number;
  readonly teamConnections: number;
  readonly budgetEfficiency: number;
}

export interface NetworkFlowDashboardRecord {
  readonly org_id: string;
  readonly name: string;
  readonly metrics: NetworkFlowMetrics;
  readonly hierarchyData: HierarchyInput;
  readonly networkData: NetworkInput;
  readonly flowData: SankeyInput;
  readonly insights: readonly string[];
}

// -----------------------------------------------------------------------------
// Sample Data
// -----------------------------------------------------------------------------

const HIERARCHY_DATA: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Acme Corp',
    value: 10000000,
    children: [
      {
        name: 'Engineering',
        value: 4000000,
        children: [
          { name: 'Frontend', value: 1500000 },
          { name: 'Backend', value: 1800000 },
          { name: 'DevOps', value: 700000 },
        ],
      },
      {
        name: 'Product',
        value: 2500000,
        children: [
          { name: 'Design', value: 1000000 },
          { name: 'Research', value: 800000 },
          { name: 'PM', value: 700000 },
        ],
      },
      {
        name: 'Sales',
        value: 2000000,
        children: [
          { name: 'Enterprise', value: 1200000 },
          { name: 'SMB', value: 500000 },
          { name: 'Partnerships', value: 300000 },
        ],
      },
      {
        name: 'Operations',
        value: 1500000,
        children: [
          { name: 'HR', value: 600000 },
          { name: 'Finance', value: 500000 },
          { name: 'Legal', value: 400000 },
        ],
      },
    ],
  },
};

const NETWORK_DATA: NetworkInput = {
  nodes: [
    { id: 'eng-lead', group: 'engineering' },
    { id: 'fe-lead', group: 'engineering' },
    { id: 'be-lead', group: 'engineering' },
    { id: 'devops-lead', group: 'engineering' },
    { id: 'design-lead', group: 'product' },
    { id: 'pm-lead', group: 'product' },
    { id: 'research-lead', group: 'product' },
    { id: 'sales-lead', group: 'sales' },
    { id: 'enterprise-lead', group: 'sales' },
    { id: 'ops-lead', group: 'operations' },
  ],
  links: [
    { source: 'eng-lead', target: 'fe-lead', value: 10 },
    { source: 'eng-lead', target: 'be-lead', value: 10 },
    { source: 'eng-lead', target: 'devops-lead', value: 8 },
    { source: 'fe-lead', target: 'design-lead', value: 15 },
    { source: 'be-lead', target: 'devops-lead', value: 12 },
    { source: 'design-lead', target: 'pm-lead', value: 14 },
    { source: 'pm-lead', target: 'research-lead', value: 9 },
    { source: 'pm-lead', target: 'eng-lead', value: 13 },
    { source: 'sales-lead', target: 'enterprise-lead', value: 11 },
    { source: 'sales-lead', target: 'pm-lead', value: 7 },
    { source: 'ops-lead', target: 'eng-lead', value: 5 },
    { source: 'ops-lead', target: 'sales-lead', value: 6 },
    { source: 'fe-lead', target: 'be-lead', value: 8 },
  ],
};

const FLOW_DATA: SankeyInput = {
  nodes: [
    { name: 'Revenue' },
    { name: 'Engineering' },
    { name: 'Product' },
    { name: 'Sales' },
    { name: 'Operations' },
    { name: 'Salaries' },
    { name: 'Tools' },
    { name: 'Cloud' },
    { name: 'Marketing' },
    { name: 'Office' },
    { name: 'Profit' },
  ],
  links: [
    { source: 'Revenue', target: 'Engineering', value: 4000 },
    { source: 'Revenue', target: 'Product', value: 2500 },
    { source: 'Revenue', target: 'Sales', value: 2000 },
    { source: 'Revenue', target: 'Operations', value: 1500 },
    { source: 'Engineering', target: 'Salaries', value: 2800 },
    { source: 'Engineering', target: 'Tools', value: 600 },
    { source: 'Engineering', target: 'Cloud', value: 600 },
    { source: 'Product', target: 'Salaries', value: 1800 },
    { source: 'Product', target: 'Tools', value: 400 },
    { source: 'Product', target: 'Marketing', value: 300 },
    { source: 'Sales', target: 'Salaries', value: 1200 },
    { source: 'Sales', target: 'Marketing', value: 600 },
    { source: 'Sales', target: 'Profit', value: 200 },
    { source: 'Operations', target: 'Salaries', value: 800 },
    { source: 'Operations', target: 'Office', value: 500 },
    { source: 'Operations', target: 'Profit', value: 200 },
  ],
};

const NETWORK_FLOW_DASHBOARD_DATA: NetworkFlowDashboardRecord = {
  org_id: 'acme-001',
  name: 'Acme Corp Overview',
  metrics: {
    totalRevenue: 10000000,
    departmentCount: 4,
    teamConnections: 13,
    budgetEfficiency: 87.5,
  },
  hierarchyData: HIERARCHY_DATA,
  networkData: NETWORK_DATA,
  flowData: FLOW_DATA,
  insights: [
    'Engineering receives 40% of total budget, highest allocation',
    'Frontend and Design teams have strongest collaboration (15 interactions)',
    'Operations has lowest external connections, opportunity for improvement',
    'Sales generates 4% direct profit margin after expenses',
  ],
};

// -----------------------------------------------------------------------------
// Dashboard Panels
// -----------------------------------------------------------------------------

const NETWORK_FLOW_PANELS: ChartPanelDefinition<NetworkFlowDashboardRecord>[] = [
  {
    id: 'nf:org-treemap',
    title: 'Organization Structure',
    description: 'Budget allocation by department (click to drill down)',
    render: ({ data }) => (
      <Treemap
        data={data.hierarchyData}
        name="Budget by Department"
        width={450}
        height={350}
        drilldown
        breadcrumb
        showTable={false}
      />
    ),
  },
  {
    id: 'nf:org-sunburst',
    title: 'Budget Distribution',
    description: 'Radial view of budget allocation',
    render: ({ data }) => (
      <Sunburst
        data={data.hierarchyData}
        name="Budget Distribution"
        width={400}
        height={400}
        drilldown
        showTable={false}
      />
    ),
  },
  {
    id: 'nf:team-network',
    title: 'Team Collaboration',
    description: 'Leadership connections across departments',
    render: ({ data }) => (
      <ForceGraph
        data={data.networkData}
        name="Team Collaboration Network"
        width={500}
        height={400}
        colorField="group"
        showLabels
        showLegend
        showTable={false}
        force={{ repulsion: 100, edgeLength: 80 }}
      />
    ),
  },
  {
    id: 'nf:budget-flow',
    title: 'Budget Flow',
    description: 'Revenue to expense allocation',
    render: ({ data }) => (
      <Sankey
        data={data.flowData}
        name="Budget Flow"
        width={600}
        height={400}
        linkColor="gradient"
        showTable={false}
      />
    ),
  },
];

// -----------------------------------------------------------------------------
// Dashboard Components
// -----------------------------------------------------------------------------

function NetworkFlowHero({ metrics }: { readonly metrics: NetworkFlowMetrics }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Total Revenue" value={`$${(metrics.totalRevenue / 1000000).toFixed(1)}M`} />
      <Metric label="Departments" value={`${metrics.departmentCount}`} />
      <Metric label="Team Connections" value={`${metrics.teamConnections}`} />
      <Metric label="Budget Efficiency" value={`${metrics.budgetEfficiency}%`} />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
        {label}
      </Text>
      <div className="mt-1 flex items-baseline gap-2">
        <Text as="span" size="lg" weight="semibold">
          {value}
        </Text>
        {hint && (
          <Text as="span" size="sm" className="text-slate-400">
            {hint}
          </Text>
        )}
      </div>
    </div>
  );
}

function NetworkFlowToolbar(): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <Text as="span" weight="semibold">Network & Flow Dashboard</Text>
      <Text as="span" size="sm" className="text-slate-500">
        Click visualizations to explore details
      </Text>
    </div>
  );
}

function NetworkFlowInsights({ insights }: { readonly insights: readonly string[] }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <Text as="h3" size="sm" weight="semibold" className="mb-3">
        Key Insights
      </Text>
      <ul className="space-y-2">
        {insights.map((insight, idx) => (
          <li key={idx} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="text-blue-500">•</span>
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dashboard Trait & Object
// -----------------------------------------------------------------------------

function createNetworkFlowDashboardTrait(): TraitAdapter<NetworkFlowDashboardRecord> {
  return {
    id: 'NetworkFlowDashboardPanels',
    view: () =>
      createChartRegionExtensions<NetworkFlowDashboardRecord>({
        traitId: 'NetworkFlowDashboardPanels',
        variant: 'dashboard',
        hero: ({ data }) => <NetworkFlowHero metrics={data.metrics} />,
        toolbar: () => <NetworkFlowToolbar />,
        insights: ({ data }) => <NetworkFlowInsights insights={data.insights} />,
        panels: NETWORK_FLOW_PANELS,
      }),
  };
}

const NETWORK_FLOW_DASHBOARD_OBJECT: ObjectSpec<NetworkFlowDashboardRecord> = {
  id: 'object:NetworkFlowDashboard',
  name: 'Network & Flow Dashboard',
  version: '1.0.0',
  traits: [createNetworkFlowDashboardTrait()],
  metadata: {
    category: 'analytics',
    status: 'stable',
  },
};

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export function createNetworkFlowDashboardExample(): DashboardExample<NetworkFlowDashboardRecord> {
  return {
    object: NETWORK_FLOW_DASHBOARD_OBJECT,
    data: NETWORK_FLOW_DASHBOARD_DATA,
  };
}

export function NetworkFlowDashboardPreview(): JSX.Element {
  const { object, data } = createNetworkFlowDashboardExample();
  const DashboardRender = RenderObject as FC<RenderObjectProps<NetworkFlowDashboardRecord>>;
  return <DashboardRender context="dashboard" object={object} data={data} />;
}
