import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';
import {
  buildCategoryBreadcrumb,
  runFacetedSearch,
  type ClassifiableRecord,
} from '../../src/search/faceted-search.ts';
import { ProductWithCategoriesExample } from '../../examples/objects/product-with-categories';
import { ArticleWithCategoriesAndTags } from '../../examples/objects/article-with-hybrid';
import type { Product } from '../../generated/objects/Product';
import type { Article } from '../../generated/objects/Article';

const OBJECTS_ROOT = path.resolve('objects');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];

describe('Classifiable integrations', () => {
  let registry: ObjectRegistry;

  beforeAll(async () => {
    registry = new ObjectRegistry({
      roots: [OBJECTS_ROOT],
      watch: false,
    });
    await registry.waitUntilReady();
  });

  afterAll(() => {
    registry.close();
  });

  it('composes taxonomy-mode Classifiable fields for Product', async () => {
    const resolved = await registry.resolve('Product', { traitRoots: TRAIT_ROOTS });
    const { schema, metadata } = resolved.composed;

    expect(metadata.traitOrder).toContain('Classifiable');
    expect(schema.categories, 'Categories field missing from composed schema').toBeDefined();
    expect(schema.classification_metadata, 'Classification metadata field missing').toBeDefined();
    expect(schema.primary_category_id, 'Primary category field missing').toBeDefined();
    expect(schema.tags.type).toBe('Tag[]');

    const generated = generateObjectInterface(resolved);
    expect(generated.traits).toContain('Classifiable');
    expect(generated.code).toContain('classification_metadata: ClassificationMetadata;');
    expect(generated.code).toContain('tags?: Tag[];');
  });

  it('composes hybrid-mode Classifiable fields for Article objects', async () => {
    const resolved = await registry.resolve('Article', { traitRoots: TRAIT_ROOTS });
    const { schema, metadata } = resolved.composed;

    expect(metadata.traitOrder).toContain('Classifiable');
    expect(schema.article_id).toBeDefined();
    expect(schema.categories.type).toBe('CategoryNode[]');
    expect(schema.tags.type).toBe('Tag[]');
    expect(schema.classification_metadata.type).toBe('ClassificationMetadata');

    const generated = generateObjectInterface(resolved);
    expect(generated.traits).toContain('Classifiable');
    expect(generated.code).toContain('Article');
    expect(generated.code).toContain('classification_metadata: ClassificationMetadata;');
  });

  it('filters mixed objects via faceted search helpers', () => {
    const dataset: Array<ClassifiableRecord & { readonly kind: string }> = [
      { kind: 'product', ...(ProductWithCategoriesExample as Product) },
      { kind: 'article', ...(ArticleWithCategoriesAndTags as Article) },
    ];

    const categoryId = ProductWithCategoriesExample.primary_category_id;
    expect(categoryId).toBeDefined();

    const categoryFiltered = runFacetedSearch(dataset, {
      categoryIds: [categoryId as string],
    });
    expect(categoryFiltered.items).toHaveLength(1);
    expect((categoryFiltered.items[0] as Product).product_id).toBe(ProductWithCategoriesExample.product_id);

    const tagSlug = ArticleWithCategoriesAndTags.tags?.[0]?.slug;
    expect(tagSlug).toBeDefined();

    const tagFiltered = runFacetedSearch(dataset, {
      tagSlugs: [tagSlug as string],
    });
    expect(tagFiltered.items).toHaveLength(1);
    expect((tagFiltered.items[0] as Article).article_id).toBe(ArticleWithCategoriesAndTags.article_id);

    const breadcrumb = buildCategoryBreadcrumb(ProductWithCategoriesExample);
    expect(breadcrumb.length).toBeGreaterThan(0);
    expect(breadcrumb[breadcrumb.length - 1]?.id).toBe(ProductWithCategoriesExample.primary_category_id);
  });
});
