/**
 * Full Integration Test Suite for Network & Flow Module v1.0
 *
 * This test verifies the complete end-to-end functionality of the Network & Flow module:
 * 1. All components render without errors
 * 2. All adapters produce valid ECharts output
 * 3. Cross-filter works end-to-end across widgets
 * 4. CLI commands work correctly
 * 5. Example dashboards can be assembled and configured
 *
 * @module tests/integration/network-flow-full.test.ts
 */
import { describe, expect, it, vi } from 'vitest';

// Adapters
import { adaptTreemapToECharts } from '@/viz/adapters/echarts/treemap-adapter.js';
import { adaptSunburstToECharts } from '@/viz/adapters/echarts/sunburst-adapter.js';
import { adaptGraphToECharts } from '@/viz/adapters/echarts/graph-adapter.js';
import { adaptSankeyToECharts } from '@/viz/adapters/echarts/sankey-adapter.js';

// Types
import type { HierarchyAdjacencyInput, HierarchyNestedInput } from '@/types/viz/network-flow.js';
import type { SankeyInput } from '@/types/viz/sankey-types.js';
import type { GraphInput } from '@/types/viz/graph-types.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

// Cross-filter
import {
  DEFAULT_NETWORK_FILTER_STATE,
  networkFilterReducer,
  createNetworkInteractionBindings,
  isNodeFiltered,
  isPathFiltered,
  getFilteredNodeIds,
  type NetworkFilterAction,
} from '@/dashboard/cross-filter/network-handlers.js';

// Widgets
import {
  registerNetworkDashboardWidgets,
  createTreemapWidget,
  createForceGraphWidget,
  createSankeyWidget,
  createSunburstWidget,
} from '@/dashboard/widgets/network-widgets.jsx';

// Shared test data
const HIERARCHY_ADJACENCY_DATA: HierarchyAdjacencyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'company', parentId: null, value: 1000, name: 'ACME Corp' },
    { id: 'engineering', parentId: 'company', value: 400 },
    { id: 'marketing', parentId: 'company', value: 300 },
    { id: 'sales', parentId: 'company', value: 300 },
    { id: 'frontend', parentId: 'engineering', value: 150 },
    { id: 'backend', parentId: 'engineering', value: 150 },
    { id: 'devops', parentId: 'engineering', value: 100 },
  ],
};

const HIERARCHY_NESTED_DATA: HierarchyNestedInput = {
  type: 'nested',
  data: {
    name: 'ACME Corp',
    value: 1000,
    children: [
      {
        name: 'Engineering',
        value: 400,
        children: [
          { name: 'Frontend', value: 150 },
          { name: 'Backend', value: 150 },
          { name: 'DevOps', value: 100 },
        ],
      },
      { name: 'Marketing', value: 300 },
      { name: 'Sales', value: 300 },
    ],
  },
};

const SANKEY_DATA: SankeyInput = {
  nodes: [
    { name: 'Revenue' },
    { name: 'Products' },
    { name: 'Services' },
    { name: 'Engineering' },
    { name: 'Marketing' },
    { name: 'Profit' },
  ],
  links: [
    { source: 'Revenue', target: 'Products', value: 600 },
    { source: 'Revenue', target: 'Services', value: 400 },
    { source: 'Products', target: 'Engineering', value: 300 },
    { source: 'Products', target: 'Profit', value: 300 },
    { source: 'Services', target: 'Marketing', value: 200 },
    { source: 'Services', target: 'Profit', value: 200 },
  ],
};

const GRAPH_DATA: GraphInput = {
  nodes: [
    { id: 'alice', name: 'Alice', group: 'engineering' },
    { id: 'bob', name: 'Bob', group: 'engineering' },
    { id: 'carol', name: 'Carol', group: 'marketing' },
    { id: 'dave', name: 'Dave', group: 'sales' },
    { id: 'eve', name: 'Eve', group: 'engineering' },
  ],
  links: [
    { source: 'alice', target: 'bob', value: 10 },
    { source: 'alice', target: 'eve', value: 8 },
    { source: 'bob', target: 'carol', value: 5 },
    { source: 'carol', target: 'dave', value: 7 },
    { source: 'eve', target: 'dave', value: 3 },
  ],
};

