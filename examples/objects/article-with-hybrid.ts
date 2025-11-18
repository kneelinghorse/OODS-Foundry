import type { Article } from '../../generated/objects/Article';
import {
  normalizeCategoryNode,
  type CategoryNode,
} from '@/schemas/classification/category-node.js';
import { normalizeClassificationMetadata } from '@/schemas/classification/classification-metadata.js';
import { normalizeTag, type Tag } from '@/schemas/classification/tag.js';

const hybridCategories: CategoryNode[] = [
  normalizeCategoryNode({
    id: 'kb_platform',
    slug: 'platform',
    name: 'Platform',
    path: ['knowledge-base', 'platform'],
    ancestors: ['knowledge-base'],
    childCount: 8,
    metadata: { source: 'kb', sortKey: 1 },
    depth: 1,
    mode: 'taxonomy',
    isSelectable: true,
  }),
  normalizeCategoryNode({
    id: 'kb_platform_traits',
    slug: 'traits',
    name: 'Traits',
    path: ['knowledge-base', 'platform', 'traits'],
    parentId: 'kb_platform',
    ancestors: ['knowledge-base', 'kb_platform'],
    childCount: 4,
    metadata: { source: 'kb', sortKey: 4 },
    depth: 2,
    mode: 'taxonomy',
    isSelectable: true,
  }),
];

const hybridTags: Tag[] = [
  normalizeTag({
    id: 'tag_classification',
    name: 'Classification',
    slug: 'classification',
    usageCount: 184,
    synonyms: ['taxonomy', 'category'],
    state: 'active',
    isCanonical: true,
  }),
  normalizeTag({
    id: 'tag_hybrid',
    name: 'Hybrid Mode',
    slug: 'hybrid-mode',
    usageCount: 67,
    synonyms: ['wordpress'],
    state: 'active',
    isCanonical: true,
  }),
  normalizeTag({
    id: 'tag_oklch',
    name: 'OKLCH',
    slug: 'oklch',
    usageCount: 21,
    synonyms: ['color'],
    state: 'active',
    isCanonical: true,
  }),
];

const articleClassificationMetadata = normalizeClassificationMetadata({
  mode: 'hybrid',
  hierarchyStorageModel: 'materialized_path',
  tagPolicy: 'moderated',
  tagLimit: 24,
  primaryCategoryRequired: true,
  governance: {
    synonymsEnabled: true,
    moderationQueue: true,
    spamHeuristics: {
      maxTagsPerItem: 24,
      velocityThreshold: 20,
    },
  },
  source: {
    dataset: 'kb_articles',
    version: '2025.46',
    generatedAt: '2025-11-18T21:10:00Z',
  },
});

export const ArticleWithCategoriesAndTags: Article = {
  article_id: 'art_classifiable_001',
  slug: 'classifiable-trait-hybrid-guide',
  label: 'Implementing the Classifiable Trait in Hybrid Mode',
  description: 'Step-by-step guide for wiring taxonomy + tag workflows for Articles.',
  placeholder: 'Search articles...',
  content_type: 'how_to',
  author_id: 'usr_ba41cafe',
  reading_time_minutes: 12,
  hero_media_id: 'media_hero_triatlas',
  locale: 'en-US',
  body_markdown: `
## Overview

Hybrid mode pairs WordPress-style terms with ltree-backed categories.

### Steps

1. Extend Product + content objects with \`core/Classifiable\`.
2. Configure the HybridTermAdapter for WordPress-style three-table syncs.
3. Use \`CategoryBreadcrumb\` + \`TagList\` to project context-aware metadata.
`.trim(),
  excerpt: 'Hybrid Classifiable walkthrough for Product + Content objects.',
  status: 'published',
  created_at: '2025-11-05T14:00:00Z',
  updated_at: '2025-11-18T21:12:00Z',
  last_event: 'updated',
  last_event_at: '2025-11-18T21:12:00Z',
  published_at: '2025-11-12T10:00:00Z',
  categories: hybridCategories,
  classification_metadata: articleClassificationMetadata,
  primary_category_id: 'kb_platform_traits',
  primary_category_path: 'Knowledge Base › Platform › Traits',
  tags: hybridTags,
  tag_count: hybridTags.length,
  tag_preview: hybridTags.map((tag) => tag.name).join(', '),
};
