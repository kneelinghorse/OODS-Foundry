// Auto-generated from viz/treemap-output.schema.json. Do not edit manually.

/**
 * Output structure for treemap layout calculations.
 */
export interface TreemapTransformOutput {
  /**
   * Flattened list of treemap nodes with coordinates.
   */
  nodes: TreemapNode[];
}
export interface TreemapNode {
  /**
   * Node identifier inherited from input.
   */
  id: string;
  /**
   * Left edge (pixels).
   */
  x0: number;
  /**
   * Top edge (pixels).
   */
  y0: number;
  /**
   * Right edge (pixels).
   */
  x1: number;
  /**
   * Bottom edge (pixels).
   */
  y1: number;
  /**
   * Depth in the hierarchy.
   */
  depth: number;
  /**
   * Aggregated value for the node.
   */
  value: number;
  [k: string]: unknown;
}
