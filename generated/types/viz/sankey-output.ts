// Auto-generated from viz/sankey-output.schema.json. Do not edit manually.

/**
 * Output structure for Sankey flow layouts including SVG path data.
 */
export interface SankeyLayoutOutput {
  /**
   * Nodes with positioned rectangles.
   */
  nodes: SankeyNodeOutput[];
  /**
   * Links with width and SVG path information.
   */
  links: SankeyLinkOutput[];
}
export interface SankeyNodeOutput {
  /**
   * Node label.
   */
  name: string;
  /**
   * Left edge.
   */
  x0: number;
  /**
   * Top edge.
   */
  y0: number;
  /**
   * Right edge.
   */
  x1: number;
  /**
   * Bottom edge.
   */
  y1: number;
  /**
   * Aggregated flow through the node.
   */
  value: number;
  [k: string]: unknown;
}
export interface SankeyLinkOutput {
  /**
   * Source node name.
   */
  source: string;
  /**
   * Target node name.
   */
  target: string;
  /**
   * Flow magnitude.
   */
  value: number;
  /**
   * Visual width of the link.
   */
  width: number;
  /**
   * Source offset.
   */
  y0: number;
  /**
   * Target offset.
   */
  y1: number;
  /**
   * SVG path string for the link.
   */
  svgPath: string;
  [k: string]: unknown;
}
