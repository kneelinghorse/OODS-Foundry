// Auto-generated from traits/classifiable.parameters.schema.json. Do not edit manually.

/**
 * Configures taxonomy vs tag vs hybrid classification behavior.
 */
export interface ClassifiableTraitParameters {
  /**
   * Switches between taxonomy-only, tag-only, or hybrid storage.
   */
  classification_mode: 'taxonomy' | 'tag' | 'hybrid';
  /**
   * Storage pattern for taxonomy hierarchies.
   */
  hierarchy_storage_model?: 'adjacency_list' | 'materialized_path' | 'closure_table';
  /**
   * Controls governance level for tag creation.
   */
  tag_policy?: 'locked' | 'moderated' | 'open';
  /**
   * Maximum number of canonical tags allowed per object.
   */
  max_tags?: number;
  /**
   * Whether at least one primary category must be selected.
   */
  require_primary_category?: boolean;
}
