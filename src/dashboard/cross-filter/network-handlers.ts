/**
 * Network Cross-Filter Handlers
 *
 * Cross-filter action creators and reducer for Network & Flow visualizations.
 * Follows the spatial filter pattern from spatial-filter-actions.ts
 *
 * Filter types:
 * - Node selection (single node in network/hierarchy)
 * - Path selection (hierarchy path in treemap/sunburst)
 * - Link selection (edge in network/sankey)
 * - Adjacency selection (node + connected nodes in network)
 */

import type { GraphNode, GraphLink } from '@/components/viz/ForceGraph.js';
import type { TreemapNode } from '@/components/viz/Treemap.js';
import type { SunburstNode } from '@/components/viz/Sunburst.js';
import type { SankeyNodeOutput, SankeyLinkOutput } from '@/components/viz/Sankey.js';

// ============================================================================
// Action Types
// ============================================================================

export type NetworkFilterAction =
  | { readonly type: 'FILTER_BY_NODE'; readonly payload: NodeFilterState }
  | { readonly type: 'FILTER_BY_PATH'; readonly payload: PathFilterState }
  | { readonly type: 'FILTER_BY_LINK'; readonly payload: LinkFilterState }
  | { readonly type: 'FILTER_BY_ADJACENCY'; readonly payload: AdjacencyFilterState }
  | { readonly type: 'CLEAR_NETWORK_FILTER'; readonly payload?: { readonly sourceWidgetId?: string } };

// ============================================================================
// Filter State Types
// ============================================================================

