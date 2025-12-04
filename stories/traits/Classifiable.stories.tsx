/**
 * Classifiable Trait — Taxonomy + Folksonomy Classification Demo
 *
 * This story demonstrates the Classifiable trait which provides:
 * Canonical taxonomy + folksonomy with governance metadata.
 *
 * Supports three classification modes:
 * - taxonomy: Hierarchical categories only (ltree)
 * - tag: Folksonomy tags only (flat)
 * - hybrid: WordPress-style three-table pattern (both)
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Classification Modes - Visual comparison of taxonomy/tag/hybrid
 * 3. Category Tree - Hierarchical picker with primary designation
 * 4. Tag Governance - Policy enforcement and synonym collapse
 * 5. How It Works - Schema and configuration examples
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants (consistent with other trait stories)
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1000px',
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
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600 as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Badge Components
 * ───────────────────────────────────────────────────────────────────────────── */

function TaxonomyBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#dbeafe',
      color: '#1e40af',
      border: '1px solid #93c5fd',
    }}>
      <span style={{ fontSize: '0.875rem' }}>🌳</span>
      Taxonomy
    </span>
  );
}

function TagBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#f3e8ff',
      color: '#7c3aed',
      border: '1px solid #c4b5fd',
    }}>
      <span style={{ fontSize: '0.875rem' }}>#</span>
      Tag
    </span>
  );
}

function HybridBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac',
    }}>
      <span style={{ fontSize: '0.875rem' }}>⚡</span>
      Hybrid
    </span>
  );
}

