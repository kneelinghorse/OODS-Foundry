// Auto-generated from classification/category-node.schema.json. Do not edit manually.

/**
 * Canonical taxonomy node representation supporting taxonomy + hybrid classification modes.
 */
export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId?: string | null;
  ltreePath: string;
  depth: number;
  /**
   * @maxItems 32
   */
  ancestors: string[];
  childCount: number;
  isSelectable: boolean;
  /**
   * @maxItems 32
   */
  synonyms: string[];
  mode: 'taxonomy' | 'tag' | 'hybrid';
  updatedAt?: string;
  metadata?: {
    source?: string;
    externalId?: string;
    sortKey?: number;
  };
}
