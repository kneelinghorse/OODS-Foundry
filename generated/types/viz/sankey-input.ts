// Auto-generated from viz/sankey-input.schema.json. Do not edit manually.

/**
 * Node/link input contract for Sankey and flow diagrams.
 */
export interface SankeyFlowInput {
  /**
   * List of flow nodes keyed by name.
   */
  nodes: SankeyNode[];
  /**
   * Links describing flow between named nodes.
   */
  links: SankeyLink[];
}
export interface SankeyNode {
  /**
   * Node label used for link references.
   */
  name: string;
  [k: string]: unknown;
}
export interface SankeyLink {
  /**
   * Source node name.
   */
  source: string;
  /**
   * Target node name.
   */
  target: string;
  /**
   * Magnitude of flow (required for Sankey).
   */
  value: number;
  [k: string]: unknown;
}
