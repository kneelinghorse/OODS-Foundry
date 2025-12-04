// Auto-generated from viz/sunburst-output.schema.json. Do not edit manually.

/**
 * Output structure for sunburst/partition layouts.
 */
export interface SunburstTransformOutput {
  /**
   * Flattened list of partition nodes.
   */
  nodes: SunburstNode[];
}
export interface SunburstNode {
  /**
   * Node identifier inherited from input.
   */
  id: string;
  /**
   * Arc start angle in radians.
   */
  startAngle: number;
  /**
   * Arc end angle in radians.
   */
  endAngle: number;
  /**
   * Inner radius of the arc.
   */
  innerRadius: number;
  /**
   * Outer radius of the arc.
   */
  outerRadius: number;
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
