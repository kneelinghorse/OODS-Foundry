import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NETWORK_FILTER_STATE,
  createNodeFilterAction,
  createPathFilterAction,
  createLinkFilterAction,
  createAdjacencyFilterAction,
  createClearNetworkFilterAction,
  networkFilterReducer,
  createNetworkInteractionBindings,
  summarizeNetworkFilters,
  isNodeFiltered,
  isPathFiltered,
  getFilteredNodeIds,
  type NetworkFilterState,
} from '@/dashboard/cross-filter/network-handlers.js';

describe('Network Filter Action Creators', () => {
  describe('createNodeFilterAction', () => {
    it('creates action from GraphNode', () => {
      const node = { id: 'node-1', name: 'Test Node', group: 'group-a', value: 100 };
      const action = createNodeFilterAction('widget-1', node);

      expect(action.type).toBe('FILTER_BY_NODE');
      expect(action.payload.sourceWidgetId).toBe('widget-1');
      expect(action.payload.nodeId).toBe('node-1');
      expect(action.payload.nodeName).toBe('Test Node');
      expect(action.payload.nodeGroup).toBe('group-a');
      expect(action.payload.nodeValue).toBe(100);
    });

    it('creates action from TreemapNode', () => {
      const node = { name: 'Category A', value: 50, depth: 2, path: ['Root', 'Parent', 'Category A'] };
      const action = createNodeFilterAction('widget-2', node);

      expect(action.type).toBe('FILTER_BY_NODE');
      expect(action.payload.nodeId).toBe('Root/Parent/Category A');
      expect(action.payload.nodeName).toBe('Category A');
      expect(action.payload.nodeValue).toBe(50);
      expect(action.payload.metadata?.depth).toBe(2);
    });

    it('creates action from SankeyNodeOutput', () => {
      const node = { name: 'Process 1', value: 200 };
      const action = createNodeFilterAction('widget-3', node);

      expect(action.type).toBe('FILTER_BY_NODE');
      expect(action.payload.nodeId).toBe('Process 1');
      expect(action.payload.nodeName).toBe('Process 1');
    });
  });

  describe('createPathFilterAction', () => {
    it('creates action from TreemapNode', () => {
      const node = { name: 'Item A1', value: 40, depth: 3, path: ['Root', 'Category A', 'Item A1'] };
      const action = createPathFilterAction('widget-1', node);

      expect(action.type).toBe('FILTER_BY_PATH');
      expect(action.payload.sourceWidgetId).toBe('widget-1');
      expect(action.payload.path).toEqual(['Root', 'Category A', 'Item A1']);
      expect(action.payload.depth).toBe(3);
      expect(action.payload.value).toBe(40);
    });
  });

  describe('createLinkFilterAction', () => {
    it('creates action from GraphLink', () => {
      const link = { source: 'node-a', target: 'node-b', value: 25 };
      const action = createLinkFilterAction('widget-1', link);

      expect(action.type).toBe('FILTER_BY_LINK');
      expect(action.payload.sourceWidgetId).toBe('widget-1');
      expect(action.payload.sourceNodeId).toBe('node-a');
      expect(action.payload.targetNodeId).toBe('node-b');
      expect(action.payload.value).toBe(25);
    });

    it('creates action from SankeyLinkOutput', () => {
      const link = { source: 'Input', target: 'Output', value: 100 };
      const action = createLinkFilterAction('sankey-widget', link);

      expect(action.type).toBe('FILTER_BY_LINK');
      expect(action.payload.sourceNodeId).toBe('Input');
      expect(action.payload.targetNodeId).toBe('Output');
      expect(action.payload.value).toBe(100);
    });
  });

  describe('createAdjacencyFilterAction', () => {
    it('finds all adjacent nodes from links', () => {
      const links = [
        { source: 'center', target: 'neighbor-1', value: 10 },
        { source: 'center', target: 'neighbor-2', value: 20 },
        { source: 'neighbor-3', target: 'center', value: 15 },
        { source: 'unrelated-a', target: 'unrelated-b', value: 5 },
      ];

      const action = createAdjacencyFilterAction('widget-1', 'center', links);

      expect(action.type).toBe('FILTER_BY_ADJACENCY');
      expect(action.payload.centerNodeId).toBe('center');
      expect(action.payload.adjacentNodeIds).toContain('neighbor-1');
      expect(action.payload.adjacentNodeIds).toContain('neighbor-2');
      expect(action.payload.adjacentNodeIds).toContain('neighbor-3');
      expect(action.payload.adjacentNodeIds).not.toContain('unrelated-a');
      expect(action.payload.adjacentLinks).toHaveLength(3);
    });
  });

  describe('createClearNetworkFilterAction', () => {
    it('creates clear action for specific widget', () => {
      const action = createClearNetworkFilterAction('widget-1');

      expect(action.type).toBe('CLEAR_NETWORK_FILTER');
      expect(action.payload?.sourceWidgetId).toBe('widget-1');
    });

    it('creates clear action for all filters', () => {
      const action = createClearNetworkFilterAction();

      expect(action.type).toBe('CLEAR_NETWORK_FILTER');
      expect(action.payload).toBeUndefined();
    });
  });
});

