import { describe, expect, it } from 'vitest';

import { normalizeCategoryNode } from '@/schemas/classification/category-node.ts';
import { normalizeTag } from '@/schemas/classification/tag.ts';
import { normalizeClassificationMetadata } from '@/schemas/classification/classification-metadata.ts';

describe('CategoryNode schema', () => {
  it('normalizes identifiers, slugs, and ltree paths from flexible input', () => {
    const node = normalizeCategoryNode({
      id: 'Cat-Mobile',
      name: 'Mobile Phones',
      parentId: 'electronics',
      ancestors: ['electronics'],
      path: '/electronics/mobile-phones/',
    });

    expect(node.id).toBe('cat-mobile');
    expect(node.slug).toBe('mobile-phones');
    expect(node.ltreePath).toBe('electronics.mobile_phones');
    expect(node.depth).toBe(1);
    expect(node.ancestors).toEqual(['electronics']);
  });

  it('derives ltree path from ancestors when not provided', () => {
    const node = normalizeCategoryNode({
      id: 'android-cases',
      name: 'Android Cases',
      ancestors: ['electronics', 'mobile-accessories'],
    });

    expect(node.ltreePath).toBe('electronics.mobile_accessories.android_cases');
    expect(node.depth).toBe(2);
  });
});

describe('Tag schema', () => {
  it('deduplicates synonyms and normalizes identifiers', () => {
    const tag = normalizeTag({
      id: 'JS',
      name: 'JavaScript',
      synonyms: ['js', 'JavaScript', ' front-end '],
      usageCount: 12,
      state: 'pending_review',
    });

    expect(tag.id).toBe('js');
    expect(tag.slug).toBe('javascript');
    expect(tag.synonyms).toEqual(['js', 'javascript', 'front-end']);
    expect(tag.state).toBe('pending_review');
  });
});

describe('ClassificationMetadata schema', () => {
  it('applies defaults and enforces governance guards', () => {
    const metadata = normalizeClassificationMetadata({
      mode: 'taxonomy',
      hierarchyStorageModel: 'materialized_path',
      tagPolicy: 'locked',
      tagLimit: 5,
      governance: {
        synonymsEnabled: false,
        moderationQueue: true,
        spamHeuristics: {
          maxTagsPerItem: 5,
          velocityThreshold: 10,
        },
      },
    });

    expect(metadata.mode).toBe('taxonomy');
    expect(metadata.tagPolicy).toBe('locked');
    expect(metadata.tagLimit).toBe(5);
    expect(metadata.governance.synonymsEnabled).toBe(false);
    expect(metadata.governance.spamHeuristics.maxTagsPerItem).toBe(5);
  });

  it('fills defaults when optional input is omitted', () => {
    const metadata = normalizeClassificationMetadata(undefined);

    expect(metadata.mode).toBe('hybrid');
    expect(metadata.hierarchyStorageModel).toBe('materialized_path');
    expect(metadata.tagLimit).toBe(10);
    expect(metadata.governance.spamHeuristics.velocityThreshold).toBe(100);
  });
});
