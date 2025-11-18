import type { ClassificationMetadata } from '@/schemas/classification/classification-metadata.js';
import type { CategoryNode } from '@/schemas/classification/category-node.js';
import type { Tag } from '@/schemas/classification/tag.js';

export interface ClassifiableRecord {
  readonly classification_metadata: ClassificationMetadata;
  readonly categories?: readonly CategoryNode[];
  readonly primary_category_id?: string;
  readonly primary_category_path?: string;
  readonly tags?: readonly Tag[];
  readonly tag_count?: number;
}

export interface FacetSelection {
  readonly categoryIds?: readonly string[];
  readonly tagSlugs?: readonly string[];
}

export interface FacetBucket {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly type: 'category' | 'tag';
}

export interface FacetedSearchResult<T extends ClassifiableRecord> {
  readonly items: readonly T[];
  readonly categories: readonly FacetBucket[];
  readonly tags: readonly FacetBucket[];
}

export interface BreadcrumbOptions {
  /**
   * Optional lookup of known categories for breadcrumb construction.
   */
  readonly catalog?: ReadonlyMap<string, CategoryNode> | readonly CategoryNode[];
}

export function runFacetedSearch<T extends ClassifiableRecord>(
  items: readonly T[],
  selection: FacetSelection = {}
): FacetedSearchResult<T> {
  const filtered = filterClassifiableItems(items, selection);
  const categories = buildCategoryBuckets(filtered);
  const tags = buildTagBuckets(filtered);
  return {
    items: filtered,
    categories,
    tags,
  };
}

export function filterClassifiableItems<T extends ClassifiableRecord>(
  items: readonly T[],
  selection: FacetSelection = {}
): readonly T[] {
  if (!items || items.length === 0) {
    return [];
  }

  const categorySet = new Set(normalizeStrings(selection.categoryIds));
  const tagSet = new Set(normalizeStrings(selection.tagSlugs));

  if (categorySet.size === 0 && tagSet.size === 0) {
    return [...items];
  }

  return items.filter((item) => {
    const categoryMatch =
      categorySet.size === 0 || hasCategoryMatch(item.categories, categorySet, item.primary_category_id);
    const tagMatch = tagSet.size === 0 || hasTagMatch(item.tags, tagSet);
    return categoryMatch && tagMatch;
  });
}

export function buildCategoryIndex(nodes: readonly CategoryNode[]): ReadonlyMap<string, CategoryNode> {
  const map = new Map<string, CategoryNode>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

export function buildCategoryBreadcrumb(
  item: ClassifiableRecord,
  options: BreadcrumbOptions = {}
): CategoryNode[] {
  const primaryId = item.primary_category_id;
  if (!primaryId) {
    return [];
  }

  const index = resolveCategoryIndex(options.catalog, item.categories);
  const primaryNode = index.get(primaryId);
  if (!primaryNode) {
    return [];
  }

  const breadcrumbs: CategoryNode[] = [];
  for (const ancestorId of primaryNode.ancestors ?? []) {
    const ancestor = index.get(ancestorId);
    if (ancestor) {
      breadcrumbs.push(ancestor);
    }
  }
  breadcrumbs.push(primaryNode);
  return breadcrumbs;
}

function resolveCategoryIndex(
  catalog: BreadcrumbOptions['catalog'],
  categories: readonly CategoryNode[] | undefined
): ReadonlyMap<string, CategoryNode> {
  if (catalog && catalog instanceof Map) {
    if (!categories || categories.length === 0) {
      return catalog;
    }
    const merged = new Map(catalog);
    for (const node of categories) {
      merged.set(node.id, node);
    }
    return merged;
  }

  const resolved = new Map<string, CategoryNode>();
  if (Array.isArray(catalog)) {
    for (const node of catalog) {
      resolved.set(node.id, node);
    }
  }
  if (categories) {
    for (const node of categories) {
      resolved.set(node.id, node);
    }
  }
  return resolved;
}

function buildCategoryBuckets<T extends ClassifiableRecord>(items: readonly T[]): FacetBucket[] {
  const counts = new Map<string, FacetBucket>();
  for (const item of items) {
    if (!item.categories || item.categories.length === 0) {
      continue;
    }
    const seen = new Set<string>();
    for (const node of item.categories) {
      if (!node?.id || seen.has(node.id)) {
        continue;
      }
      seen.add(node.id);
      const existing = counts.get(node.id);
      const nextBucket =
        existing !== undefined
          ? { ...existing, count: existing.count + 1 }
          : {
              id: node.id,
              label: node.name,
              count: 1,
              type: 'category' as const,
            };
      counts.set(node.id, nextBucket);
    }
  }
  return sortBuckets(counts);
}

function buildTagBuckets<T extends ClassifiableRecord>(items: readonly T[]): FacetBucket[] {
  const counts = new Map<string, FacetBucket>();
  for (const item of items) {
    if (!item.tags || item.tags.length === 0) {
      continue;
    }
    const seen = new Set<string>();
    for (const tag of item.tags) {
      const id = (tag?.slug ?? tag?.id ?? '').toLowerCase();
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const existing = counts.get(id);
      const nextBucket =
        existing !== undefined
          ? { ...existing, count: existing.count + 1 }
          : {
              id,
              label: tag.name,
              count: 1,
              type: 'tag' as const,
            };
      counts.set(id, nextBucket);
    }
  }
  return sortBuckets(counts);
}

function sortBuckets(map: Map<string, FacetBucket>): FacetBucket[] {
  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
}

function hasCategoryMatch(
  categories: readonly CategoryNode[] | undefined,
  selection: ReadonlySet<string>,
  primaryId?: string
): boolean {
  if (!categories || categories.length === 0) {
    return false;
  }
  for (const node of categories) {
    if (selection.has(node.id) || selection.has(node.slug)) {
      return true;
    }
  }
  return primaryId ? selection.has(primaryId) : false;
}

function hasTagMatch(tags: readonly Tag[] | undefined, selection: ReadonlySet<string>): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }
  for (const tag of tags) {
    if (!tag) {
      continue;
    }
    const slug = tag.slug?.toLowerCase();
    if (slug && selection.has(slug)) {
      return true;
    }
    if (tag.id && selection.has(tag.id.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function normalizeStrings(values: readonly string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return values
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
}