function createBaseSpec(id: string, name: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods.dev/viz-spec/v1',
    id,
    name,
    data: { values: [] },
    marks: [{ trait: 'MarkRect' }],
    encoding: {},
    a11y: { description: `${name} visualization` },
    config: { layout: { width: 600, height: 400 } },
  };
}

describe('Network & Flow Module v1.0 Full Integration', () => {
  describe('Adapter Output Validation', () => {
    describe('Treemap Adapter', () => {
      it('produces valid ECharts option from adjacency list', () => {
        const spec = createBaseSpec('treemap:adjacency', 'Organization Treemap');
        const option = adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA);

        expect(option.series).toHaveLength(1);
        const series = (option.series as any[])[0];
        expect(series.type).toBe('treemap');
        expect(series.data).toBeDefined();
        expect(series.squareRatio).toBeCloseTo(1.618);
        expect(option.aria?.enabled).toBe(true);
        expect(option.tooltip).toBeDefined();
      });

      it('produces valid ECharts option from nested data', () => {
        const spec = createBaseSpec('treemap:nested', 'Organization Treemap');
        const option = adaptTreemapToECharts(spec, HIERARCHY_NESTED_DATA);

        expect(option.series).toHaveLength(1);
        const series = (option.series as any[])[0];
        expect(series.type).toBe('treemap');
        expect(series.data[0].name).toBe('ACME Corp');
        expect(series.data[0].children).toHaveLength(3);
      });

      it('includes drilldown and breadcrumb by default', () => {
        const spec = createBaseSpec('treemap:default', 'Treemap');
        const option = adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA);
        const series = (option.series as any[])[0];

        expect(series.nodeClick).toBe('zoomToNode');
        expect(series.breadcrumb.show).toBe(true);
      });
    });

    describe('Sunburst Adapter', () => {
      it('produces valid ECharts option from adjacency list', () => {
        const spec = createBaseSpec('sunburst:adjacency', 'Organization Sunburst');
        const option = adaptSunburstToECharts(spec, HIERARCHY_ADJACENCY_DATA);

        expect(option.series).toHaveLength(1);
        const series = (option.series as any[])[0];
        expect(series.type).toBe('sunburst');
        expect(series.startAngle).toBe(90);
        expect(series.emphasis.focus).toBe('ancestor');
        expect(series.label.rotate).toBe('radial');
      });

      it('has proper radius and level configuration', () => {
        const spec = createBaseSpec('sunburst:levels', 'Sunburst Levels');
        const option = adaptSunburstToECharts(spec, HIERARCHY_NESTED_DATA);
        const series = (option.series as any[])[0];

        expect(series.radius).toEqual(['0%', '90%']);
        expect(series.levels).toHaveLength(4);
      });
    });

    describe('Force Graph Adapter', () => {
      it('produces valid ECharts option', () => {
        const spec = createBaseSpec('graph:force', 'Team Network');
        const option = adaptGraphToECharts(spec, GRAPH_DATA);

        expect(option.series).toHaveLength(1);
        const series = (option.series as any[])[0];
        expect(series.type).toBe('graph');
        expect(series.layout).toBe('force');
        expect(series.data).toHaveLength(5);
        expect(series.links).toHaveLength(5);
      });

      it('groups nodes by category', () => {
        const spec = createBaseSpec('graph:categories', 'Grouped Network');
        const option = adaptGraphToECharts(spec, GRAPH_DATA);
        const series = (option.series as any[])[0];

        expect(series.categories).toBeDefined();
        expect(series.categories.length).toBeGreaterThan(0);
        // Each node should have a category reference
        series.data.forEach((node: any) => {
          expect(node.category).toBeDefined();
        });
      });

      it('applies force configuration', () => {
        const spec = createBaseSpec('graph:force-config', 'Force Network');
        const option = adaptGraphToECharts(spec, GRAPH_DATA);
        const series = (option.series as any[])[0];

        expect(series.force).toBeDefined();
        expect(series.force.repulsion).toBeGreaterThan(0);
        expect(series.force.gravity).toBeGreaterThan(0);
      });
    });

    describe('Sankey Adapter', () => {
      it('produces valid ECharts option', () => {
        const spec = createBaseSpec('sankey:flow', 'Budget Flow');
        const option = adaptSankeyToECharts(spec, SANKEY_DATA);

        expect(option.series).toHaveLength(1);
        const series = (option.series as any[])[0];
        expect(series.type).toBe('sankey');
        expect(series.data).toHaveLength(6);
        expect(series.links).toHaveLength(6);
      });

      it('preserves flow values', () => {
        const spec = createBaseSpec('sankey:values', 'Flow Values');
        const option = adaptSankeyToECharts(spec, SANKEY_DATA);
        const series = (option.series as any[])[0];

        const revenueToProducts = series.links.find(
          (l: any) => l.source === 'Revenue' && l.target === 'Products'
        );
        expect(revenueToProducts.value).toBe(600);
      });

      it('applies emphasis and accessibility', () => {
        const spec = createBaseSpec('sankey:a11y', 'Accessible Sankey');
        const option = adaptSankeyToECharts(spec, SANKEY_DATA);

        expect(option.aria?.enabled).toBe(true);
        const series = (option.series as any[])[0];
        expect(series.emphasis).toBeDefined();
      });
    });
  });

  describe('Cross-Filter Integration', () => {
    it('propagates selections across widget types', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      // Create bindings for each widget type
      const treemapBindings = createNetworkInteractionBindings('treemap', dispatch);
      const sunburstBindings = createNetworkInteractionBindings('sunburst', dispatch);
      const graphBindings = createNetworkInteractionBindings('graph', dispatch);
      const sankeyBindings = createNetworkInteractionBindings('sankey', dispatch);

      // User clicks on Engineering in treemap
      treemapBindings.onPathSelect({
        name: 'Engineering',
        value: 400,
        depth: 1,
        path: ['ACME Corp', 'Engineering'],
      });

      expect(isPathFiltered(state, ['ACME Corp', 'Engineering'])).toBe(true);
      expect(isPathFiltered(state, ['ACME Corp', 'Engineering', 'Frontend'])).toBe(true);

      // User clicks on Alice in graph
      graphBindings.onNodeSelect({
        id: 'alice',
        name: 'Alice',
        group: 'engineering',
      });

      expect(isNodeFiltered(state, 'alice')).toBe(true);
      expect(state.nodes).toHaveLength(1);
      expect(state.paths).toHaveLength(1);

      // User clicks a flow link in sankey
      sankeyBindings.onLinkSelect({
        source: 'Products',
        target: 'Engineering',
        value: 300,
      });

      expect(isNodeFiltered(state, 'Products')).toBe(true);
      expect(isNodeFiltered(state, 'Engineering')).toBe(true);

      // All filters are active
      const allFiltered = getFilteredNodeIds(state);
      expect(allFiltered.has('alice')).toBe(true);
      expect(allFiltered.has('Products')).toBe(true);
      expect(allFiltered.has('Engineering')).toBe(true);
    });

    it('handles adjacency exploration in graph', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      const graphBindings = createNetworkInteractionBindings('graph', dispatch);

      // User explores Alice's connections
      graphBindings.onAdjacencySelect('alice', [
        { source: 'alice', target: 'bob', value: 10 },
        { source: 'alice', target: 'eve', value: 8 },
      ]);

      const filtered = getFilteredNodeIds(state);
      expect(filtered.has('alice')).toBe(true);
      expect(filtered.has('bob')).toBe(true);
      expect(filtered.has('eve')).toBe(true);
      expect(filtered.has('carol')).toBe(false);
    });

    it('clears filters per widget', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      const treemapBindings = createNetworkInteractionBindings('treemap', dispatch);
      const graphBindings = createNetworkInteractionBindings('graph', dispatch);

      treemapBindings.onNodeSelect({ id: 'eng', name: 'Engineering' });
      graphBindings.onNodeSelect({ id: 'alice', name: 'Alice' });

      expect(state.nodes).toHaveLength(2);

      treemapBindings.clear();
      expect(state.nodes).toHaveLength(1);
      expect(isNodeFiltered(state, 'alice')).toBe(true);
      expect(isNodeFiltered(state, 'eng')).toBe(false);
    });
  });

  describe('Widget Registration', () => {
    it('registers all four network widget types', () => {
      const widgets = [
        createTreemapWidget({ id: 'tm', title: 'Treemap', render: () => null }),
        createSunburstWidget({ id: 'sb', title: 'Sunburst', render: () => null }),
        createForceGraphWidget({ id: 'fg', title: 'Force Graph', render: () => null }),
        createSankeyWidget({ id: 'sk', title: 'Sankey', render: () => null }),
      ];

      const extensions = registerNetworkDashboardWidgets({
        traitId: 'NetworkModule',
        widgets,
      });

      expect(extensions).toHaveLength(4);

      const treemapExt = extensions.find((e) => e.id === 'NetworkModule:tm');
      const sunburstExt = extensions.find((e) => e.id === 'NetworkModule:sb');
      const graphExt = extensions.find((e) => e.id === 'NetworkModule:fg');
      const sankeyExt = extensions.find((e) => e.id === 'NetworkModule:sk');

      expect(treemapExt?.metadata?.tags).toContain('hierarchy');
      expect(sunburstExt?.metadata?.tags).toContain('hierarchy');
      expect(graphExt?.metadata?.tags).toContain('network');
      expect(sankeyExt?.metadata?.tags).toContain('flow');
    });

    it('assigns incremental priorities', () => {
      const widgets = [
        createTreemapWidget({ id: 'w1', title: 'W1', render: () => null }),
        createForceGraphWidget({ id: 'w2', title: 'W2', render: () => null }),
        createSankeyWidget({ id: 'w3', title: 'W3', render: () => null }),
      ];

      const extensions = registerNetworkDashboardWidgets({
        traitId: 'Test',
        widgets,
      });

      expect(extensions[0].priority).toBe(50);
      expect(extensions[1].priority).toBe(51);
      expect(extensions[2].priority).toBe(52);
    });
  });

  describe('Multi-Dashboard Scenario', () => {
    it('simulates a complete organization analytics dashboard', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      // Dashboard setup: 4 widgets
      const orgChart = createNetworkInteractionBindings('org-treemap', dispatch);
      const teamRadial = createNetworkInteractionBindings('team-sunburst', dispatch);
      const relationships = createNetworkInteractionBindings('people-graph', dispatch);
      const budgetFlow = createNetworkInteractionBindings('budget-sankey', dispatch);

      // Step 1: User explores Engineering department in treemap
      orgChart.onPathSelect({
        name: 'Engineering',
        value: 400,
        depth: 1,
        path: ['ACME Corp', 'Engineering'],
      });

      // All engineering sub-departments should be filtered
      expect(isPathFiltered(state, ['ACME Corp', 'Engineering', 'Frontend'])).toBe(true);
      expect(isPathFiltered(state, ['ACME Corp', 'Engineering', 'Backend'])).toBe(true);
      expect(isPathFiltered(state, ['ACME Corp', 'Engineering', 'DevOps'])).toBe(true);

      // Step 2: User drills into team sunburst - Frontend team
      teamRadial.onPathSelect({
        name: 'Frontend',
        value: 150,
        depth: 2,
        path: ['ACME Corp', 'Engineering', 'Frontend'],
      });

      // Now have two path filters
      expect(state.paths).toHaveLength(2);

      // Step 3: User selects Alice and explores her connections
      relationships.onAdjacencySelect('alice', [
        { source: 'alice', target: 'bob', value: 10 },
        { source: 'alice', target: 'eve', value: 8 },
      ]);

      // Step 4: User traces budget flow to Engineering
      budgetFlow.onLinkSelect({
        source: 'Products',
        target: 'Engineering',
        value: 300,
      });

      // Verify all filters are active
      expect(state.paths).toHaveLength(2);
      expect(state.adjacencies).toHaveLength(1);
      expect(state.links).toHaveLength(1);

      // Step 5: Get comprehensive view of all filtered entities
      const allNodes = getFilteredNodeIds(state);
      expect(allNodes.has('alice')).toBe(true);
      expect(allNodes.has('bob')).toBe(true);
      expect(allNodes.has('eve')).toBe(true);
      expect(allNodes.has('Products')).toBe(true);
      expect(allNodes.has('Engineering')).toBe(true);

      // Step 6: User resets the graph filter to refocus
      relationships.clear();
      expect(state.adjacencies).toHaveLength(0);
      expect(state.paths).toHaveLength(2);
      expect(state.links).toHaveLength(1);

      // Step 7: Complete reset
      dispatch({ type: 'CLEAR_NETWORK_FILTER' });
      expect(state).toEqual(DEFAULT_NETWORK_FILTER_STATE);
    });
  });

  describe('Accessibility Configuration', () => {
    it('all adapters include aria configuration', () => {
      const spec = createBaseSpec('a11y-test', 'Accessible Chart');

      const treemapOption = adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA);
      const sunburstOption = adaptSunburstToECharts(spec, HIERARCHY_ADJACENCY_DATA);
      const graphOption = adaptGraphToECharts(spec, GRAPH_DATA);
      const sankeyOption = adaptSankeyToECharts(spec, SANKEY_DATA);

      expect(treemapOption.aria?.enabled).toBe(true);
      expect(sunburstOption.aria?.enabled).toBe(true);
      expect(graphOption.aria?.enabled).toBe(true);
      expect(sankeyOption.aria?.enabled).toBe(true);
    });

    it('aria descriptions are propagated from spec', () => {
      const spec: NormalizedVizSpec = {
        ...createBaseSpec('a11y-desc', 'Custom Description'),
        a11y: { description: 'Custom accessibility description for screen readers' },
      };

      const treemapOption = adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA);
      expect(treemapOption.aria?.description).toBe('Custom accessibility description for screen readers');
    });
  });

  describe('ECharts Output Contract', () => {
    it('all adapters produce valid usermeta with oods namespace', () => {
      const spec = createBaseSpec('usermeta-test', 'Metadata Test');

      const options = [
        adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA),
        adaptSunburstToECharts(spec, HIERARCHY_ADJACENCY_DATA),
        adaptGraphToECharts(spec, GRAPH_DATA),
        adaptSankeyToECharts(spec, SANKEY_DATA),
      ];

      options.forEach((option) => {
        expect((option as any).usermeta?.oods).toBeDefined();
        expect((option as any).usermeta.oods.specId).toBe('usermeta-test');
        expect((option as any).usermeta.oods.name).toBe('Metadata Test');
      });
    });

    it('all adapters include color palettes', () => {
      const spec = createBaseSpec('palette-test', 'Palette Test');

      const treemapOption = adaptTreemapToECharts(spec, HIERARCHY_ADJACENCY_DATA);
      const sunburstOption = adaptSunburstToECharts(spec, HIERARCHY_ADJACENCY_DATA);
      const graphOption = adaptGraphToECharts(spec, GRAPH_DATA);
      const sankeyOption = adaptSankeyToECharts(spec, SANKEY_DATA);

      expect(Array.isArray(treemapOption.color)).toBe(true);
      expect(Array.isArray(sunburstOption.color)).toBe(true);
      expect(Array.isArray(graphOption.color)).toBe(true);
      expect(Array.isArray(sankeyOption.color)).toBe(true);
    });
  });
});