describe('networkFilterReducer', () => {
  describe('FILTER_BY_NODE', () => {
    it('adds node filter to state', () => {
      const action = createNodeFilterAction('widget-1', { id: 'n1', name: 'Node 1' });
      const state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].nodeId).toBe('n1');
    });

    it('replaces existing filter from same widget', () => {
      const action1 = createNodeFilterAction('widget-1', { id: 'n1', name: 'Node 1' });
      const action2 = createNodeFilterAction('widget-1', { id: 'n2', name: 'Node 2' });

      let state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action1);
      state = networkFilterReducer(state, action2);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].nodeId).toBe('n2');
    });

    it('preserves filters from different widgets', () => {
      const action1 = createNodeFilterAction('widget-1', { id: 'n1', name: 'Node 1' });
      const action2 = createNodeFilterAction('widget-2', { id: 'n2', name: 'Node 2' });

      let state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action1);
      state = networkFilterReducer(state, action2);

      expect(state.nodes).toHaveLength(2);
    });
  });

  describe('FILTER_BY_PATH', () => {
    it('adds path filter to state', () => {
      const action = createPathFilterAction('widget-1', {
        name: 'Item',
        value: 10,
        depth: 2,
        path: ['Root', 'Item'],
      });
      const state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action);

      expect(state.paths).toHaveLength(1);
      expect(state.paths[0].path).toEqual(['Root', 'Item']);
    });
  });

  describe('FILTER_BY_LINK', () => {
    it('adds link filter to state', () => {
      const action = createLinkFilterAction('widget-1', {
        source: 'a',
        target: 'b',
        value: 50,
      });
      const state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action);

      expect(state.links).toHaveLength(1);
      expect(state.links[0].sourceNodeId).toBe('a');
      expect(state.links[0].targetNodeId).toBe('b');
    });
  });

  describe('FILTER_BY_ADJACENCY', () => {
    it('adds adjacency filter to state', () => {
      const links = [
        { source: 'center', target: 'n1' },
        { source: 'n2', target: 'center' },
      ];
      const action = createAdjacencyFilterAction('widget-1', 'center', links);
      const state = networkFilterReducer(DEFAULT_NETWORK_FILTER_STATE, action);

      expect(state.adjacencies).toHaveLength(1);
      expect(state.adjacencies[0].centerNodeId).toBe('center');
      expect(state.adjacencies[0].adjacentNodeIds).toContain('n1');
      expect(state.adjacencies[0].adjacentNodeIds).toContain('n2');
    });
  });

  describe('CLEAR_NETWORK_FILTER', () => {
    it('clears all filters when no widget specified', () => {
      let state: NetworkFilterState = {
        nodes: [{ sourceWidgetId: 'w1', nodeId: 'n1' }],
        paths: [{ sourceWidgetId: 'w2', path: ['a'], depth: 1 }],
        links: [{ sourceWidgetId: 'w3', sourceNodeId: 'a', targetNodeId: 'b' }],
        adjacencies: [{ sourceWidgetId: 'w4', centerNodeId: 'c', adjacentNodeIds: [], adjacentLinks: [] }],
      };

      state = networkFilterReducer(state, createClearNetworkFilterAction());

      expect(state).toEqual(DEFAULT_NETWORK_FILTER_STATE);
    });

    it('clears only filters from specified widget', () => {
      let state: NetworkFilterState = {
        nodes: [
          { sourceWidgetId: 'w1', nodeId: 'n1' },
          { sourceWidgetId: 'w2', nodeId: 'n2' },
        ],
        paths: [{ sourceWidgetId: 'w1', path: ['a'], depth: 1 }],
        links: [],
        adjacencies: [],
      };

      state = networkFilterReducer(state, createClearNetworkFilterAction('w1'));

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].sourceWidgetId).toBe('w2');
      expect(state.paths).toHaveLength(0);
    });
  });
});

