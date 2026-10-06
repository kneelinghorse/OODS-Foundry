// Auto-generated from traits/mark-graph.parameters.schema.json. Do not edit manually.

/**
 * Read-only chart rendered by public viz.render during code generation. Payment events retain the Subscription projection. Record-array charts bind a declared object array and use authored sampleRows to seed generated sample records, with no separate generated chart series. Edge-array charts bind a declared neighborhood array: sorted distinct node ids, row-ordered directed links, optional bidirectional reverse links deduplicated by ordered pair, without numeric values or groups. Static SVG assets are keyed by seed record identity; consumers can replace the typed svg prop. One distinct chart declaration is supported per generated object; repeated identical projections share the same asset.
 */
export type MarkGraphChartDeclaration = {
  chartType: 'force_graph';
  source: 'edge-array';
  /**
   * Declared objectSchema neighborhood array containing edge records.
   */
  dataField: string;
  edges: {
    source: string;
    target: string;
    /**
     * When declared, every row must contain this boolean; true also emits the reverse directed link.
     */
    bidirectionalField?: string;
  };
  /**
   * Authored, explicitly labelled synthetic neighborhood examples copied to the declared object field.
   *
   * @minItems 1
   */
  sampleRows: [
    {
      [k: string]: unknown;
    },
    ...{
      [k: string]: unknown;
    }[]
  ];
  brand?: string;
};

export interface MarkGraphTraitParameters {
  /**
   * Static SVG returned by public viz.render.
   */
  previewSvg?: string;
  chart?: MarkGraphChartDeclaration;
  /**
   * Title of the read-only chart projection.
   */
  title?: string;
  /**
   * Accessible description of the read-only chart projection.
   */
  description?: string;
}
