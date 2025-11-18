// Auto-generated from classification/classification-metadata.schema.json. Do not edit manually.

/**
 * Operational metadata describing classification execution parameters and governance state.
 */
export interface ClassificationMetadata {
  mode: 'taxonomy' | 'tag' | 'hybrid';
  hierarchyStorageModel: 'adjacency_list' | 'materialized_path' | 'closure_table';
  tagPolicy: 'locked' | 'moderated' | 'open';
  tagLimit: number;
  primaryCategoryRequired: boolean;
  taxonomyVersion?: string;
  lastIndexedAt?: string;
  governance: {
    synonymsEnabled: boolean;
    moderationQueue: boolean;
    spamHeuristics: {
      maxTagsPerItem: number;
      velocityThreshold: number;
    };
  };
  source: {
    dataset?: string;
    version?: string;
    generatedAt?: string;
  };
}