describe('createNetworkInteractionBindings', () => {
  it('creates bindings that dispatch actions', () => {
    const dispatch = vi.fn();
    const bindings = createNetworkInteractionBindings('my-widget', dispatch);

    bindings.onNodeSelect({ id: 'n1', name: 'Node 1' });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILTER_BY_NODE',
        payload: expect.objectContaining({
          sourceWidgetId: 'my-widget',
          nodeId: 'n1',
        }),
      })
    );
  });

  it('creates bindings for path selection', () => {
    const dispatch = vi.fn();
    const bindings = createNetworkInteractionBindings('my-widget', dispatch);

    bindings.onPathSelect({ name: 'Item', value: 10, depth: 2, path: ['Root', 'Item'] });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILTER_BY_PATH',
      })
    );
  });

  it('creates bindings for link selection', () => {
    const dispatch = vi.fn();
    const bindings = createNetworkInteractionBindings('my-widget', dispatch);

    bindings.onLinkSelect({ source: 'a', target: 'b', value: 100 });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILTER_BY_LINK',
      })
    );
  });

  it('creates bindings for adjacency selection', () => {
    const dispatch = vi.fn();
    const bindings = createNetworkInteractionBindings('my-widget', dispatch);

    bindings.onAdjacencySelect('center', [{ source: 'center', target: 'neighbor' }]);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILTER_BY_ADJACENCY',
      })
    );
  });

  it('creates clear binding', () => {
    const dispatch = vi.fn();
    const bindings = createNetworkInteractionBindings('my-widget', dispatch);

    bindings.clear();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLEAR_NETWORK_FILTER',
        payload: { sourceWidgetId: 'my-widget' },
      })
    );
  });

  it('handles missing dispatch gracefully', () => {
    const bindings = createNetworkInteractionBindings('my-widget');

    // Should not throw
    expect(() => bindings.onNodeSelect({ id: 'n1', name: 'Node 1' })).not.toThrow();
    expect(() => bindings.clear()).not.toThrow();
  });
});

