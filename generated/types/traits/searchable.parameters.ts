// Auto-generated from traits/searchable.parameters.schema.json. Do not edit manually.

/**
 * Controls search input behavior in list and collection views.
 */
export interface SearchableTraitParameters {
  /**
   * Placeholder text shown in the search input when empty.
   */
  placeholder?: string;
  /**
   * Debounce delay in milliseconds before the search query is emitted.
   */
  debounceMs?: number;
  /**
   * Minimum number of characters before the search triggers.
   */
  minQueryLength?: number;
  /**
   * Whether the search input shows a clear button when non-empty.
   */
  clearable?: boolean;
}