export interface NodeFilterState {
  readonly sourceWidgetId: string;
  readonly nodeId: string;
  readonly nodeName?: string;
  readonly nodeGroup?: string;
  readonly nodeValue?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface PathFilterState {
  readonly sourceWidgetId: string;
  /** Full path from root to selected node */
  readonly path: readonly string[];
  /** Depth level of the selection */
  readonly depth: number;
  /** Value at this path */
  readonly value?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface LinkFilterState {
  readonly sourceWidgetId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly value?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface AdjacencyFilterState {
  readonly sourceWidgetId: string;
  /** Central node ID */
  readonly centerNodeId: string;
  /** Connected node IDs (incoming and outgoing) */
  readonly adjacentNodeIds: readonly string[];
  /** Connected link definitions */
  readonly adjacentLinks: readonly { source: string; target: string; value?: number }[];
  readonly metadata?: Record<string, unknown>;
}

export interface NetworkFilterState {
  readonly nodes: readonly NodeFilterState[];
  readonly paths: readonly PathFilterState[];
  readonly links: readonly LinkFilterState[];
  readonly adjacencies: readonly AdjacencyFilterState[];
}

export const DEFAULT_NETWORK_FILTER_STATE: NetworkFilterState = Object.freeze({
  nodes: [],
  paths: [],
  links: [],
  adjacencies: [],
});

// ============================================================================
// Action Creators
// ============================================================================

/**
 * Create action for filtering by a single node
 */
export function createNodeFilterAction(
  sourceWidgetId: string,
  node: GraphNode | TreemapNode | SunburstNode | SankeyNodeOutput
): NetworkFilterAction {
  const normalized = normalizeNode(node);
  return {
    type: 'FILTER_BY_NODE',
    payload: {
      sourceWidgetId,
      nodeId: normalized.id,
      nodeName: normalized.name,
      nodeGroup: normalized.group,
      nodeValue: normalized.value,
      metadata: normalized.metadata,
    },
  };
}

/**
 * Create action for filtering by hierarchy path (treemap/sunburst)
 */
export function createPathFilterAction(
  sourceWidgetId: string,
  node: TreemapNode | SunburstNode
): NetworkFilterAction {
  return {
    type: 'FILTER_BY_PATH',
    payload: {
      sourceWidgetId,
      path: node.path,
      depth: node.depth,
      value: node.value,
    },
  };
}

/**
 * Create action for filtering by a link/edge
 */
export function createLinkFilterAction(
  sourceWidgetId: string,
  link: GraphLink | SankeyLinkOutput
): NetworkFilterAction {
  return {
    type: 'FILTER_BY_LINK',
    payload: {
      sourceWidgetId,
      sourceNodeId: link.source,
      targetNodeId: link.target,
      value: link.value,
    },
  };
}

/**
 * Create action for filtering by node adjacency (node + all connected nodes)
 */
export function createAdjacencyFilterAction(
  sourceWidgetId: string,
  centerNodeId: string,
  links: readonly { source: string; target: string; value?: number }[]
): NetworkFilterAction {
  // Find all adjacent nodes from the links
  const adjacentNodeIds = new Set<string>();
  const adjacentLinks: { source: string; target: string; value?: number }[] = [];

  for (const link of links) {
    if (link.source === centerNodeId) {
      adjacentNodeIds.add(link.target);
      adjacentLinks.push(link);
    } else if (link.target === centerNodeId) {
      adjacentNodeIds.add(link.source);
      adjacentLinks.push(link);
    }
  }

  return {
    type: 'FILTER_BY_ADJACENCY',
    payload: {
      sourceWidgetId,
      centerNodeId,
      adjacentNodeIds: Array.from(adjacentNodeIds),
      adjacentLinks,
    },
  };
}

/**
 * Create action to clear network filters
 */
export function createClearNetworkFilterAction(sourceWidgetId?: string): NetworkFilterAction {
  return {
    type: 'CLEAR_NETWORK_FILTER',
    payload: sourceWidgetId ? { sourceWidgetId } : undefined,
  };
}

// ============================================================================
// Reducer
// ============================================================================

/**
 * Network filter reducer
 *
 * Manages filter state for network, hierarchy, and flow visualizations.
 * Replaces existing filter from the same sourceWidgetId to avoid duplicates.
 */
export function networkFilterReducer(
  state: NetworkFilterState = DEFAULT_NETWORK_FILTER_STATE,
  action: NetworkFilterAction
): NetworkFilterState {
  switch (action.type) {
    case 'FILTER_BY_NODE': {
      const filtered = state.nodes.filter(
        (entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId
      );
      return {
        ...state,
        nodes: [...filtered, action.payload],
      };
    }

    case 'FILTER_BY_PATH': {
      const filtered = state.paths.filter(
        (entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId
      );
      return {
        ...state,
        paths: [...filtered, action.payload],
      };
    }

    case 'FILTER_BY_LINK': {
      const filtered = state.links.filter(
        (entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId
      );
      return {
        ...state,
        links: [...filtered, action.payload],
      };
    }

    case 'FILTER_BY_ADJACENCY': {
      const filtered = state.adjacencies.filter(
        (entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId
      );
      return {
        ...state,
        adjacencies: [...filtered, action.payload],
      };
    }

    case 'CLEAR_NETWORK_FILTER': {
      if (!action.payload?.sourceWidgetId) {
        return DEFAULT_NETWORK_FILTER_STATE;
      }
      const predicate = (entry: { sourceWidgetId: string }) =>
        entry.sourceWidgetId !== action.payload?.sourceWidgetId;
      return {
        nodes: state.nodes.filter(predicate),
        paths: state.paths.filter(predicate),
        links: state.links.filter(predicate),
        adjacencies: state.adjacencies.filter(predicate),
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Interaction Bindings
// ============================================================================

export interface NetworkInteractionBindings {
  readonly onNodeSelect: (node: GraphNode | TreemapNode | SunburstNode | SankeyNodeOutput) => void;
  readonly onPathSelect: (node: TreemapNode | SunburstNode) => void;
  readonly onLinkSelect: (link: GraphLink | SankeyLinkOutput) => void;
  readonly onAdjacencySelect: (
    centerNodeId: string,
    links: readonly { source: string; target: string; value?: number }[]
  ) => void;
  readonly clear: () => void;
}

/**
 * Create interaction bindings for network widgets
 *
 * @example
 * ```tsx
 * const bindings = createNetworkInteractionBindings('my-graph', dispatch);
 *
 * <ForceGraph
 *   data={data}
 *   onSelect={bindings.onNodeSelect}
 *   onLinkSelect={bindings.onLinkSelect}
 * />
 * ```
 */
export function createNetworkInteractionBindings(
  sourceWidgetId: string,
  dispatch?: (action: NetworkFilterAction) => void
): NetworkInteractionBindings {
  const send = dispatch ?? (() => {});

  return {
    onNodeSelect: (node) => send(createNodeFilterAction(sourceWidgetId, node)),
    onPathSelect: (node) => send(createPathFilterAction(sourceWidgetId, node)),
    onLinkSelect: (link) => send(createLinkFilterAction(sourceWidgetId, link)),
    onAdjacencySelect: (centerNodeId, links) =>
      send(createAdjacencyFilterAction(sourceWidgetId, centerNodeId, links)),
    clear: () => send(createClearNetworkFilterAction(sourceWidgetId)),
  };
}

// ============================================================================
// Filter Utilities
// ============================================================================

/**
 * Summarize current filter state for debugging/display
 */
export function summarizeNetworkFilters(state: NetworkFilterState): string[] {
  const summaries: string[] = [];

  for (const node of state.nodes) {
    summaries.push(
      `node:${node.nodeId}@${node.sourceWidgetId}${node.nodeName ? `(${node.nodeName})` : ''}`
    );
  }

  for (const path of state.paths) {
    summaries.push(
      `path:${path.path.join('/')}@${path.sourceWidgetId}[depth=${path.depth}]`
    );
  }

  for (const link of state.links) {
    summaries.push(
      `link:${link.sourceNodeId}->${link.targetNodeId}@${link.sourceWidgetId}${
        link.value !== undefined ? `(${link.value})` : ''
      }`
    );
  }

  for (const adj of state.adjacencies) {
    summaries.push(
      `adjacency:${adj.centerNodeId}@${adj.sourceWidgetId}[${adj.adjacentNodeIds.length} connected]`
    );
  }

  return summaries;
}

/**
 * Check if a node ID matches any active filter
 */
export function isNodeFiltered(state: NetworkFilterState, nodeId: string): boolean {
  // Check direct node filters
  if (state.nodes.some((n) => n.nodeId === nodeId)) {
    return true;
  }

  // Check adjacency filters (center or adjacent)
  for (const adj of state.adjacencies) {
    if (adj.centerNodeId === nodeId || adj.adjacentNodeIds.includes(nodeId)) {
      return true;
    }
  }

  // Check link filters (source or target)
  for (const link of state.links) {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a path matches any active path filter (prefix match)
 */
export function isPathFiltered(state: NetworkFilterState, path: readonly string[]): boolean {
  for (const filter of state.paths) {
    // Check if the filter path is a prefix of the given path
    if (filter.path.length <= path.length) {
      const isPrefix = filter.path.every((segment, i) => segment === path[i]);
      if (isPrefix) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get all filtered node IDs from current state
 */
export function getFilteredNodeIds(state: NetworkFilterState): Set<string> {
  const nodeIds = new Set<string>();

  // Direct node filters
  for (const node of state.nodes) {
    nodeIds.add(node.nodeId);
  }

  // Adjacency filters
  for (const adj of state.adjacencies) {
    nodeIds.add(adj.centerNodeId);
    for (const id of adj.adjacentNodeIds) {
      nodeIds.add(id);
    }
  }

  // Link filters
  for (const link of state.links) {
    nodeIds.add(link.sourceNodeId);
    nodeIds.add(link.targetNodeId);
  }

  return nodeIds;
}

// ============================================================================
// Internal Helpers
// ============================================================================

interface NormalizedNode {
  id: string;
  name?: string;
  group?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

function normalizeNode(node: GraphNode | TreemapNode | SunburstNode | SankeyNodeOutput): NormalizedNode {
  // GraphNode: { id, name, group?, value? }
  if ('id' in node && typeof node.id === 'string') {
    const graphNode = node as GraphNode;
    return {
      id: graphNode.id,
      name: graphNode.name,
      group: graphNode.group,
      value: graphNode.value,
    };
  }

  // TreemapNode/SunburstNode: { name, value, depth, path }
  if ('path' in node && Array.isArray(node.path)) {
    const hierarchyNode = node as TreemapNode | SunburstNode;
    return {
      id: hierarchyNode.path.join('/'),
      name: hierarchyNode.name,
      value: hierarchyNode.value,
      metadata: { depth: hierarchyNode.depth, path: hierarchyNode.path },
    };
  }

  // SankeyNodeOutput: { name, ... }
  if ('name' in node && typeof node.name === 'string') {
    const sankeyNode = node as SankeyNodeOutput;
    return {
      id: sankeyNode.name,
      name: sankeyNode.name,
    };
  }

  // Fallback
  return {
    id: 'unknown',
    name: 'Unknown Node',
  };
}
