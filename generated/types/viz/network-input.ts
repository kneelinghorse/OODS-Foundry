// Auto-generated from viz/network-input.schema.json. Do not edit manually.

/**
 * Node/link input contract for force-directed network graphs.
 */
export interface NetworkGraphInput {
  /**
   * List of nodes for the network graph.
   */
  nodes: NetworkNode[];
  /**
   * List of links connecting nodes by ID.
   */
  links: NetworkLink[];
}
export interface NetworkNode {
  /**
   * Unique node identifier.
   */
  id: string;
  /**
   * Optional grouping key for color/legend encoding.
   */
  group?: string;
  /**
   * Optional radius for size encoding.
   */
  radius?: number;
  /**
   * If true, position remains fixed when provided.
   */
  fixed?: boolean;
  /**
   * Initial or fixed x position.
   */
  x?: number;
  /**
   * Initial or fixed y position.
   */
  y?: number;
  [k: string]: unknown;
}
export interface NetworkLink {
  /**
   * Source node ID.
   */
  source: string;
  /**
   * Target node ID.
   */
  target: string;
  /**
   * Optional weight for the link.
   */
  value?: number;
  [k: string]: unknown;
}
