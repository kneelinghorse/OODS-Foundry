import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import '../../src/styles/globals.css';
import { CategoryBreadcrumb } from '../../src/components/classification/CategoryBreadcrumb.js';
import { TagList } from '../../src/components/classification/TagList.js';
import { runFacetedSearch, buildCategoryBreadcrumb } from '../../src/search/faceted-search.js';
import type { FacetBucket } from '../../src/search/faceted-search.js';
import type { Article } from '../../generated/objects/Article';
import type { Product } from '../../generated/objects/Product';
import { ProductWithCategoriesExample } from '../../examples/objects/product-with-categories';
import { ArticleWithCategoriesAndTags } from '../../examples/objects/article-with-hybrid';
import { normalizeTag } from '../../src/schemas/classification/tag.js';

type CatalogEntry =
  | (Product & { readonly kind: 'product' })
  | (Article & { readonly kind: 'article' });

const productVariant: Product = {
  ...ProductWithCategoriesExample,
  product_id: 'prod_classifiable_002',
  sku: 'SKU-CLASS-EDGE',
  label: 'Axiom Edge VR Kit',
  summary_blurb: 'Modular VR hardware bundle focused on immersive commerce demos.',
  categories: Array.from(ProductWithCategoriesExample.categories ?? []).slice(0, 2),
  primary_category_id: 'cat_mobile',
  primary_category_path: 'Hardware › Mobile',
};

const articleVariant: Article = {
  ...ArticleWithCategoriesAndTags,
  article_id: 'art_classifiable_002',
  slug: 'taxonomy-governance-playbook',
  label: 'Taxonomy Governance Playbook',
  description: 'Operational guide for curating enterprise category trees.',
  tags: [
    normalizeTag({
      id: 'tag_taxonomy',
      name: 'Taxonomy',
      usageCount: 215,
      synonyms: ['category-tree'],
    }),
    normalizeTag({
      id: 'tag-governance',
      name: 'Governance',
      usageCount: 87,
      synonyms: ['moderation'],
    }),
  ],
  tag_count: 2,
  tag_preview: 'Taxonomy, Governance',
  primary_category_id: 'kb_platform',
  primary_category_path: 'Knowledge Base › Platform',
};

const DATASET: CatalogEntry[] = [
  { kind: 'product', ...ProductWithCategoriesExample },
  { kind: 'product', ...productVariant },
  { kind: 'article', ...ArticleWithCategoriesAndTags },
  { kind: 'article', ...articleVariant },
];

