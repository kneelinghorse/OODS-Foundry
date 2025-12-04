/**
 * Article Object — Content Management Demo
 *
 * Article represents content and demonstrates how traits compose:
 * - Labelled: Title, subtitle, description
 * - Stateful: Publishing workflow (draft -> review -> published -> archived)
 * - Ownerable: Author attribution and ownership
 * - Classifiable: Category and tag assignment
 * - Timestampable: Created, updated, published timestamps
 *
 * Stories:
 * 1. Overview - What is an Article object?
 * 2. Article Views - List, card, and detail layouts
 * 3. Publishing Workflow - State transitions for content
 * 4. Classification - Categories and tags management
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1100px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '0.5rem',
  },
  subheading: {
    color: '#666',
    marginTop: 0,
    marginBottom: '2rem',
    fontWeight: 400 as const,
  },
  section: {
    marginBottom: '3rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '0.75rem',
    fontWeight: 600 as const,
  },
  card: {
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  codeBlock: {
    padding: '1rem',
    borderRadius: '0.5rem',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    overflow: 'auto' as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Type definitions
 * ───────────────────────────────────────────────────────────────────────────── */

type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

interface Author {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface ArticleVersion {
  version: number;
  updated_at: string;
  updated_by: string;
  summary: string;
}

interface Article {
  id: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  content: string;
  status: ArticleStatus;
  author: Author;
  category: Category;
  tags: string[];
  featured_image?: string;
  reading_time: number;
  versions: ArticleVersion[];
  created_at: string;
  updated_at: string;
  published_at?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const CATEGORIES: Category[] = [
  { id: 'cat_tech', name: 'Technology', slug: 'technology', color: '#3b82f6' },
  { id: 'cat_design', name: 'Design', slug: 'design', color: '#8b5cf6' },
  { id: 'cat_business', name: 'Business', slug: 'business', color: '#10b981' },
  { id: 'cat_tutorial', name: 'Tutorials', slug: 'tutorials', color: '#f59e0b' },
];

const SAMPLE_ARTICLES: Article[] = [
  {
    id: 'art_001',
    title: 'Building Scalable Design Systems',
    subtitle: 'A practical guide to component architecture',
    excerpt: 'Learn how to create a design system that scales with your organization while maintaining consistency and flexibility.',
    content: 'Full article content here...',
    status: 'published',
    author: {
      id: 'auth_jane',
      name: 'Jane Cooper',
      avatar: undefined,
      role: 'Lead Designer',
    },
    category: CATEGORIES[1],
    tags: ['design-systems', 'components', 'architecture'],
    reading_time: 8,
    versions: [
      { version: 1, updated_at: '2024-11-01T10:00:00Z', updated_by: 'Jane Cooper', summary: 'Initial draft' },
      { version: 2, updated_at: '2024-11-05T14:30:00Z', updated_by: 'Jane Cooper', summary: 'Added code examples' },
      { version: 3, updated_at: '2024-11-10T09:00:00Z', updated_by: 'Editor Team', summary: 'Final review edits' },
    ],
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2024-11-10T09:00:00Z',
    published_at: '2024-11-10T12:00:00Z',
  },
  {
    id: 'art_002',
    title: 'The Future of AI in Software Development',
    excerpt: 'Exploring how artificial intelligence is transforming the way we write and maintain code.',
    content: 'Full article content here...',
    status: 'review',
    author: {
      id: 'auth_bob',
      name: 'Bob Wilson',
      avatar: undefined,
      role: 'Tech Writer',
    },
    category: CATEGORIES[0],
    tags: ['ai', 'development', 'future'],
    reading_time: 12,
    versions: [
      { version: 1, updated_at: '2024-12-01T08:00:00Z', updated_by: 'Bob Wilson', summary: 'Initial draft' },
      { version: 2, updated_at: '2024-12-05T11:00:00Z', updated_by: 'Bob Wilson', summary: 'Expanded AI section' },
    ],
    created_at: '2024-12-01T08:00:00Z',
    updated_at: '2024-12-05T11:00:00Z',
  },
  {
    id: 'art_003',
    title: 'Getting Started with TypeScript',
    subtitle: 'From JavaScript to type safety',
    excerpt: 'A beginner-friendly introduction to TypeScript and its benefits for large-scale applications.',
    content: 'Full article content here...',
    status: 'draft',
    author: {
      id: 'auth_alice',
      name: 'Alice Johnson',
      avatar: undefined,
      role: 'Developer Advocate',
    },
    category: CATEGORIES[3],
    tags: ['typescript', 'javascript', 'beginner'],
    reading_time: 6,
    versions: [
      { version: 1, updated_at: '2024-12-10T15:00:00Z', updated_by: 'Alice Johnson', summary: 'Work in progress' },
    ],
    created_at: '2024-12-10T15:00:00Z',
    updated_at: '2024-12-10T15:00:00Z',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Status Badge Component
 * ───────────────────────────────────────────────────────────────────────────── */

function ArticleStatusBadge({ status }: { status: ArticleStatus }): JSX.Element {
  const configs: Record<ArticleStatus, { bg: string; color: string; border: string; icon: string }> = {
    draft: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: 'o' },
    review: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '?' },
    published: { bg: '#dcfce7', color: '#166534', border: '#86efac', icon: '+' },
    archived: { bg: '#f3f4f6', color: '#9ca3af', border: '#e5e7eb', icon: 'x' },
  };
  const config = configs[status];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
    }}>
      <span>{config.icon}</span>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Category Badge Component
 * ───────────────────────────────────────────────────────────────────────────── */

function CategoryBadge({ category }: { category: Category }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      borderRadius: '0.375rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: `${category.color}15`,
      color: category.color,
    }}>
      {category.name}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is an Article object?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Article</h1>
      <h2 style={STYLES.subheading}>
        Content with publishing workflow, authorship, and classification
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          An <strong>Article</strong> represents a piece of content that goes through a
          publishing workflow. It combines multiple traits to handle naming, ownership,
          categorization, lifecycle states, and timestamps.
        </p>

        {/* Composed Traits */}
        <div style={STYLES.groupLabel}>Composed Traits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed' }}>Labelled</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>title, subtitle, excerpt</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>Stateful</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>draft, review, published, archived</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#dc2626' }}>Ownerable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>author attribution</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#f59e0b' }}>Classifiable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>categories, tags</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0891b2' }}>Timestampable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>created, updated, published</span>
          </div>
        </div>
      </section>

      {/* Article States */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Publishing States</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <ArticleStatusBadge status="draft" />
          <ArticleStatusBadge status="review" />
          <ArticleStatusBadge status="published" />
          <ArticleStatusBadge status="archived" />
        </div>
      </section>

      {/* Schema Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Schema Structure</div>
        <pre style={STYLES.codeBlock}>
{`{
  // Identity
  id: "art_001",

  // Labelled trait
  title: "Building Scalable Design Systems",
  subtitle: "A practical guide to component architecture",
  excerpt: "Learn how to create a design system...",

  // Stateful trait
  status: "published",

  // Ownerable trait
  author: {
    id: "auth_jane",
    name: "Jane Cooper",
    role: "Lead Designer"
  },

  // Classifiable trait
  category: { id: "cat_design", name: "Design", ... },
  tags: ["design-systems", "components", "architecture"],

  // Timestampable trait
  created_at: "2024-11-01T10:00:00Z",
  updated_at: "2024-11-10T09:00:00Z",
  published_at: "2024-11-10T12:00:00Z",

  // Article-specific
  reading_time: 8,
  versions: [...]
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. ARTICLE VIEWS — List, card, and detail layouts
 * ───────────────────────────────────────────────────────────────────────────── */

function ArticleListItem({ article }: { article: Article }): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      gap: '1.5rem',
      padding: '1.5rem',
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '0.75rem',
    }}>
      {/* Thumbnail placeholder */}
      <div style={{
        width: '120px',
        height: '80px',
        borderRadius: '0.5rem',
        background: `linear-gradient(135deg, ${article.category.color}30, ${article.category.color}10)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: article.category.color,
        fontSize: '1.5rem',
        flexShrink: 0,
      }}>
        []
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <CategoryBadge category={article.category} />
          <ArticleStatusBadge status={article.status} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>{article.title}</h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#666', lineHeight: 1.5 }}>
          {article.excerpt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#888' }}>
          <span>{article.author.name}</span>
          <span>|</span>
          <span>{article.reading_time} min read</span>
          <span>|</span>
          <span>{formatDate(article.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }): JSX.Element {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '1rem',
      overflow: 'hidden',
    }}>
      {/* Featured Image placeholder */}
      <div style={{
        height: '160px',
        background: `linear-gradient(135deg, ${article.category.color}40, ${article.category.color}15)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: article.category.color,
        fontSize: '2rem',
      }}>
        []
      </div>

      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <CategoryBadge category={article.category} />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{article.reading_time} min</span>
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', lineHeight: 1.4 }}>{article.title}</h3>
        <p style={{
          margin: '0 0 1rem',
          fontSize: '0.875rem',
          color: '#666',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {article.excerpt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {article.author.name[0]}
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{article.author.name}</span>
          </div>
          <ArticleStatusBadge status={article.status} />
        </div>
      </div>
    </div>
  );
}

function ArticleViewsStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Article Views</h1>
      <h2 style={STYLES.subheading}>
        Different layouts for displaying articles
      </h2>

      {/* List View */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>List View</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {SAMPLE_ARTICLES.map((article) => (
            <ArticleListItem key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Card Grid */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Card Grid</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {SAMPLE_ARTICLES.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Detail View Header */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Detail View Header</div>
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <CategoryBadge category={SAMPLE_ARTICLES[0].category} />
            <ArticleStatusBadge status={SAMPLE_ARTICLES[0].status} />
          </div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', lineHeight: 1.3 }}>
            {SAMPLE_ARTICLES[0].title}
          </h1>
          {SAMPLE_ARTICLES[0].subtitle && (
            <p style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', color: '#666' }}>
              {SAMPLE_ARTICLES[0].subtitle}
            </p>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}>
                {SAMPLE_ARTICLES[0].author.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{SAMPLE_ARTICLES[0].author.name}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>{SAMPLE_ARTICLES[0].author.role}</div>
              </div>
            </div>
            <div style={{ color: '#d1d5db' }}>|</div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {formatDate(SAMPLE_ARTICLES[0].published_at || SAMPLE_ARTICLES[0].updated_at)}
            </div>
            <div style={{ color: '#d1d5db' }}>|</div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {SAMPLE_ARTICLES[0].reading_time} min read
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. PUBLISHING WORKFLOW — State transitions
 * ───────────────────────────────────────────────────────────────────────────── */

function PublishingWorkflowStory(): JSX.Element {
  const [currentStatus, setCurrentStatus] = useState<ArticleStatus>('draft');

  const workflowSteps: { status: ArticleStatus; label: string; description: string }[] = [
    { status: 'draft', label: 'Draft', description: 'Article is being written. Not visible to readers.' },
    { status: 'review', label: 'In Review', description: 'Submitted for editorial review.' },
    { status: 'published', label: 'Published', description: 'Live and visible to readers.' },
    { status: 'archived', label: 'Archived', description: 'Removed from public view.' },
  ];

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Publishing Workflow</h1>
      <h2 style={STYLES.subheading}>
        Content lifecycle from draft to publication
      </h2>

      {/* Workflow Diagram */}
      <section style={STYLES.section}>
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step.status}>
                <div
                  style={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    opacity: workflowSteps.findIndex(s => s.status === currentStatus) >= index ? 1 : 0.5,
                  }}
                  onClick={() => setCurrentStatus(step.status)}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: step.status === currentStatus ? '#3b82f6' : '#e5e7eb',
                    color: step.status === currentStatus ? '#fff' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    fontWeight: 600,
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{step.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666', maxWidth: '120px' }}>
                    {step.description}
                  </div>
                </div>
                {index < workflowSteps.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    background: workflowSteps.findIndex(s => s.status === currentStatus) > index ? '#3b82f6' : '#e5e7eb',
                    margin: '0 1rem',
                    marginBottom: '4rem',
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Transition Actions */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Available Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{
            ...STYLES.card,
            background: currentStatus === 'draft' ? '#fff' : '#f9fafb',
            opacity: currentStatus === 'draft' ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ArticleStatusBadge status="draft" />
              <span style={{ color: '#888' }}>-&gt;</span>
              <ArticleStatusBadge status="review" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>submitForReview()</code> - Send to editors
            </p>
          </div>

          <div style={{
            ...STYLES.card,
            background: currentStatus === 'review' ? '#fff' : '#f9fafb',
            opacity: currentStatus === 'review' ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ArticleStatusBadge status="review" />
              <span style={{ color: '#888' }}>-&gt;</span>
              <ArticleStatusBadge status="published" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>publish()</code> - Make live
            </p>
          </div>

          <div style={{
            ...STYLES.card,
            background: currentStatus === 'review' ? '#fff' : '#f9fafb',
            opacity: currentStatus === 'review' ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ArticleStatusBadge status="review" />
              <span style={{ color: '#888' }}>-&gt;</span>
              <ArticleStatusBadge status="draft" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>requestChanges()</code> - Return to author
            </p>
          </div>

          <div style={{
            ...STYLES.card,
            background: currentStatus === 'published' ? '#fff' : '#f9fafb',
            opacity: currentStatus === 'published' ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ArticleStatusBadge status="published" />
              <span style={{ color: '#888' }}>-&gt;</span>
              <ArticleStatusBadge status="archived" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>archive()</code> - Remove from view
            </p>
          </div>
        </div>
      </section>

      {/* Version History */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Version History</div>
        <div style={{ ...STYLES.card, background: '#fff' }}>
          {SAMPLE_ARTICLES[0].versions.map((version, index) => (
            <div
              key={version.version}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 0',
                borderBottom: index < SAMPLE_ARTICLES[0].versions.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: index === SAMPLE_ARTICLES[0].versions.length - 1 ? '#3b82f6' : '#e5e7eb',
                color: index === SAMPLE_ARTICLES[0].versions.length - 1 ? '#fff' : '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}>
                v{version.version}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{version.summary}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {version.updated_by} | {formatDate(version.updated_at)}
                </div>
              </div>
              {index === SAMPLE_ARTICLES[0].versions.length - 1 && (
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: '#dcfce7',
                  color: '#166534',
                  borderRadius: '0.25rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}>
                  Current
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. CLASSIFICATION — Categories and tags
 * ───────────────────────────────────────────────────────────────────────────── */

function ClassificationStory(): JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = Array.from(new Set(SAMPLE_ARTICLES.flatMap(a => a.tags)));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredArticles = SAMPLE_ARTICLES.filter(article => {
    const matchesCategory = !selectedCategory || article.category.id === selectedCategory;
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => article.tags.includes(tag));
    return matchesCategory && matchesTags;
  });

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Classification</h1>
      <h2 style={STYLES.subheading}>
        Category and tag management for content organization
      </h2>

      {/* Category Filter */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Categories</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: !selectedCategory ? '#3b82f6' : '#e5e7eb',
              background: !selectedCategory ? '#eff6ff' : '#fff',
              color: !selectedCategory ? '#3b82f6' : '#374151',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: selectedCategory === cat.id ? cat.color : '#e5e7eb',
                background: selectedCategory === cat.id ? `${cat.color}15` : '#fff',
                color: selectedCategory === cat.id ? cat.color : '#374151',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Tag Filter */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid',
                borderColor: selectedTags.includes(tag) ? '#3b82f6' : '#e5e7eb',
                background: selectedTags.includes(tag) ? '#3b82f6' : '#fff',
                color: selectedTags.includes(tag) ? '#fff' : '#666',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>

      {/* Filtered Results */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>
          Results ({filteredArticles.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredArticles.map((article) => (
            <ArticleListItem key={article.id} article={article} />
          ))}
          {filteredArticles.length === 0 && (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#888',
              background: '#f9fafb',
              borderRadius: '0.75rem',
            }}>
              No articles match the selected filters
            </div>
          )}
        </div>
      </section>

      {/* Tag Cloud */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Tag Cloud (by frequency)</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          justifyContent: 'center',
        }}>
          {allTags.map((tag) => {
            const count = SAMPLE_ARTICLES.filter(a => a.tags.includes(tag)).length;
            const size = 0.75 + (count * 0.25);
            return (
              <span
                key={tag}
                style={{
                  fontSize: `${size}rem`,
                  color: count > 1 ? '#3b82f6' : '#9ca3af',
                  fontWeight: count > 1 ? 500 : 400,
                }}
              >
                #{tag}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Objects/Domain Objects/Article',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
};

export const ArticleViews: Story = {
  name: '2. Article Views',
  render: () => <ArticleViewsStory />,
};

export const PublishingWorkflow: Story = {
  name: '3. Publishing Workflow',
  render: () => <PublishingWorkflowStory />,
};

export const Classification: Story = {
  name: '4. Classification',
  render: () => <ClassificationStory />,
};
