// Auto-generated from traits/sortable.parameters.schema.json. Do not edit manually.

/**
 * Controls column sorting behavior in list and table views.
 */
export interface SortableTraitParameters {
  /**
   * The field name to sort by on initial load. Empty means no default sort.
   */
  defaultSortField?: string;
  /**
   * Default sort direction on initial load.
   */
  defaultSortDirection?: 'asc' | 'desc';
  /**
   * List of field names that support sorting. When empty, all fields are sortable.
   */
  sortableFields?: string[];
  /**
   * When true, sort cycles through ascending, descending, none. When false, toggles between ascending and descending only.
   */
  triStateSort?: boolean;
}
