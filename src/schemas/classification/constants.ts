export const CLASSIFICATION_MODES = ['taxonomy', 'tag', 'hybrid'] as const;
export type ClassificationMode = (typeof CLASSIFICATION_MODES)[number];

export const HIERARCHY_STORAGE_MODELS = [
  'adjacency_list',
  'materialized_path',
  'closure_table',
] as const;
export type HierarchyStorageModel = (typeof HIERARCHY_STORAGE_MODELS)[number];

export const TAG_POLICIES = ['locked', 'moderated', 'open'] as const;
export type TagPolicy = (typeof TAG_POLICIES)[number];

export const TAG_STATES = ['active', 'pending_review', 'archived'] as const;
export type TagState = (typeof TAG_STATES)[number];

export const TERM_TAXONOMY_TYPES = ['category', 'tag', 'custom'] as const;
export type TermTaxonomyType = (typeof TERM_TAXONOMY_TYPES)[number];
