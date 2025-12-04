// Auto-generated from viz/force-output.schema.json. Do not edit manually.

/**
 * Output structure for force-directed network layouts.
 */
export interface ForceLayoutOutput {
  /**
   * Nodes with solved x/y positions.
   */
  nodes: ForceNode[];
  /**
   * Links containing denormalized coordinates.
   */
  links: ForceLink[];
}
export interface ForceNode {
  /**
   * Node identifier.
   */
  id: string;
  /**
   * Solved x position.
   */
  x: number;
  /**
   * Solved y position.
   */
  y: number;
  [k: string]: unknown;
}
export interface ForceLink {
  /**
   * Source node ID.
   */
  source: string;
  /**
   * Target node ID.
   */
  target: string;
  /**
   * Source x position.
   */
  x1: number;
  /**
   * Source y position.
   */
  y1: number;
  /**
   * Target x position.
   */
  x2: number;
  /**
   * Target y position.
   */
  y2: number;
  [k: string]: unknown;
}