const meta: Meta<typeof ProductCategoryBrowser> = {
  title: 'Objects/Product/ProductCategoryBrowser',
  component: ProductCategoryBrowser,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Demonstrates Classifiable trait facets: taxonomy-driven filters for Products and tag-driven discovery for Articles.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ProductCategoryBrowser>;

export const CategoryBrowser: Story = {
  name: 'Interactive category facet browser',
  render: () => <ProductCategoryBrowser />,
};

export const ArticleHybridDetail: Story = {
  name: 'Article detail with hybrid tags',
  render: () => <ArticleDetail />,
};

function ProductCategoryBrowser(): React.ReactElement {
  const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
  const [tagSlugs, setTagSlugs] = React.useState<string[]>([]);

  const selection = React.useMemo(
    () => ({
      categoryIds,
      tagSlugs,
    }),
    [categoryIds, tagSlugs]
  );

  const result = React.useMemo(() => runFacetedSearch(DATASET, selection), [selection]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        minHeight: '100vh',
        background: 'var(--cmp-surface-canvas)',
        color: 'var(--sys-text-primary)',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid var(--cmp-border-default)',
          padding: '1.5rem',
          background: 'var(--cmp-surface-panel)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Categories</h3>
        <FacetList
          buckets={result.categories}
          selection={categoryIds}
          onToggle={(id) => toggleSelection(id, setCategoryIds)}
          emptyLabel="No categories present"
        />
        <h3 style={{ marginTop: '2rem' }}>Tags</h3>
        <FacetList
          buckets={result.tags}
          selection={tagSlugs}
          onToggle={(id) => toggleSelection(id, setTagSlugs)}
          emptyLabel="Tags only available for hybrid/tag objects"
        />
      </aside>
      <section
        style={{
          padding: '2rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--cmp-surface-canvas)',
        }}
      >
        <header>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--sys-text-secondary)' }}>
            Showing <strong>{result.items.length}</strong> objects
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>
            Selected categories: {categoryIds.length || 'none'}, tags: {tagSlugs.length || 'none'}
          </p>
        </header>
        {result.items.map((item) => {
          const isProduct = item.kind === 'product';
          const key = `${item.kind}:${isProduct ? item.product_id : (item as Article).article_id}`;
          const breadcrumbNodes = buildCategoryBreadcrumb(item);
          const tags = item.tags ?? [];
          return (
            <article
              key={key}
              style={{
                background: 'var(--cmp-surface-panel)',
                borderRadius: 16,
                padding: '1.5rem',
                border: '1px solid var(--cmp-border-default)',
                boxShadow: '0 12px 30px rgba(2, 6, 23, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--sys-text-secondary)' }}>
                    {isProduct ? 'Product' : 'Article'} •{' '}
                    {isProduct ? (item as Product).sku : (item as Article).slug}
                  </p>
                  <h2 style={{ margin: '0.25rem 0 0 0' }}>{isProduct ? (item as Product).label : (item as Article).label}</h2>
                  <p style={{ margin: 0, color: 'var(--sys-text-secondary)' }}>
                    {isProduct ? (item as Product).summary_blurb : (item as Article).description}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 999,
                    background: 'var(--sys-surface-interactive-primary-default)',
                    border: '1px solid var(--sys-border-strong)',
                    color: 'var(--sys-text-on-interactive)',
                    textTransform: 'capitalize',
                  }}
                >
                  {item.classification_metadata.mode} mode
                </span>
              </div>
              {breadcrumbNodes.length > 0 ? (
                <CategoryBreadcrumb
                  nodes={breadcrumbNodes}
                  className="category-breadcrumb--story"
                  aria-label="Category path"
                />
              ) : null}
              {tags.length > 0 ? (
                <TagList
                  tags={tags}
                  interactive
                  onTagClick={(tag) => toggleSelection(tag.slug ?? tag.id, setTagSlugs)}
                  showUsage
                />
              ) : (
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--sys-text-muted)' }}>
                  No tags applied (taxonomy-only object)
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ArticleDetail(): React.ReactElement {
  return (
    <div
      style={{
        padding: '2rem',
        background: 'var(--cmp-surface-canvas)',
        color: 'var(--sys-text-primary)',
        minHeight: '100vh',
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--cmp-surface-panel)',
          border: '1px solid var(--cmp-border-default)',
          borderRadius: 20,
          padding: '2rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sys-text-secondary)' }}>
          Status: {ArticleWithCategoriesAndTags.status} • Published{' '}
          {new Date(ArticleWithCategoriesAndTags.published_at ?? '').toLocaleDateString()}
        </p>
        <h1 style={{ marginTop: '0.5rem' }}>{ArticleWithCategoriesAndTags.label}</h1>
        <p style={{ fontSize: '1rem', color: 'var(--sys-text-secondary)' }}>{ArticleWithCategoriesAndTags.description}</p>

        <CategoryBreadcrumb
          nodes={buildCategoryBreadcrumb(ArticleWithCategoriesAndTags)}
          className="category-breadcrumb--story"
        />

        <section style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Discoverability tags</h3>
          <TagList tags={ArticleWithCategoriesAndTags.tags ?? []} showUsage interactive={false} />
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Body (excerpt)</h3>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              borderRadius: 12,
              padding: '1rem',
              background: 'var(--cmp-surface-subtle)',
              border: '1px solid var(--cmp-border-default)',
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
              fontSize: '0.85rem',
              color: 'var(--sys-text-primary)',
            }}
          >
            {ArticleWithCategoriesAndTags.body_markdown}
          </pre>
        </section>
      </article>
    </div>
  );
}

interface FacetListProps {
  readonly buckets: readonly FacetBucket[];
  readonly selection: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly emptyLabel: string;
}

function FacetList({ buckets, selection, onToggle, emptyLabel }: FacetListProps): React.ReactElement {
  if (!buckets || buckets.length === 0) {
    return <p style={{ color: 'var(--sys-text-muted)' }}>{emptyLabel}</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {buckets.map((bucket) => {
        const isSelected = selection.includes(bucket.id.toLowerCase());
        return (
          <li key={bucket.id}>
            <button
              type="button"
              onClick={() => onToggle(bucket.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                background: isSelected ? 'var(--cmp-surface-action)' : 'var(--cmp-surface-subtle)',
                border: `1px solid ${
                  isSelected ? 'var(--sys-border-strong)' : 'var(--cmp-border-default)'
                }`,
                color: 'var(--sys-text-primary)',
                cursor: 'pointer',
              }}
            >
              <strong>{bucket.label}</strong>
              <span style={{ float: 'right', color: 'var(--sys-text-muted)' }}>{bucket.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function toggleSelection(id: string, update: React.Dispatch<React.SetStateAction<string[]>>): void {
  const normalized = id.toLowerCase();
  update((current) =>
    current.includes(normalized) ? current.filter((value) => value !== normalized) : [...current, normalized]
  );
}
