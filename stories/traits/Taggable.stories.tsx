/**
 * Taggable Trait — Configurable Tag Management with Governance Guardrails
 *
 * This story demonstrates the Taggable behavioral trait which provides:
 * Flat tag collections with configurable governance guardrails.
 *
 * Key features:
 * - maxTags: Limit on number of tags per entity
 * - allowCustomTags: Whether users can create new tags
 * - allowedTags: Curated allow list when custom disabled
 * - caseSensitive: Whether tag comparison respects casing
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Tag Input - Interactive demo of governance modes
 * 3. Tag Display - Visual representations (pills, cloud, manager)
 * 4. How It Works - Schema and configuration examples
 *
 * Difference from Classifiable:
 * - Taggable = flat tags only, behavioral trait
 * - Classifiable = taxonomy + tags, core trait with hierarchy support
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

function ModeBadge({ mode }: { mode: 'open' | 'allowlist' | 'locked' }): JSX.Element {
  const styles = {
    open: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', icon: '✓' },
    allowlist: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', icon: '📋' },
    locked: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', icon: '🔒' },
  };
  const labels = { open: 'Open', allowlist: 'Allow List', locked: 'Locked' };
  const s = styles[mode];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color, border: s.border }}>
      <span style={{ fontSize: '0.75rem' }}>{s.icon}</span>
      {labels[mode]}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_TAGS = [
  'react', 'typescript', 'frontend', 'tutorial',
  'performance', 'accessibility', 'testing'
];

const ALLOWED_TAGS = [
  'bug', 'feature', 'enhancement', 'documentation',
  'question', 'help-wanted', 'good-first-issue'
];

const TAG_CLOUD_DATA = [
  { slug: 'react', count: 156 },
  { slug: 'typescript', count: 142 },
  { slug: 'javascript', count: 234 },
  { slug: 'frontend', count: 98 },
  { slug: 'tutorial', count: 87 },
  { slug: 'nodejs', count: 76 },
  { slug: 'css', count: 65 },
  { slug: 'api', count: 54 },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Taggable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Taggable</h1>
      <h2 style={STYLES.subheading}>
        Configurable tag management with governance guardrails
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Taggable provides <strong>flat tag collections</strong> with configurable governance.
          Control tag creation, enforce limits, and normalize casing—all through simple parameters.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Taggable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Uncontrolled tag sprawl</li>
              <li>Duplicate tags (React, react, REACT)</li>
              <li>No limit on tag counts</li>
              <li>No governance or curation</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Taggable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Configurable governance</li>
              <li>Case normalization</li>
              <li>Max tag limits enforced</li>
              <li>Allow lists for curation</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Taggable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>tags[]</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Ordered list of assigned tags</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>tag_count</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Computed number of tags</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#2563eb', fontWeight: 600 }}>maxTags</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Maximum tags (1-64, default 10)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#2563eb', fontWeight: 600 }}>allowCustomTags</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Allow new tag creation (default true)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#2563eb', fontWeight: 600 }}>allowedTags</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Curated allow list</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#2563eb', fontWeight: 600 }}>caseSensitive</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Case-sensitive comparison (default false)</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Governance Modes</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <ModeBadge mode="open" />
          <ModeBadge mode="allowlist" />
          <ModeBadge mode="locked" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ModeBadge mode="open" />
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#555' }}>
              allowCustomTags: true<br />No allow list restriction
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ModeBadge mode="allowlist" />
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#555' }}>
              allowCustomTags: true<br />Autocomplete from allowedTags
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <ModeBadge mode="locked" />
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#555' }}>
              allowCustomTags: false<br />Select only from allowedTags
            </p>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Article', 'Incident', 'KnowledgeBase', 'Media'].map((obj) => (
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. TAG INPUT — Interactive governance modes demo
 * ───────────────────────────────────────────────────────────────────────────── */

