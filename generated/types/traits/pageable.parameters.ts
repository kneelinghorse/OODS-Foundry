// Auto-generated from traits/pageable.parameters.schema.json. Do not edit manually.

/**
 * Controls pagination behavior in list and collection views.
 */
export interface PageableTraitParameters {
  /**
   * Default number of items per page.
   */
  defaultPageSize?: number;
  /**
   * Available page size choices displayed as a dropdown. Must be sorted ascending.
   *
   * @minItems 1
   */
  pageSizeOptions?: [number, ...number[]];
  /**
   * Whether to display the page size dropdown selector.
   */
  showPageSizeSelector?: boolean;
  /**
   * Whether to display a go-to-page input for direct page navigation.
   */
  showGotoPage?: boolean;
  /**
   * Whether to display the item range indicator (e.g., Showing 26-50 of 312).
   */
  showItemRange?: boolean;
}