describe('Filter Utilities', () => {
  describe('summarizeNetworkFilters', () => {
    it('summarizes node filters', () => {
      const state: NetworkFilterState = {
        nodes: [{ sourceWidgetId: 'w1', nodeId: 'n1', nodeName: 'Node 1' }],
        paths: [],
        links: [],
        adjacencies: [],
      };

      const summaries = summarizeNetworkFilters(state);

      expect(summaries).toContain('node:n1@w1(Node 1)');
    });

    it('summarizes path filters', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [{ sourceWidgetId: 'w1', path: ['Root', 'Child'], depth: 2 }],
        links: [],
        adjacencies: [],
      };

      const summaries = summarizeNetworkFilters(state);

      expect(summaries).toContain('path:Root/Child@w1[depth=2]');
    });

    it('summarizes link filters', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [],
        links: [{ sourceWidgetId: 'w1', sourceNodeId: 'a', targetNodeId: 'b', value: 50 }],
        adjacencies: [],
      };

      const summaries = summarizeNetworkFilters(state);

      expect(summaries).toContain('link:a->b@w1(50)');
    });

    it('summarizes adjacency filters', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [],
        links: [],
        adjacencies: [
          {
            sourceWidgetId: 'w1',
            centerNodeId: 'center',
            adjacentNodeIds: ['n1', 'n2', 'n3'],
            adjacentLinks: [],
          },
        ],
      };

      const summaries = summarizeNetworkFilters(state);

      expect(summaries).toContain('adjacency:center@w1[3 connected]');
    });
  });

  describe('isNodeFiltered', () => {
    it('returns true for direct node filter', () => {
      const state: NetworkFilterState = {
        nodes: [{ sourceWidgetId: 'w1', nodeId: 'n1' }],
        paths: [],
        links: [],
        adjacencies: [],
      };

      expect(isNodeFiltered(state, 'n1')).toBe(true);
      expect(isNodeFiltered(state, 'n2')).toBe(false);
    });

    it('returns true for adjacency center node', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [],
        links: [],
        adjacencies: [
          {
            sourceWidgetId: 'w1',
            centerNodeId: 'center',
            adjacentNodeIds: ['n1'],
            adjacentLinks: [],
          },
        ],
      };

      expect(isNodeFiltered(state, 'center')).toBe(true);
    });

    it('returns true for adjacent nodes', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [],
        links: [],
        adjacencies: [
          {
            sourceWidgetId: 'w1',
            centerNodeId: 'center',
            adjacentNodeIds: ['n1', 'n2'],
            adjacentLinks: [],
          },
        ],
      };

      expect(isNodeFiltered(state, 'n1')).toBe(true);
      expect(isNodeFiltered(state, 'n2')).toBe(true);
      expect(isNodeFiltered(state, 'n3')).toBe(false);
    });

    it('returns true for nodes in link filters', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [],
        links: [{ sourceWidgetId: 'w1', sourceNodeId: 'a', targetNodeId: 'b' }],
        adjacencies: [],
      };

      expect(isNodeFiltered(state, 'a')).toBe(true);
      expect(isNodeFiltered(state, 'b')).toBe(true);
      expect(isNodeFiltered(state, 'c')).toBe(false);
    });
  });

  describe('isPathFiltered', () => {
    it('returns true for exact path match', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [{ sourceWidgetId: 'w1', path: ['Root', 'Parent'], depth: 2 }],
        links: [],
        adjacencies: [],
      };

      expect(isPathFiltered(state, ['Root', 'Parent'])).toBe(true);
    });

    it('returns true for child paths (prefix match)', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [{ sourceWidgetId: 'w1', path: ['Root', 'Parent'], depth: 2 }],
        links: [],
        adjacencies: [],
      };

      expect(isPathFiltered(state, ['Root', 'Parent', 'Child'])).toBe(true);
      expect(isPathFiltered(state, ['Root', 'Parent', 'Child', 'GrandChild'])).toBe(true);
    });

    it('returns false for parent paths', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [{ sourceWidgetId: 'w1', path: ['Root', 'Parent'], depth: 2 }],
        links: [],
        adjacencies: [],
      };

      expect(isPathFiltered(state, ['Root'])).toBe(false);
    });

    it('returns false for unrelated paths', () => {
      const state: NetworkFilterState = {
        nodes: [],
        paths: [{ sourceWidgetId: 'w1', path: ['Root', 'Parent'], depth: 2 }],
        links: [],
        adjacencies: [],
      };

      expect(isPathFiltered(state, ['Other', 'Path'])).toBe(false);
    });
  });

  describe('getFilteredNodeIds', () => {
    it('collects all filtered node IDs', () => {
      const state: NetworkFilterState = {
        nodes: [{ sourceWidgetId: 'w1', nodeId: 'n1' }],
        paths: [],
        links: [{ sourceWidgetId: 'w2', sourceNodeId: 'a', targetNodeId: 'b' }],
        adjacencies: [
          {
            sourceWidgetId: 'w3',
            centerNodeId: 'center',
            adjacentNodeIds: ['adj1', 'adj2'],
            adjacentLinks: [],
          },
        ],
      };

      const nodeIds = getFilteredNodeIds(state);

      expect(nodeIds.has('n1')).toBe(true);
      expect(nodeIds.has('a')).toBe(true);
      expect(nodeIds.has('b')).toBe(true);
      expect(nodeIds.has('center')).toBe(true);
      expect(nodeIds.has('adj1')).toBe(true);
      expect(nodeIds.has('adj2')).toBe(true);
      expect(nodeIds.size).toBe(6);
    });
  });
});
