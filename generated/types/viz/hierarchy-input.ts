// Auto-generated from viz/hierarchy-input.schema.json. Do not edit manually.

/**
 * Input formats for hierarchy visualizations (treemap, sunburst). Supports adjacency lists and nested JSON structures.
 */
export type HierarchyInput = HierarchyAdjacencyInput | HierarchyNestedInput;

export interface HierarchyAdjacencyInput {
  /**
   * Identifies the adjacency list format.
   */
  type: 'adjacency_list';
  /**
   * Flat list of nodes with parentId references.
   *
   * @minItems 1
   */
  data: [AdjacencyNode, ...AdjacencyNode[]];
}
export interface AdjacencyNode {
  /**
   * Unique identifier for the node.
   */
  id: string;
  /**
   * Parent node ID; null indicates the root.
   */
  parentId: string | null;
  /**
   * Measure used for sizing the node.
   */
  value: number;
  /**
   * Optional display label.
   */
  name?: string;
  [k: string]: unknown;
}
export interface HierarchyNestedInput {
  /**
   * Identifies the nested JSON format.
   */
  type: 'nested';
  data: NestedNode;
}
/**
 * Root node containing nested children.
 */
export interface NestedNode {
  /**
   * Node label.
   */
  name: string;
  /**
   * Measure used for sizing the node.
   */
  value?: number;
  /**
   * Nested child nodes.
   */
  children?: NestedNode1[];
  [k: string]: unknown;
}
export interface NestedNode1 {
  /**
   * Node label.
   */
  name: string;
  /**
   * Measure used for sizing the node.
   */
  value?: number;
  /**
   * Nested child nodes.
   */
  children?: NestedNode1[];
  [k: string]: unknown;
}