function TagInputStory(): JSX.Element {
  const [mode, setMode] = useState<'open' | 'allowlist' | 'locked'>('allowlist');
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>(['react', 'typescript']);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const maxTags = 5;

  const normalizeTag = (tag: string): string => {
    return caseSensitive ? tag.trim() : tag.trim().toLowerCase();
  };

  const isAllowed = (tag: string): boolean => {
    const normalized = normalizeTag(tag);
    if (mode === 'open') return true;
    return ALLOWED_TAGS.some(t =>
      caseSensitive ? t === normalized : t.toLowerCase() === normalized
    );
  };

  const handleAddTag = () => {
    const raw = inputValue.trim();
    if (!raw || tags.length >= maxTags) return;

    const normalized = normalizeTag(raw);
    if (tags.some(t => normalizeTag(t) === normalized)) {
      setInputValue('');
      return; // Duplicate
    }

    if (mode === 'locked' && !isAllowed(raw)) {
      // Silently reject in locked mode
      setInputValue('');
      return;
    }

    setTags([...tags, normalized]);
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const filteredSuggestions = (mode === 'allowlist' || mode === 'locked')
    ? ALLOWED_TAGS.filter(t => {
        const search = caseSensitive ? inputValue : inputValue.toLowerCase();
        const target = caseSensitive ? t : t.toLowerCase();
        return target.includes(search) && !tags.some(existing =>
          caseSensitive ? existing === t : existing.toLowerCase() === t.toLowerCase()
        );
      })
    : [];

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Tag Input</h1>
      <h2 style={STYLES.subheading}>
        Interactive demo of governance modes
      </h2>

      <section style={STYLES.section}>
        {/* Mode Selector */}
        <div style={STYLES.groupLabel}>Select Mode</div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {(['open', 'allowlist', 'locked'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '0.75rem 1.5rem',
                background: mode === m ? '#3b82f6' : '#fff',
                color: mode === m ? '#fff' : '#374151',
                border: mode === m ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <ModeBadge mode={m} />
            </button>
          ))}
        </div>

        {/* Case Sensitivity Toggle */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              style={{ width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
              Case-sensitive tags
            </span>
          </label>
        </div>

        {/* Mode Description */}
        <div style={{ ...STYLES.card, marginBottom: '2rem', background: '#fff' }}>
          {mode === 'open' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>✓ Open Mode:</strong> Any tag can be created. Free-form input with no restrictions.
              {!caseSensitive && ' Tags are normalized to lowercase.'}
            </p>
          )}
          {mode === 'allowlist' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>📋 Allow List Mode:</strong> Custom tags allowed, but autocomplete suggests from approved list.
              Best for guided input with flexibility.
            </p>
          )}
          {mode === 'locked' && (
            <p style={{ margin: 0, color: '#555' }}>
              <strong>🔒 Locked Mode:</strong> Only pre-approved tags can be selected.
              Users must pick from the dropdown. Unknown tags are rejected.
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Tag Input */}
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
                  placeholder={mode === 'locked' ? 'Select from dropdown...' : 'Type a tag...'}
                  disabled={tags.length >= maxTags}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '0.375rem',
                    fontSize: '0.9375rem',
                    opacity: tags.length >= maxTags ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={handleAddTag}
                  disabled={tags.length >= maxTags}
                  style={{
                    padding: '0.5rem 1rem',
                    background: tags.length >= maxTags ? '#e5e7eb' : '#3b82f6',
                    color: tags.length >= maxTags ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: tags.length >= maxTags ? 'not-allowed' : 'pointer',
                  }}
                >
                  Add
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {filteredSuggestions.length > 0 && inputValue && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Suggestions:
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {filteredSuggestions.slice(0, 5).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setTags([...tags, caseSensitive ? tag : tag.toLowerCase()]);
                          setInputValue('');
                        }}
                        disabled={tags.length >= maxTags}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#dbeafe',
                          color: '#1e40af',
                          border: 'none',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          cursor: tags.length >= maxTags ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: tags.length >= maxTags ? '#dc2626' : '#6b7280', marginBottom: '1rem' }}>
                {tags.length} / {maxTags} tags {tags.length >= maxTags && '(limit reached)'}
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
                        padding: 0,
                      }}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* State Display */}
          <div>
            <div style={STYLES.groupLabel}>Current State</div>
            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                tags[]
              </code>
              <pre style={{
                margin: 0,
                padding: '0.5rem',
                background: '#f9fafb',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                overflow: 'auto',
              }}>
                {JSON.stringify(tags, null, 2)}
              </pre>
            </div>

            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                tag_count
              </code>
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>
                {tags.length}
              </span>
            </div>

            <div style={{ ...STYLES.card, background: '#fff' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#2563eb', fontWeight: 600 }}>
                Configuration
              </code>
              <pre style={{
                margin: 0,
                padding: '0.5rem',
                background: '#f9fafb',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
              }}>
{`maxTags: ${maxTags}
allowCustomTags: ${mode !== 'locked'}
caseSensitive: ${caseSensitive}
${mode !== 'open' ? `allowedTags: ${ALLOWED_TAGS.length} items` : ''}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Allowed Tags Reference */}
        {mode !== 'open' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={STYLES.groupLabel}>Allowed Tags</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALLOWED_TAGS.map((tag) => (
                <span key={tag} style={{
                  padding: '0.375rem 0.75rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. TAG DISPLAY — Visual representations
 * ───────────────────────────────────────────────────────────────────────────── */

function TagDisplayStory(): JSX.Element {
  const [displayTags, setDisplayTags] = useState([...SAMPLE_TAGS]);
  const maxVisible = 3;

  const moveTag = (fromIndex: number, toIndex: number) => {
    const newTags = [...displayTags];
    const [removed] = newTags.splice(fromIndex, 1);
    newTags.splice(toIndex, 0, removed);
    setDisplayTags(newTags);
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Tag Display</h1>
      <h2 style={STYLES.subheading}>
        Visual representations for different contexts
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* TagPills - List View */}
          <div>
            <div style={STYLES.groupLabel}>TagPills (List View)</div>
            <div style={{
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
                Compact display with overflow indicator:
              </p>
              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {displayTags.slice(0, maxVisible).map((tag) => (
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
                {displayTags.length > maxVisible && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: '#e5e7eb',
                    color: '#6b7280',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}>
                    +{displayTags.length - maxVisible}
                  </span>
                )}
              </div>
              <pre style={{
                margin: '1rem 0 0',
                padding: '0.5rem',
                background: '#f9fafb',
                borderRadius: '0.25rem',
                fontSize: '0.625rem',
                color: '#666',
              }}>
{`<TagPills
  field="tags"
  maxVisible={3}
  overflowLabel="+{{ tag_count }}"
/>`}
              </pre>
            </div>
          </div>

          {/* TagCloud */}
          <div>
            <div style={STYLES.groupLabel}>TagCloud (Sizes by Count)</div>
            <div style={{
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
                Visual weight indicates usage frequency:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {TAG_CLOUD_DATA.map((tag) => (
                  <span
                    key={tag.slug}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: '#f3e8ff',
                      color: '#7c3aed',
                      borderRadius: '9999px',
                      fontSize: `${0.75 + (tag.count / 300) * 0.5}rem`,
                      fontWeight: tag.count > 150 ? 600 : 400,
                    }}
                  >
                    #{tag.slug}
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

      {/* TagManager - Detail View */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>TagManager (Detail View)</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
            Full management interface with add, remove, and reorder:
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {displayTags.map((tag, index) => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#f9fafb',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem', width: '1.5rem' }}>
                    {index + 1}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: '#f3e8ff',
                    color: '#7c3aed',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                  }}>
                    #{tag}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => index > 0 && moveTag(index, index - 1)}
                      disabled={index === 0}
                      style={{
                        background: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.5 : 1,
                      }}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => index < displayTags.length - 1 && moveTag(index, index + 1)}
                      disabled={index === displayTags.length - 1}
                      style={{
                        background: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        cursor: index === displayTags.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === displayTags.length - 1 ? 0.5 : 1,
                      }}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setDisplayTags(displayTags.filter(t => t !== tag))}
                      style={{
                        background: 'none',
                        border: '1px solid #fca5a5',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        color: '#dc2626',
                      }}
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {displayTags.length} tags • Drag to reorder
          </div>
        </div>
      </section>

      {/* Case Normalization Demo */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Case Normalization</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
            When <code>caseSensitive: false</code> (default), variations collapse to canonical form:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { variants: ['React', 'REACT', 'react'], canonical: 'react' },
              { variants: ['TypeScript', 'typescript', 'Typescript'], canonical: 'typescript' },
              { variants: ['API', 'Api', 'api'], canonical: 'api' },
            ].map((item) => (
              <div key={item.canonical} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {item.variants.map((v) => (
                    <code key={v} style={{
                      padding: '0.125rem 0.375rem',
                      background: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      textDecoration: 'line-through',
                    }}>
                      {v}
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
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Schema and configuration
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Schema definition and configuration examples
      </h2>

      {/* Trait Schema */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Trait Schema (Taggable.trait.yaml)</div>
        <pre style={STYLES.codeBlock}>
{`trait:
  name: Taggable
  category: behavioral
  description: |
    Adds configurable tag management with guardrails
    for custom authoring and taxonomy alignment.

parameters:
  - name: maxTags
    type: number
    default: 10
    validation: { minimum: 1, maximum: 64 }

  - name: allowCustomTags
    type: boolean
    default: true
    description: Allow editors to author new tags

  - name: allowedTags
    type: string[]
    description: Curated allow list when custom disabled

  - name: caseSensitive
    type: boolean
    default: false
    description: Whether tag comparisons respect casing

schema:
  tags:
    type: string[]
    default: []
    validation: { maxItems: 64 }
  tag_count:
    type: number
    default: 0`}
        </pre>
      </section>

      {/* Configuration Examples */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Configuration Examples</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#555' }}>
          Three common configurations:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>✓ Open</div>
            <pre style={{ margin: 0, fontSize: '0.75rem' }}>
{`{
  maxTags: 10,
  allowCustomTags: true,
  caseSensitive: false
}`}
            </pre>
          </div>
          <div style={{ padding: '1rem', background: '#dbeafe', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📋 Allow List</div>
            <pre style={{ margin: 0, fontSize: '0.75rem' }}>
{`{
  maxTags: 5,
  allowCustomTags: true,
  allowedTags: [
    "bug", "feature",
    "enhancement"
  ]
}`}
            </pre>
          </div>
          <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🔒 Locked</div>
            <pre style={{ margin: 0, fontSize: '0.75rem' }}>
{`{
  maxTags: 3,
  allowCustomTags: false,
  allowedTags: [
    "critical", "normal",
    "low"
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* View Extensions */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>View Extension Mappings</div>
        <pre style={STYLES.codeBlock}>
{`view_extensions:
  list:
    - component: TagPills
      props:
        field: tags
        maxVisible: 3
        overflowLabel: "+{{ tag_count }}"

  detail:
    - component: TagManager
      position: top
      props:
        field: tags
        allowCustomParameter: allowCustomTags
        allowListParameter: allowedTags
        maxTagsParameter: maxTags

  form:
    - component: TagInput
      position: top
      props:
        field: tags
        maxTagsParameter: maxTags
        allowCustomParameter: allowCustomTags

  card:
    - component: TagSummary
      position: after
      props:
        field: tags
        countField: tag_count`}
        </pre>
      </section>

      {/* Token References */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Token References</div>
        <pre style={STYLES.codeBlock}>
{`tokens:
  taxonomy.tag.chip.bg: "var(--surface-tag-bg)"
  taxonomy.tag.chip.text: "var(--surface-tag-text)"
  taxonomy.tag.summary.count: "var(--text-subtle)"

// Usage in components:
.tag-chip {
  background: var(--taxonomy-tag-chip-bg);
  color: var(--taxonomy-tag-chip-text);
}

.tag-count {
  color: var(--taxonomy-tag-summary-count);
}`}
        </pre>
      </section>

      {/* Integration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Integration with Search/Filtering</div>
        <pre style={STYLES.codeBlock}>
{`// Filter by tags
GET /articles?tags=react,typescript

// SQL query with tag array containment
SELECT * FROM articles
WHERE tags @> ARRAY['react', 'typescript'];

// Full-text search with tag boost
SELECT *,
  ts_rank(search_vector, query) +
  CASE WHEN 'react' = ANY(tags) THEN 0.5 ELSE 0 END as score
FROM articles, to_tsquery('react') query
WHERE search_vector @@ query
ORDER BY score DESC;`}
        </pre>
      </section>

      {/* Difference from Classifiable */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Taggable vs Classifiable</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ ...STYLES.card, background: '#f3e8ff', borderColor: '#c4b5fd' }}>
            <h4 style={{ marginTop: 0, color: '#7c3aed' }}>Taggable</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.875rem' }}>
              <li>Flat tags only (folksonomy)</li>
              <li>Behavioral trait</li>
              <li>Simple governance (allow/deny)</li>
              <li>Case normalization</li>
              <li>Best for: Articles, Media, UGC</li>
            </ul>
          </div>
          <div style={{ ...STYLES.card, background: '#dbeafe', borderColor: '#93c5fd' }}>
            <h4 style={{ marginTop: 0, color: '#1e40af' }}>Classifiable</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.875rem' }}>
              <li>Hierarchy + tags (taxonomy)</li>
              <li>Core trait</li>
              <li>Advanced governance (policies)</li>
              <li>Synonym collapse, ltree queries</li>
              <li>Best for: Products, KB, CMS</li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          <strong>Note:</strong> Both traits can be used together on the same object for maximum flexibility.
        </p>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Traits/Core/Taggable',
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

// 2. Tag Input — Interactive governance demo
export const TagInput: Story = {
  name: '2. Tag Input',
  render: () => <TagInputStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Tag Display — Visual representations
export const TagDisplay: Story = {
  name: '3. Tag Display',
  render: () => <TagDisplayStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Schema and configuration
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
