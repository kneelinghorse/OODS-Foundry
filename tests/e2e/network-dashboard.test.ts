/**
 * E2E Tests for Network Dashboard Integration
 *
 * These tests verify the complete flow of:
 * 1. Widget registration
 * 2. Cross-filter propagation
 * 3. Selection state management
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  registerNetworkDashboardWidgets,
  createTreemapWidget,
  createForceGraphWidget,
  createSankeyWidget,
  type NetworkDashboardWidget,
} from '@/dashboard/widgets/network-widgets.jsx';
import {
  networkFilterReducer,
  createNetworkInteractionBindings,
  createNodeFilterAction,
  createPathFilterAction,
  createLinkFilterAction,
  isNodeFiltered,
  isPathFiltered,
  getFilteredNodeIds,
  DEFAULT_NETWORK_FILTER_STATE,
  type NetworkFilterState,
  type NetworkFilterAction,
} from '@/dashboard/cross-filter/network-handlers.js';

describe('Network Dashboard E2E Integration', () => {
  describe('Widget Registration Flow', () => {
    it('registers multiple widget types and assigns correct metadata', () => {
      const treemapWidget = createTreemapWidget({
        id: 'org-treemap',
        title: 'Organization Structure',
        description: 'Shows organizational hierarchy',
        render: () => null,
      });

      const graphWidget = createForceGraphWidget({
        id: 'team-graph',
        title: 'Team Connections',
        description: 'Shows team relationships',
        render: () => null,
      });

      const sankeyWidget = createSankeyWidget({
        id: 'budget-flow',
        title: 'Budget Allocation',
        description: 'Shows budget flow between departments',
        render: () => null,
      });

      const extensions = registerNetworkDashboardWidgets({
        traitId: 'OrgAnalytics',
        widgets: [treemapWidget, graphWidget, sankeyWidget],
      });

      expect(extensions).toHaveLength(3);

      // Verify each widget has correct category tagging
      const treemapExt = extensions.find((e) => e.id === 'OrgAnalytics:org-treemap');
      const graphExt = extensions.find((e) => e.id === 'OrgAnalytics:team-graph');
      const sankeyExt = extensions.find((e) => e.id === 'OrgAnalytics:budget-flow');

      expect(treemapExt?.metadata?.tags).toContain('hierarchy');
      expect(graphExt?.metadata?.tags).toContain('network');
      expect(sankeyExt?.metadata?.tags).toContain('flow');
    });

    it('correctly assigns priorities for ordering', () => {
      const widgets: NetworkDashboardWidget[] = [
        createTreemapWidget({ id: 'w1', title: 'W1', render: () => null }),
        createForceGraphWidget({ id: 'w2', title: 'W2', render: () => null }),
        createSankeyWidget({ id: 'w3', title: 'W3', render: () => null }),
      ];

      const extensions = registerNetworkDashboardWidgets({
        traitId: 'Test',
        widgets,
      });

      // Priority should increment
      expect(extensions[0].priority).toBe(50);
      expect(extensions[1].priority).toBe(51);
      expect(extensions[2].priority).toBe(52);
    });
  });

  describe('Cross-Filter State Machine', () => {
    let state: NetworkFilterState;
    let dispatch: (action: NetworkFilterAction) => void;

    beforeEach(() => {
      state = DEFAULT_NETWORK_FILTER_STATE;
      dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };
    });

    it('propagates node selection across widgets', () => {
      const treemapBindings = createNetworkInteractionBindings('treemap-widget', dispatch);
      const graphBindings = createNetworkInteractionBindings('graph-widget', dispatch);

      // User clicks a node in treemap
      treemapBindings.onNodeSelect({
        name: 'Engineering',
        value: 150,
        depth: 1,
        path: ['Company', 'Engineering'],
      });

      // Graph widget can query for this filter
      expect(isNodeFiltered(state, 'Company/Engineering')).toBe(true);

      // User clicks a node in graph
      graphBindings.onNodeSelect({
        id: 'alice',
        name: 'Alice',
        group: 'Engineering',
      });

      // Both filters are active
      expect(state.nodes).toHaveLength(2);
      expect(isNodeFiltered(state, 'Company/Engineering')).toBe(true);
      expect(isNodeFiltered(state, 'alice')).toBe(true);
    });

    it('replaces filter from same widget', () => {
      const bindings = createNetworkInteractionBindings('treemap-widget', dispatch);

      bindings.onNodeSelect({
        name: 'Engineering',
        value: 150,
        depth: 1,
        path: ['Company', 'Engineering'],
      });

      bindings.onNodeSelect({
        name: 'Marketing',
        value: 75,
        depth: 1,
        path: ['Company', 'Marketing'],
      });

      // Only latest selection from this widget
      expect(state.nodes).toHaveLength(1);
      expect(isNodeFiltered(state, 'Company/Marketing')).toBe(true);
      expect(isNodeFiltered(state, 'Company/Engineering')).toBe(false);
    });

    it('handles hierarchy path drill-down', () => {
      const bindings = createNetworkInteractionBindings('treemap-widget', dispatch);

      // User drills down through hierarchy
      bindings.onPathSelect({
        name: 'Company',
        value: 1000,
        depth: 0,
        path: ['Company'],
      });

      // All child paths should be considered filtered
      expect(isPathFiltered(state, ['Company'])).toBe(true);
      expect(isPathFiltered(state, ['Company', 'Engineering'])).toBe(true);
      expect(isPathFiltered(state, ['Company', 'Engineering', 'Frontend'])).toBe(true);

      // Unrelated path not filtered
      expect(isPathFiltered(state, ['Other', 'Path'])).toBe(false);
    });

    it('handles link selection for flow data', () => {
      const bindings = createNetworkInteractionBindings('sankey-widget', dispatch);

      bindings.onLinkSelect({
        source: 'Marketing Budget',
        target: 'Digital Ads',
        value: 50000,
      });

      // Both source and target nodes affected
      expect(isNodeFiltered(state, 'Marketing Budget')).toBe(true);
      expect(isNodeFiltered(state, 'Digital Ads')).toBe(true);
    });

    it('handles adjacency selection for network exploration', () => {
      const bindings = createNetworkInteractionBindings('graph-widget', dispatch);

      // User selects a node and wants to see all connected nodes
      const links = [
        { source: 'alice', target: 'bob', value: 5 },
        { source: 'alice', target: 'charlie', value: 3 },
        { source: 'diana', target: 'alice', value: 8 },
      ];

      bindings.onAdjacencySelect('alice', links);

      // Center and all adjacent nodes filtered
      const filteredIds = getFilteredNodeIds(state);
      expect(filteredIds.has('alice')).toBe(true);
      expect(filteredIds.has('bob')).toBe(true);
      expect(filteredIds.has('charlie')).toBe(true);
      expect(filteredIds.has('diana')).toBe(true);
    });

    it('clears filters for specific widget', () => {
      const treemapBindings = createNetworkInteractionBindings('treemap-widget', dispatch);
      const graphBindings = createNetworkInteractionBindings('graph-widget', dispatch);

      treemapBindings.onNodeSelect({
        name: 'Engineering',
        value: 150,
        depth: 1,
        path: ['Company', 'Engineering'],
      });

      graphBindings.onNodeSelect({
        id: 'alice',
        name: 'Alice',
      });

      expect(state.nodes).toHaveLength(2);

      // Clear only treemap filters
      treemapBindings.clear();

      expect(state.nodes).toHaveLength(1);
      expect(isNodeFiltered(state, 'alice')).toBe(true);
      expect(isNodeFiltered(state, 'Company/Engineering')).toBe(false);
    });

    it('clears all filters', () => {
      const treemapBindings = createNetworkInteractionBindings('treemap-widget', dispatch);
      const graphBindings = createNetworkInteractionBindings('graph-widget', dispatch);

      treemapBindings.onPathSelect({
        name: 'Engineering',
        value: 150,
        depth: 1,
        path: ['Company', 'Engineering'],
      });

      graphBindings.onLinkSelect({
        source: 'a',
        target: 'b',
        value: 10,
      });

      expect(state.nodes.length + state.paths.length + state.links.length).toBeGreaterThan(0);

      // Clear all
      dispatch({ type: 'CLEAR_NETWORK_FILTER' });

      expect(state).toEqual(DEFAULT_NETWORK_FILTER_STATE);
    });
  });

  describe('Complex Dashboard Scenario', () => {
    it('simulates multi-widget dashboard interaction flow', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      // Setup bindings for three widgets
      const orgChart = createNetworkInteractionBindings('org-chart', dispatch);
      const teamNetwork = createNetworkInteractionBindings('team-network', dispatch);
      const budgetFlow = createNetworkInteractionBindings('budget-flow', dispatch);

      // Step 1: User clicks Engineering department in org chart
      orgChart.onPathSelect({
        name: 'Engineering',
        value: 200,
        depth: 1,
        path: ['Company', 'Engineering'],
      });

      // Verify path filter applied
      expect(state.paths).toHaveLength(1);
      expect(isPathFiltered(state, ['Company', 'Engineering', 'Frontend'])).toBe(true);

      // Step 2: User explores team network, clicks a specific person
      teamNetwork.onNodeSelect({
        id: 'eng-lead',
        name: 'Engineering Lead',
        group: 'leadership',
      });

      // Both filters active
      expect(state.paths).toHaveLength(1);
      expect(state.nodes).toHaveLength(1);

      // Step 3: User clicks a link to see adjacency
      const teamLinks = [
        { source: 'eng-lead', target: 'frontend-lead' },
        { source: 'eng-lead', target: 'backend-lead' },
        { source: 'eng-lead', target: 'qa-lead' },
      ];
      teamNetwork.onAdjacencySelect('eng-lead', teamLinks);

      // Adjacency filter added (nodes and adjacencies are separate filter types)
      expect(state.nodes).toHaveLength(1);  // Node filter still exists
      expect(state.adjacencies).toHaveLength(1);  // Adjacency filter added

      // Step 4: User clicks budget flow
      budgetFlow.onLinkSelect({
        source: 'Engineering Budget',
        target: 'Cloud Infrastructure',
        value: 500000,
      });

      // All three widgets have active filters
      expect(state.paths).toHaveLength(1);
      expect(state.adjacencies).toHaveLength(1);
      expect(state.links).toHaveLength(1);

      // Step 5: Get all filtered node IDs for highlighting
      const allFiltered = getFilteredNodeIds(state);
      expect(allFiltered.has('eng-lead')).toBe(true);
      expect(allFiltered.has('frontend-lead')).toBe(true);
      expect(allFiltered.has('backend-lead')).toBe(true);
      expect(allFiltered.has('qa-lead')).toBe(true);
      expect(allFiltered.has('Engineering Budget')).toBe(true);
      expect(allFiltered.has('Cloud Infrastructure')).toBe(true);

      // Step 6: User clears org chart filter
      orgChart.clear();
      expect(state.paths).toHaveLength(0);
      expect(state.adjacencies).toHaveLength(1);
      expect(state.links).toHaveLength(1);

      // Step 7: User resets everything
      dispatch({ type: 'CLEAR_NETWORK_FILTER' });
      expect(state).toEqual(DEFAULT_NETWORK_FILTER_STATE);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty widget list', () => {
      const extensions = registerNetworkDashboardWidgets({
        traitId: 'Empty',
        widgets: [],
      });

      expect(extensions).toHaveLength(0);
    });

    it('handles dispatch without callback', () => {
      const bindings = createNetworkInteractionBindings('widget-1');

      // Should not throw
      expect(() => {
        bindings.onNodeSelect({ id: 'n1', name: 'Node' });
        bindings.onPathSelect({ name: 'Item', value: 10, depth: 1, path: ['Item'] });
        bindings.onLinkSelect({ source: 'a', target: 'b', value: 5 });
        bindings.onAdjacencySelect('center', []);
        bindings.clear();
      }).not.toThrow();
    });

    it('handles clearing non-existent widget filters', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      const bindings = createNetworkInteractionBindings('widget-1', dispatch);
      bindings.onNodeSelect({ id: 'n1', name: 'Node' });

      // Clear a different widget's filters
      dispatch({ type: 'CLEAR_NETWORK_FILTER', payload: { sourceWidgetId: 'widget-2' } });

      // Original filter still exists
      expect(state.nodes).toHaveLength(1);
    });

    it('handles nodes without all optional fields', () => {
      let state = DEFAULT_NETWORK_FILTER_STATE;
      const dispatch = (action: NetworkFilterAction) => {
        state = networkFilterReducer(state, action);
      };

      const bindings = createNetworkInteractionBindings('widget-1', dispatch);

      // Minimal node
      bindings.onNodeSelect({ id: 'minimal', name: 'Minimal Node' });

      expect(state.nodes[0].nodeId).toBe('minimal');
      expect(state.nodes[0].nodeGroup).toBeUndefined();
      expect(state.nodes[0].nodeValue).toBeUndefined();
    });
  });
});
