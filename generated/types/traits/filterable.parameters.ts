// Auto-generated from traits/filterable.parameters.schema.json. Do not edit manually.

/**
 * Controls multi-facet filtering behavior in list and collection views.
 */
export interface FilterableTraitParameters {
  /**
   * Controls when filter changes take effect: immediate (on change) or batch (on apply).
   */
  filterMode?: 'immediate' | 'batch';
  /**
   * Maximum number of simultaneous active filters. 0 means unlimited.
   */
  maxActiveFilters?: number;
  /**
   * Whether to display a badge showing the number of active filters.
   */
  showFilterCount?: boolean;
  /**
   * Whether filter panel sections can be collapsed individually.
   */
  collapsible?: boolean;
}
