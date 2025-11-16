// Auto-generated from traits/layout-facet.parameters.schema.json. Do not edit manually.

export type LayoutFacetTraitParameters = LayoutFacetTraitParameters1 & LayoutFacetTraitParameters2;
export type LayoutFacetTraitParameters1 = {
  [k: string]: unknown;
};

export interface LayoutFacetTraitParameters2 {
  /**
   * Field used to create facet rows.
   */
  rowField?: string;
  /**
   * Field used to create facet columns.
   */
  columnField?: string;
  /**
   * Direction to wrap when panel count exceeds the budget.
   */
  wrapDirection?: 'row' | 'column' | 'auto';
  /**
   * Maximum panel count rendered simultaneously.
   */
  maxPanels?: number;
  /**
   * Channels that remain synchronized across panels.
   */
  sharedChannels?: ('x' | 'y' | 'color' | 'size' | 'shape' | 'detail')[];
  /**
   * Projection hint consumed by downstream adapters.
   */
  projection?: 'cartesian' | 'polar' | 'radial';
}