function PolicyBadge({ policy }: { policy: 'locked' | 'moderated' | 'open' }): JSX.Element {
  const styles = {
    locked: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', icon: '🔒' },
    moderated: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', icon: '👁' },
    open: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', icon: '✓' },
  };
  const s = styles[policy];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color, border: s.border }}>
      <span style={{ fontSize: '0.75rem' }}>{s.icon}</span>
      {policy.charAt(0).toUpperCase() + policy.slice(1)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_CATEGORIES = [
  { id: 'electronics', name: 'Electronics', path: 'electronics', depth: 0, childCount: 2 },
  { id: 'mobile', name: 'Mobile', path: 'electronics.mobile', depth: 1, childCount: 2, parentId: 'electronics' },
  { id: 'android', name: 'Android', path: 'electronics.mobile.android', depth: 2, childCount: 0, parentId: 'mobile' },
  { id: 'ios', name: 'iOS', path: 'electronics.mobile.ios', depth: 2, childCount: 0, parentId: 'mobile' },
  { id: 'audio', name: 'Audio', path: 'electronics.audio', depth: 1, childCount: 0, parentId: 'electronics' },
];

const SAMPLE_TAGS = [
  { slug: 'react', label: 'React', count: 156, approved: true },
  { slug: 'typescript', label: 'TypeScript', count: 142, approved: true },
  { slug: 'frontend', label: 'Frontend', count: 98, approved: true },
  { slug: 'tutorial', label: 'Tutorial', count: 87, approved: true },
  { slug: 'javascript', label: 'JavaScript', count: 234, approved: true, synonyms: ['JS', 'js', 'ECMAScript'] },
  { slug: 'nodejs', label: 'Node.js', count: 76, approved: true },
];

const SYNONYM_MAP: Record<string, string> = {
  'js': 'javascript',
  'JS': 'javascript',
  'ECMAScript': 'javascript',
  'TS': 'typescript',
  'ts': 'typescript',
  'reactjs': 'react',
  'ReactJS': 'react',
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Classifiable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Classifiable</h1>
      <h2 style={STYLES.subheading}>
        Canonical taxonomy + folksonomy with governance metadata
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Classifiable unifies <strong>hierarchical categories</strong> (taxonomy) and{' '}
          <strong>flat tags</strong> (folksonomy) into a single, configurable trait.
          Choose taxonomy-only, tag-only, or hybrid mode based on your domain needs.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Classifiable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Ad-hoc category implementations</li>
              <li>No hierarchy support (flat lists)</li>
              <li>Tag sprawl with duplicates</li>
              <li>No governance or approval flow</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Classifiable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Unified classification model</li>
              <li>ltree-powered hierarchy queries</li>
              <li>Synonym collapse (JS → JavaScript)</li>
              <li>Configurable governance policies</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Classifiable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>classification_mode</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>taxonomy | tag | hybrid</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>categories[]</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Ordered taxonomy nodes</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>primary_category_id</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Canonical category reference</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>tags[]</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Canonical tag collection</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>tag_count</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Number of assigned tags</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>classification_metadata</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Mode, storage, governance</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Product', 'Article', 'Ticket', 'KnowledgeBase', 'Media'].map((obj) => (
            <span key={obj} style={{
              padding: '0.5rem 1rem',
              background: '#eff6ff',
              color: '#3b82f6',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              {obj}
            </span>
          ))}
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Classification Modes</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TaxonomyBadge />
          <TagBadge />
          <HybridBadge />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. CLASSIFICATION MODES — Visual comparison
 * ───────────────────────────────────────────────────────────────────────────── */

function ClassificationModesStory(): JSX.Element {
  const [selectedMode, setSelectedMode] = useState<'taxonomy' | 'tag' | 'hybrid'>('hybrid');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Classification Modes</h1>
      <h2 style={STYLES.subheading}>
        Three modes: taxonomy-only, tag-only, or hybrid (WordPress-style)
      </h2>

      <section style={STYLES.section}>
        {/* Mode Selector */}
        <div style={STYLES.groupLabel}>Select Mode</div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          {(['taxonomy', 'tag', 'hybrid'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              style={{
                padding: '0.75rem 1.5rem',
                background: selectedMode === mode ? '#3b82f6' : '#fff',
                color: selectedMode === mode ? '#fff' : '#374151',
                border: selectedMode === mode ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'taxonomy' && '🌳 '}
              {mode === 'tag' && '# '}
              {mode === 'hybrid' && '⚡ '}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Mode Comparison */}
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          {selectedMode === 'taxonomy' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <TaxonomyBadge />
              </div>
              <h3 style={{ marginTop: 0 }}>Hierarchical Categories Only</h3>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Best for structured content with clear parent-child relationships.
                Uses ltree for fast subtree queries (&lt;3ms).
              </p>

              <div style={STYLES.groupLabel}>Example: Product in Electronics</div>
              <div style={{
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.875rem',
              }}>
                <div style={{ color: '#6b7280', marginBottom: '0.5rem' }}>📂 Electronics</div>
                <div style={{ color: '#6b7280', marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>├─ 📱 Mobile</div>
                <div style={{ color: '#1e40af', fontWeight: 600, paddingLeft: '3rem' }}>└─ 🤖 Android ★ (Primary)</div>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#dbeafe', borderRadius: '0.5rem' }}>
                <strong>Breadcrumb:</strong> Electronics → Mobile → Android
              </div>
            </div>
          )}

          {selectedMode === 'tag' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <TagBadge />
              </div>
              <h3 style={{ marginTop: 0 }}>Flat Tags Only</h3>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Best for user-generated content where hierarchy isn't needed.
                Supports governance policies (locked/moderated/open).
              </p>

              <div style={STYLES.groupLabel}>Example: Article Tags</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['react', 'typescript', 'frontend', 'tutorial'].map((tag) => (
                  <span key={tag} style={{
                    padding: '0.375rem 0.75rem',
                    background: '#f3e8ff',
                    color: '#7c3aed',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f3e8ff', borderRadius: '0.5rem' }}>
                <strong>tag_preview:</strong> react, typescript, frontend, tutorial
              </div>
            </div>
          )}

          {selectedMode === 'hybrid' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <HybridBadge />
              </div>
              <h3 style={{ marginTop: 0 }}>WordPress-Style Three-Table Pattern</h3>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Combines categories for structure + tags for discovery.
                Best when you need both hierarchy and free-form labeling.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div style={STYLES.groupLabel}>Categories</div>
                  <div style={{
                    padding: '1rem',
                    background: '#dbeafe',
                    borderRadius: '0.5rem',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.875rem',
                  }}>
                    <div>📱 Mobile → Android ★</div>
                  </div>
                </div>
                <div>
                  <div style={STYLES.groupLabel}>Tags</div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {['smartphone', 'pixel', 'android-14'].map((tag) => (
                      <span key={tag} style={{
                        padding: '0.25rem 0.5rem',
                        background: '#f3e8ff',
                        color: '#7c3aed',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#dcfce7', borderRadius: '0.5rem' }}>
                <strong>Three tables:</strong> objects, object_categories (junction), object_tags (junction)
              </div>
            </div>
          )}
        </div>
      </section>

      {/* When to Use Each */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>When to Use Each Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <TaxonomyBadge />
            <ul style={{ marginTop: '1rem', marginBottom: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.875rem' }}>
              <li>E-commerce catalogs</li>
              <li>Documentation sites</li>
              <li>Org structure</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <TagBadge />
            <ul style={{ marginTop: '1rem', marginBottom: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.875rem' }}>
              <li>Blog posts</li>
              <li>Social content</li>
              <li>Stack Overflow Q&A</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <HybridBadge />
            <ul style={{ marginTop: '1rem', marginBottom: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.875rem' }}>
              <li>Knowledge bases</li>
              <li>Product catalogs + SEO</li>
              <li>CMS with filtering</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. CATEGORY TREE — Hierarchical picker with primary designation
 * ───────────────────────────────────────────────────────────────────────────── */

function CategoryTreeStory(): JSX.Element {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['electronics', 'mobile']));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['android']));
  const [primaryId, setPrimaryId] = useState<string>('android');

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const renderTree = (nodes: typeof SAMPLE_CATEGORIES, parentId: string | null = null): JSX.Element[] => {
    return nodes
      .filter((n) => (n.parentId ?? null) === parentId)
      .map((node) => {
        const children = nodes.filter((n) => n.parentId === node.id);
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedIds.has(node.id);
        const isPrimary = primaryId === node.id;

        return (
          <div key={node.id} style={{ marginLeft: node.depth * 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: isSelected ? '#dbeafe' : 'transparent',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}>
              {children.length > 0 ? (
                <button
                  onClick={() => toggleExpand(node.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    width: '1.25rem',
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              ) : (
                <span style={{ width: '1.25rem' }} />
              )}

              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(node.id)}
                style={{ width: '1rem', height: '1rem' }}
              />

              <span
                onClick={() => toggleSelect(node.id)}
                style={{ fontWeight: isSelected ? 600 : 400 }}
              >
                {node.name}
              </span>

              {isSelected && (
                <button
                  onClick={() => setPrimaryId(node.id)}
                  style={{
                    background: isPrimary ? '#fbbf24' : '#e5e7eb',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '0.125rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  title={isPrimary ? 'Primary category' : 'Set as primary'}
                >
                  {isPrimary ? '★' : '☆'}
                </button>
              )}
            </div>
            {isExpanded && renderTree(nodes, node.id)}
          </div>
        );
      });
  };

  const primaryNode = SAMPLE_CATEGORIES.find((c) => c.id === primaryId);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Category Tree</h1>
      <h2 style={STYLES.subheading}>
        Interactive hierarchical picker with primary designation
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Tree Picker */}
          <div>
            <div style={STYLES.groupLabel}>Category Picker</div>
            <div style={{
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              {renderTree(SAMPLE_CATEGORIES)}
            </div>
          </div>

          {/* Selected + Primary */}
          <div>
            <div style={STYLES.groupLabel}>Selection State</div>
            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                categories[]
              </code>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {Array.from(selectedIds).map((id) => {
                  const node = SAMPLE_CATEGORIES.find((c) => c.id === id);
                  return (
                    <span key={id} style={{
                      padding: '0.25rem 0.5rem',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                    }}>
                      {node?.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                primary_category_id
              </code>
              <span style={{ color: '#374151' }}>{primaryId}</span>
            </div>

            <div style={{ ...STYLES.card, background: '#fff' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                primary_category_path
              </code>
              <span style={{ color: '#374151' }}>{primaryNode?.path.replace(/\./g, ' → ')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Storage Models */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Hierarchy Storage Models</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Adjacency List</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#666' }}>
              Simple parent_id reference. Slow subtree queries.
            </p>
            <pre style={{ ...STYLES.codeBlock, fontSize: '0.75rem', margin: 0 }}>
{`parent_id: 'mobile'`}
            </pre>
          </div>
          <div style={{ ...STYLES.card, background: '#dbeafe', borderColor: '#93c5fd' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Materialized Path ⭐</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#1e40af' }}>
              ltree column. Fast subtree queries (&lt;3ms). Recommended.
            </p>
            <pre style={{ ...STYLES.codeBlock, fontSize: '0.75rem', margin: 0 }}>
{`ltree: 'electronics.mobile.android'`}
            </pre>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Closure Table</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#666' }}>
              Separate ancestor table. Fast all ops, more storage.
            </p>
            <pre style={{ ...STYLES.codeBlock, fontSize: '0.75rem', margin: 0 }}>
{`ancestor → descendant`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. TAG GOVERNANCE — Policy enforcement and synonym collapse
 * ───────────────────────────────────────────────────────────────────────────── */

function TagGovernanceStory(): JSX.Element {
  const [policy, setPolicy] = useState<'locked' | 'moderated' | 'open'>('moderated');
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>(['react', 'typescript']);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const maxTags = 5;

  const approvedTags = SAMPLE_TAGS.filter((t) => t.approved).map((t) => t.slug);

  const handleAddTag = () => {
    const raw = inputValue.trim().toLowerCase();
    if (!raw || tags.length + pendingTags.length >= maxTags) return;

    // Check for synonym collapse
    const canonical = SYNONYM_MAP[raw] ?? SYNONYM_MAP[inputValue.trim()] ?? raw;

    if (tags.includes(canonical) || pendingTags.includes(canonical)) {
      setInputValue('');
      return;
    }

    if (policy === 'locked') {
      if (approvedTags.includes(canonical)) {
        setTags([...tags, canonical]);
      }
      // Silently reject non-approved tags in locked mode
    } else if (policy === 'moderated') {
      if (approvedTags.includes(canonical)) {
        setTags([...tags, canonical]);
      } else {
        setPendingTags([...pendingTags, canonical]);
      }
    } else {
      // open mode
      setTags([...tags, canonical]);
    }

    setInputValue('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
    setPendingTags(pendingTags.filter((t) => t !== tag));
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Tag Governance</h1>
      <h2 style={STYLES.subheading}>
        Policy enforcement, synonym collapse, and tag limits
      </h2>

      <section style={STYLES.section}>
        {/* Policy Selector */}
        <div style={STYLES.groupLabel}>Tag Policy</div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          {(['locked', 'moderated', 'open'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPolicy(p)}
              style={{
                padding: '0.75rem 1.5rem',
                background: policy === p ? (p === 'locked' ? '#f3f4f6' : p === 'moderated' ? '#fef3c7' : '#dcfce7') : '#fff',
                color: policy === p ? (p === 'locked' ? '#6b7280' : p === 'moderated' ? '#92400e' : '#166534') : '#374151',
                border: policy === p ? '2px solid currentColor' : '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <PolicyBadge policy={p} />
            </button>
          ))}
        </div>

        {/* Policy Description */}
        <div style={{ ...STYLES.card, marginBottom: '2rem', background: '#fff' }}>
          {policy === 'locked' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>🔒 Locked:</strong> Only pre-approved tags can be added. Users pick from a curated list. New tags are silently rejected.
            </p>
          )}
          {policy === 'moderated' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>👁 Moderated:</strong> Approved tags are added immediately. New tags are marked as "pending review" and require moderator approval.
            </p>
          )}
          {policy === 'open' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>✓ Open:</strong> Any tag can be created. Best for internal tools or trusted contributors. Synonym collapse still applies.
            </p>
          )}
        </div>

        {/* Tag Input */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <div style={STYLES.groupLabel}>Tag Input</div>
            <div style={{
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Type a tag..."
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '0.375rem',
                    fontSize: '0.9375rem',
                  }}
                />
                <button
                  onClick={handleAddTag}
                  disabled={tags.length + pendingTags.length >= maxTags}
                  style={{
                    padding: '0.5rem 1rem',
                    background: tags.length + pendingTags.length >= maxTags ? '#e5e7eb' : '#3b82f6',
                    color: tags.length + pendingTags.length >= maxTags ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: tags.length + pendingTags.length >= maxTags ? 'not-allowed' : 'pointer',
                  }}
                >
                  Add
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
                {tags.length + pendingTags.length} / {maxTags} tags
              </div>

              {/* Current Tags */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {tags.map((tag) => (
                  <span key={tag} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.625rem',
                    background: '#f3e8ff',
                    color: '#7c3aed',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                  }}>
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#7c3aed',
                        fontSize: '1rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {pendingTags.map((tag) => (
                  <span key={tag} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.625rem',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    border: '1px dashed #fcd34d',
                  }}>
                    #{tag}
                    <span style={{ fontSize: '0.625rem' }}>⏳</span>
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#92400e',
                        fontSize: '1rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Approved Tags Reference */}
            {policy !== 'open' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={STYLES.groupLabel}>Approved Tags</div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {approvedTags.map((tag) => (
                    <span key={tag} style={{
                      padding: '0.25rem 0.5rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Synonym Collapse Demo */}
          <div>
            <div style={STYLES.groupLabel}>Synonym Collapse</div>
            <div style={{
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#555' }}>
                Multiple aliases collapse to a canonical tag:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { aliases: ['JS', 'js', 'ECMAScript'], canonical: 'javascript' },
                  { aliases: ['TS', 'ts'], canonical: 'typescript' },
                  { aliases: ['reactjs', 'ReactJS'], canonical: 'react' },
                ].map((item) => (
                  <div key={item.canonical} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {item.aliases.map((a) => (
                        <code key={a} style={{
                          padding: '0.125rem 0.375rem',
                          background: '#fee2e2',
                          color: '#dc2626',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          textDecoration: 'line-through',
                        }}>
                          {a}
                        </code>
                      ))}
                    </div>
                    <span style={{ color: '#888' }}>→</span>
                    <code style={{
                      padding: '0.125rem 0.375rem',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      {item.canonical}
                    </code>
                  </div>
                ))}
              </div>

              <p style={{ margin: '1rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Try typing "JS" or "reactjs" in the input above!
              </p>
            </div>

            {/* Tag Cloud Preview */}
            <div style={{ marginTop: '1rem' }}>
              <div style={STYLES.groupLabel}>Tag Cloud (with counts)</div>
              <div style={{
                padding: '1rem',
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}>
                {SAMPLE_TAGS.map((tag) => (
                  <span
                    key={tag.slug}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: '#f3e8ff',
                      color: '#7c3aed',
                      borderRadius: '9999px',
                      fontSize: `${0.75 + (tag.count / 300) * 0.5}rem`,
                    }}
                  >
                    #{tag.label}
                    <span style={{ fontSize: '0.625rem', marginLeft: '0.25rem', opacity: 0.7 }}>
                      ({tag.count})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. HOW IT WORKS — Schema and configuration
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Schema definition and configuration examples
      </h2>

      {/* Step 1 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 1: Define Classification Mode</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Choose the classification mode based on your domain needs:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Domain definition
{
  object: "Product",
  traits: [
    {
      trait: "Classifiable",
      parameters: {
        classification_mode: "hybrid",      // taxonomy + tags
        hierarchy_storage_model: "materialized_path",  // ltree
        tag_policy: "moderated",            // require approval for new tags
        max_tags: 10,
        require_primary_category: true
      }
    }
  ]
}`}
        </pre>
      </section>

      {/* Step 2 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 2: Category Assignment</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Assign categories with primary designation:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Category assignment
POST /products/prod_abc123/categories
{
  category_ids: ["electronics", "mobile", "android"],
  primary_category_id: "android"
}

// Result: Product record updated
{
  categories: [
    { id: "electronics", path: "electronics" },
    { id: "mobile", path: "electronics.mobile" },
    { id: "android", path: "electronics.mobile.android" }
  ],
  primary_category_id: "android",
  primary_category_path: "electronics.mobile.android"
}`}
        </pre>
      </section>

      {/* Step 3 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 3: Tag Assignment with Governance</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Add tags with policy enforcement and synonym collapse:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Tag assignment (moderated policy)
POST /products/prod_abc123/tags
{
  tags: ["smartphone", "JS", "pixel-8"]  // "JS" is a synonym
}

// Governance pipeline:
// 1. Synonym collapse: "JS" → "javascript"
// 2. Policy check: "smartphone" (approved) ✓
// 3. Policy check: "javascript" (approved) ✓
// 4. Policy check: "pixel-8" (new) → pending review

// Result:
{
  tags: [
    { slug: "smartphone", status: "approved" },
    { slug: "javascript", status: "approved" }
  ],
  pending_tags: [
    { slug: "pixel-8", status: "pending_review" }
  ],
  tag_count: 2,
  tag_preview: "smartphone, javascript"
}`}
        </pre>
      </section>

      {/* Step 4 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 4: Query by Classification</div>
        <pre style={STYLES.codeBlock}>
{`-- Find all products in "Mobile" subtree (ltree query, <3ms)
SELECT * FROM products
WHERE primary_category_path <@ 'electronics.mobile';

-- Find products with specific tags
SELECT * FROM products
WHERE tags @> ARRAY['javascript', 'react'];

-- Faceted search: categories + tags
SELECT * FROM products
WHERE primary_category_path <@ 'electronics.mobile'
  AND tags && ARRAY['smartphone', 'android-14'];`}
        </pre>
      </section>

      {/* Schema Summary */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Complete Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Classifiable trait fields
{
  // Mode & Metadata
  classification_mode: "taxonomy" | "tag" | "hybrid",
  classification_metadata: {
    storage_model: "materialized_path",
    tag_policy: "moderated",
    max_tags: 10,
    last_classified_at: timestamp
  },

  // Categories (taxonomy mode or hybrid)
  categories: CategoryNode[],           // Ordered taxonomy nodes
  primary_category_id: string,          // Canonical category
  primary_category_path: string,        // "Electronics > Mobile > Android"

  // Tags (tag mode or hybrid)
  tags: Tag[],                          // Canonical tags after synonym collapse
  tag_count: number,                    // Count for display
  tag_preview: string                   // "react, typescript, frontend"
}

// Trait parameters (configure at domain level)
{
  classification_mode: "hybrid",        // Which mode to use
  hierarchy_storage_model: "materialized_path",  // ltree recommended
  tag_policy: "moderated",              // locked | moderated | open
  max_tags: 10,                         // Tag limit per object
  require_primary_category: true        // Must have primary category?
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Traits/Core/Classifiable',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

// 1. Overview — First in nav
export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 2. Classification Modes — Mode comparison
export const ClassificationModes: Story = {
  name: '2. Classification Modes',
  render: () => <ClassificationModesStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Category Tree — Hierarchical picker
export const CategoryTree: Story = {
  name: '3. Category Tree',
  render: () => <CategoryTreeStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. Tag Governance — Policy enforcement
export const TagGovernance: Story = {
  name: '4. Tag Governance',
  render: () => <TagGovernanceStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 5. How It Works — Schema and configuration
export const HowItWorks: Story = {
  name: '5. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
