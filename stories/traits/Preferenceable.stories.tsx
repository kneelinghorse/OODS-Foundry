/**
 * Preferenceable Trait — User Preferences with Schema Versioning
 *
 * This story demonstrates the Preferenceable trait which provides:
 * - Namespace-organized preferences (theme, notifications, display)
 * - JSON Schema-backed validation
 * - Schema versioning with migration support
 * - Registry-driven UI generation
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Namespace Explorer - Browse and configure namespaces
 * 3. Preference Editor - JSON Schema-driven form editing
 * 4. Schema Versioning - Migration and version tracking
 * 5. How It Works - Schema and configuration examples
 *
 * Research: R21.5 Preferenceable Trait Implementation
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

function NamespaceBadge({ namespace }: { namespace: 'theme' | 'notifications' | 'display' | 'custom' }): JSX.Element {
  const styles = {
    theme: { background: '#f3e8ff', color: '#7c3aed', icon: '🎨' },
    notifications: { background: '#fef3c7', color: '#92400e', icon: '🔔' },
    display: { background: '#dbeafe', color: '#1e40af', icon: '🖥️' },
    custom: { background: '#f3f4f6', color: '#374151', icon: '⚙️' },
  };
  const labels = { theme: 'Theme', notifications: 'Notifications', display: 'Display', custom: 'Custom' };
  const s = styles[namespace];
  return (
    <span style={{ ...STYLES.badge, background: s.background, color: s.color, border: `1px solid ${s.color}20` }}>
      <span>{s.icon}</span>
      {labels[namespace]}
    </span>
  );
}

function VersionBadge({ version, current = false }: { version: string; current?: boolean }): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: current ? '#dcfce7' : '#f3f4f6',
      color: current ? '#166534' : '#6b7280',
      border: current ? '1px solid #86efac' : '1px solid #d1d5db',
    }}>
      <span style={{ fontSize: '0.625rem' }}>{current ? '●' : '○'}</span>
      v{version}
    </span>
  );
}

function ValidationBadge({ valid }: { valid: boolean }): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: valid ? '#dcfce7' : '#fef2f2',
      color: valid ? '#166534' : '#dc2626',
    }}>
      <span style={{ fontSize: '0.75rem' }}>{valid ? '✓' : '✗'}</span>
      {valid ? 'Valid' : 'Invalid'}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_PREFERENCES = {
  version: '1.0.0',
  preferences: {
    theme: {
      mode: 'system' as const,
      density: 'comfortable' as const,
      accentColor: 'blue',
    },
    notifications: {
      mention: { email: true, push: true, in_app: true },
      digest: { email: true, push: false, in_app: false },
      marketing: { email: false, push: false, in_app: false },
    },
    display: {
      timezone: 'America/New_York',
      dateFormat: 'MMM d, yyyy',
      language: 'en-US',
    },
  },
  metadata: {
    schemaVersion: '1.0.0',
    lastUpdated: '2025-12-04T10:30:00Z',
    source: 'user' as const,
    migrationApplied: [] as string[],
  },
};

const SCHEMA_VERSIONS = [
  {
    version: '1.0.0',
    date: '2025-10-01',
    changes: ['Initial schema', 'Theme, notifications, display namespaces'],
    current: true,
  },
  {
    version: '0.9.0',
    date: '2025-09-15',
    changes: ['Beta schema', 'Basic theme support'],
    current: false,
  },
  {
    version: '0.8.0',
    date: '2025-09-01',
    changes: ['Alpha schema', 'Minimal preferences'],
    current: false,
  },
];

const MIGRATION_HISTORY = [
  { from: '0.8.0', to: '0.9.0', appliedAt: '2025-09-15T12:00:00Z', fields: ['theme.mode added'] },
  { from: '0.9.0', to: '1.0.0', appliedAt: '2025-10-01T12:00:00Z', fields: ['notifications namespace added', 'display namespace added'] },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Preferenceable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Preferenceable</h1>
      <h2 style={STYLES.subheading}>
        User preferences with schema versioning and namespace governance
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Preferenceable provides a <strong>centralized preference system</strong> with <strong>JSONB storage</strong>,
          <strong>namespace organization</strong>, and <strong>schema versioning</strong>.
          Manage user settings with validation, migrations, and registry-driven UI generation.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Preferenceable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Scattered settings across tables</li>
              <li>No validation or type safety</li>
              <li>Migration nightmares on schema changes</li>
              <li>Inconsistent UI patterns</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Preferenceable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Centralized JSONB preference document</li>
              <li>JSON Schema validation</li>
              <li>Versioned migrations</li>
              <li>Registry-driven UI generation</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>preference_document</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>JSONB payload with version and preferences map</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>preference_metadata</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Schema version, lastUpdated, migrations</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>preference_namespaces</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Materialized list of active namespaces</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>preference_mutations</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Cache invalidation counter</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Default Namespaces</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <NamespaceBadge namespace="theme" />
          <NamespaceBadge namespace="notifications" />
          <NamespaceBadge namespace="display" />
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['User', 'Organization', 'Workspace'].map((obj) => (
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
        <h3 style={{ marginBottom: '1rem' }}>Parameters</h3>
        <div style={{ ...STYLES.card, background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <code style={{ color: '#7c3aed', fontWeight: 600 }}>namespaces</code>
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Allowed top-level keys (theme, notifications, display)
              </div>
            </div>
            <div>
              <code style={{ color: '#7c3aed', fontWeight: 600 }}>schemaVersion</code>
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Current schema version (SemVer)
              </div>
            </div>
            <div>
              <code style={{ color: '#7c3aed', fontWeight: 600 }}>allowUnknownNamespaces</code>
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Escape hatch for custom namespaces
              </div>
            </div>
            <div>
              <code style={{ color: '#7c3aed', fontWeight: 600 }}>registryNamespace</code>
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Registry ID for schema/UI bundles
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. NAMESPACE EXPLORER — Browse and configure namespaces
 * ───────────────────────────────────────────────────────────────────────────── */

function NamespaceExplorerStory(): JSX.Element {
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>('theme');
  const [allowUnknown, setAllowUnknown] = useState(false);

  const namespaces = [
    {
      id: 'theme',
      name: 'Theme',
      icon: '🎨',
      description: 'Visual appearance settings',
      fields: [
        { key: 'mode', type: 'enum', options: ['light', 'dark', 'system'], value: 'system' },
        { key: 'density', type: 'enum', options: ['compact', 'comfortable', 'spacious'], value: 'comfortable' },
        { key: 'accentColor', type: 'string', value: 'blue' },
      ],
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: '🔔',
      description: 'Notification channel preferences',
      fields: [
        { key: 'mention.email', type: 'boolean', value: true },
        { key: 'mention.push', type: 'boolean', value: true },
        { key: 'mention.in_app', type: 'boolean', value: true },
        { key: 'digest.email', type: 'boolean', value: true },
        { key: 'marketing.email', type: 'boolean', value: false },
      ],
    },
    {
      id: 'display',
      name: 'Display',
      icon: '🖥️',
      description: 'Regional and format preferences',
      fields: [
        { key: 'timezone', type: 'string', value: 'America/New_York' },
        { key: 'dateFormat', type: 'string', value: 'MMM d, yyyy' },
        { key: 'language', type: 'enum', options: ['en-US', 'es-ES', 'fr-FR', 'de-DE'], value: 'en-US' },
      ],
    },
  ];

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Namespace Explorer</h1>
      <h2 style={STYLES.subheading}>
        Browse and configure preference namespaces
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Active Namespaces</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <NamespaceBadge namespace="theme" />
          <NamespaceBadge namespace="notifications" />
          <NamespaceBadge namespace="display" />
          <ValidationBadge valid={true} />
        </div>

        {/* Unknown namespace toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: '#f9fafb',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowUnknown}
              onChange={(e) => setAllowUnknown(e.target.checked)}
              style={{ width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.875rem' }}>Allow unknown namespaces</span>
          </label>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            (enables custom namespace creation)
          </span>
        </div>

        {/* Namespace Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {namespaces.map((ns) => (
            <div
              key={ns.id}
              style={{
                ...STYLES.card,
                background: '#fff',
                padding: 0,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedNamespace(expandedNamespace === ns.id ? null : ns.id)}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  background: expandedNamespace === ns.id ? '#f0f9ff' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{ns.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ns.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{ns.description}</div>
                  </div>
                </div>
                <span style={{
                  transform: expandedNamespace === ns.id ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}>
                  ▼
                </span>
              </button>

              {/* Expanded Content */}
              {expandedNamespace === ns.id && (
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {ns.fields.map((field) => (
                      <div
                        key={field.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0',
                        }}
                      >
                        <code style={{ fontSize: '0.875rem', color: '#374151' }}>
                          {field.key}
                        </code>
                        {field.type === 'boolean' ? (
                          <label style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '2.5rem',
                            height: '1.25rem',
                          }}>
                            <input
                              type="checkbox"
                              checked={field.value as boolean}
                              readOnly
                              style={{
                                opacity: 0,
                                width: 0,
                                height: 0,
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              cursor: 'pointer',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: field.value ? '#3b82f6' : '#d1d5db',
                              borderRadius: '9999px',
                              transition: 'background 0.2s',
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '1rem',
                                width: '1rem',
                                left: field.value ? '1.375rem' : '0.125rem',
                                bottom: '0.125rem',
                                background: '#fff',
                                borderRadius: '50%',
                                transition: 'left 0.2s',
                              }} />
                            </span>
                          </label>
                        ) : field.type === 'enum' ? (
                          <select
                            value={field.value as string}
                            disabled
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              background: '#f9fafb',
                            }}
                          >
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={field.value as string}
                            readOnly
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              background: '#f9fafb',
                              width: '150px',
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Custom Namespace (if allowed) */}
        {allowUnknown && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '2px dashed #d1d5db',
            borderRadius: '0.75rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <span style={{ fontSize: '1.25rem' }}>+</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Add Custom Namespace</div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. PREFERENCE EDITOR — JSON Schema-driven form editing
 * ───────────────────────────────────────────────────────────────────────────── */

function PreferenceEditorStory(): JSX.Element {
  const [preferences, setPreferences] = useState(SAMPLE_PREFERENCES.preferences);
  const [showDiff, setShowDiff] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const originalPreferences = SAMPLE_PREFERENCES.preferences;

  const handleThemeModeChange = (mode: 'light' | 'dark' | 'system') => {
    setPreferences({
      ...preferences,
      theme: { ...preferences.theme, mode },
    });
  };

  const handleDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
    setPreferences({
      ...preferences,
      theme: { ...preferences.theme, density },
    });
  };

  const handleNotificationToggle = (category: 'mention' | 'digest' | 'marketing', channel: 'email' | 'push' | 'in_app') => {
    setPreferences({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [category]: {
          ...preferences.notifications[category],
          [channel]: !preferences.notifications[category][channel],
        },
      },
    });
  };

  const resetToDefaults = () => {
    setPreferences(SAMPLE_PREFERENCES.preferences);
    setValidationErrors([]);
  };

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Preference Editor</h1>
      <h2 style={STYLES.subheading}>
        JSON Schema-driven form with real-time validation
      </h2>

      {/* Toolbar */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '0.75rem 1rem',
        background: '#f9fafb',
        borderRadius: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ValidationBadge valid={validationErrors.length === 0} />
          {hasChanges && (
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500 }}>
              Unsaved changes
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowDiff(!showDiff)}
            style={{
              padding: '0.5rem 1rem',
              background: showDiff ? '#dbeafe' : '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
          <button
            onClick={resetToDefaults}
            style={{
              padding: '0.5rem 1rem',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: showDiff ? '1fr 300px' : '1fr', gap: '2rem' }}>
        {/* Editor */}
        <div>
          {/* Theme Section */}
          <section style={{ ...STYLES.section, ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <NamespaceBadge namespace="theme" />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Visual appearance</span>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Mode */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Mode
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleThemeModeChange(mode)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: preferences.theme.mode === mode ? '#3b82f6' : '#f9fafb',
                        color: preferences.theme.mode === mode ? '#fff' : '#374151',
                        border: '1px solid',
                        borderColor: preferences.theme.mode === mode ? '#3b82f6' : '#e5e7eb',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '💻'} {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Density
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => handleDensityChange(density)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: preferences.theme.density === density ? '#3b82f6' : '#f9fafb',
                        color: preferences.theme.density === density ? '#fff' : '#374151',
                        border: '1px solid',
                        borderColor: preferences.theme.density === density ? '#3b82f6' : '#e5e7eb',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Accent Color
                </label>
                <input
                  type="text"
                  value={preferences.theme.accentColor}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    theme: { ...preferences.theme, accentColor: e.target.value },
                  })}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    width: '150px',
                  }}
                />
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section style={{ ...STYLES.section, ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <NamespaceBadge namespace="notifications" />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Channel preferences</span>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {(['mention', 'digest', 'marketing'] as const).map((category) => (
                <div key={category} style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '0.5rem',
                }}>
                  <div style={{
                    fontWeight: 500,
                    marginBottom: '0.75rem',
                    textTransform: 'capitalize',
                  }}>
                    {category}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    {(['email', 'push', 'in_app'] as const).map((channel) => (
                      <label
                        key={channel}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={preferences.notifications[category][channel]}
                          onChange={() => handleNotificationToggle(category, channel)}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                          {channel.replace('_', '-')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Display Section */}
          <section style={{ ...STYLES.section, ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <NamespaceBadge namespace="display" />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Regional settings</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Timezone
                </label>
                <select
                  value={preferences.display.timezone}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    display: { ...preferences.display, timezone: e.target.value },
                  })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                  }}
                >
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Date Format
                </label>
                <select
                  value={preferences.display.dateFormat}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    display: { ...preferences.display, dateFormat: e.target.value },
                  })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                  }}
                >
                  <option value="MMM d, yyyy">MMM d, yyyy</option>
                  <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                  <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                  <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Language
                </label>
                <select
                  value={preferences.display.language}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    display: { ...preferences.display, language: e.target.value },
                  })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                  }}
                >
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Diff Panel */}
        {showDiff && (
          <div style={{ ...STYLES.card, background: '#fff', height: 'fit-content' }}>
            <div style={STYLES.groupLabel}>Changes</div>
            {hasChanges ? (
              <pre style={{
                ...STYLES.codeBlock,
                fontSize: '0.75rem',
                maxHeight: '400px',
              }}>
                {JSON.stringify(preferences, null, 2)}
              </pre>
            ) : (
              <div style={{ color: '#888', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No changes made
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. SCHEMA VERSIONING — Migration and version tracking
 * ───────────────────────────────────────────────────────────────────────────── */

function SchemaVersioningStory(): JSX.Element {
  const [selectedVersion, setSelectedVersion] = useState('1.0.0');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Schema Versioning</h1>
      <h2 style={STYLES.subheading}>
        Version tracking and migration history
      </h2>

      {/* Current Version */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Current Schema Version</div>
        <div style={{
          ...STYLES.card,
          background: '#f0fdf4',
          borderColor: '#86efac',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <VersionBadge version="1.0.0" current={true} />
              <span style={{ fontWeight: 600, color: '#166534' }}>Stable Release</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#555' }}>
              Released on October 1, 2025
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Compatibility</div>
            <div style={{ color: '#166534', fontWeight: 500 }}>Fully backward compatible</div>
          </div>
        </div>
      </section>

      {/* Version Timeline */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Version History</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {SCHEMA_VERSIONS.map((v, index) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(v.version)}
              style={{
                ...STYLES.card,
                background: selectedVersion === v.version ? '#eff6ff' : '#fff',
                borderColor: selectedVersion === v.version ? '#3b82f6' : '#e0e0e0',
                padding: '1rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              {/* Timeline Indicator */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  background: v.current ? '#3b82f6' : '#d1d5db',
                  border: '2px solid',
                  borderColor: v.current ? '#3b82f6' : '#d1d5db',
                }} />
                {index < SCHEMA_VERSIONS.length - 1 && (
                  <div style={{
                    width: '2px',
                    height: '2rem',
                    background: '#d1d5db',
                  }} />
                )}
              </div>

              {/* Version Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <VersionBadge version={v.version} current={v.current} />
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>{v.date}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
                  {v.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Migration History */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Migration History</div>
        <div style={{ ...STYLES.card, background: '#fff', padding: 0 }}>
          {MIGRATION_HISTORY.map((migration, index) => (
            <div
              key={index}
              style={{
                padding: '1rem 1.5rem',
                borderBottom: index < MIGRATION_HISTORY.length - 1 ? '1px solid #e5e7eb' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <VersionBadge version={migration.from} />
                <span style={{ color: '#888' }}>→</span>
                <VersionBadge version={migration.to} current={migration.to === '1.0.0'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {new Date(migration.appliedAt).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#555' }}>
                  {migration.fields.join(', ')}
                </div>
              </div>
              <span style={{
                ...STYLES.badge,
                background: '#dcfce7',
                color: '#166534',
              }}>
                Applied
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Migration Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Pending Migrations</div>
        <div style={{
          ...STYLES.card,
          background: '#fffbeb',
          borderColor: '#fcd34d',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <span style={{ fontSize: '1.5rem' }}>✓</span>
          <div>
            <div style={{ fontWeight: 600, color: '#92400e' }}>No pending migrations</div>
            <div style={{ fontSize: '0.875rem', color: '#b45309' }}>
              Your preferences are on the latest schema version.
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

      {/* PreferenceDocument Schema */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>PreferenceDocument Schema</div>
        <pre style={STYLES.codeBlock}>
{`// PreferenceDocument - Main preference payload
{
  "version": "1.0.0",
  "preferences": {
    "theme": {
      "mode": "system",
      "density": "comfortable",
      "accentColor": "blue"
    },
    "notifications": {
      "mention": { "email": true, "push": true, "in_app": true },
      "digest": { "email": true, "push": false, "in_app": false },
      "marketing": { "email": false, "push": false, "in_app": false }
    },
    "display": {
      "timezone": "America/New_York",
      "dateFormat": "MMM d, yyyy",
      "language": "en-US"
    }
  },
  "metadata": {
    "schemaVersion": "1.0.0",
    "lastUpdated": "2025-12-04T10:30:00Z",
    "source": "user",
    "migrationApplied": []
  }
}`}
        </pre>
      </section>

      {/* Namespace Configuration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Namespace Configuration</div>
        <pre style={STYLES.codeBlock}>
{`trait:
  name: Preferenceable
  version: 1.0.0
  category: core

parameters:
  - name: namespaces
    type: string[]
    default:
      - theme
      - notifications
      - display
    validation:
      minItems: 1
      maxItems: 12
      uniqueItems: true

  - name: schemaVersion
    type: string
    default: 1.0.0
    validation:
      pattern: "^\\d+\\.\\d+\\.\\d+$"

  - name: allowUnknownNamespaces
    type: boolean
    default: false

  - name: registryNamespace
    type: string
    default: user-preferences`}
        </pre>
      </section>

      {/* Schema Registry Integration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Schema Registry Integration</div>
        <pre style={STYLES.codeBlock}>
{`// Fetch JSON Schema from registry
const schema = await registry.getSchema(
  'user-preferences',
  '1.0.0'
);

// Schema includes:
// - Type definitions for each namespace
// - Validation rules (enum values, patterns)
// - Default values
// - UI hints for form generation

// Example: Theme namespace schema
{
  "type": "object",
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["light", "dark", "system"],
      "default": "system",
      "x-ui-hint": "radio-group"
    },
    "density": {
      "type": "string",
      "enum": ["compact", "comfortable", "spacious"],
      "default": "comfortable",
      "x-ui-hint": "button-group"
    },
    "accentColor": {
      "type": "string",
      "pattern": "^[a-z]+$",
      "x-ui-hint": "color-picker"
    }
  }
}`}
        </pre>
      </section>

      {/* UI Generation */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>UI Generation from JSON Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Generate preference form from schema
function PreferenceEditor({ schema, values, onChange }) {
  return (
    <form>
      {Object.entries(schema.properties).map(([key, prop]) => (
        <FormField
          key={key}
          name={key}
          type={prop['x-ui-hint'] || inferType(prop)}
          options={prop.enum}
          value={values[key]}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </form>
  );
}

// UI hints map to components:
// - "radio-group" → RadioGroup
// - "button-group" → ButtonGroup
// - "color-picker" → ColorPicker
// - "toggle" → Switch
// - "select" → Select`}
        </pre>
      </section>

      {/* Migration Pipeline */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Migration Pipeline</div>
        <pre style={STYLES.codeBlock}>
{`// Migration pipeline for schema version changes
async function migratePreferences(prefs, fromVersion, toVersion) {
  // 1. Get migration path from registry
  const migrations = await registry.getMigrationPath(
    fromVersion,
    toVersion
  );

  // 2. Apply migrations sequentially
  let current = prefs;
  for (const migration of migrations) {
    current = await migration.transform(current);
    current.metadata.migrationApplied.push(migration.id);
  }

  // 3. Update version
  current.version = toVersion;
  current.metadata.schemaVersion = toVersion;
  current.metadata.lastUpdated = new Date().toISOString();

  return current;
}

// Example migration: 0.9.0 → 1.0.0
{
  id: "m-0.9.0-to-1.0.0",
  transform: (prefs) => ({
    ...prefs,
    preferences: {
      ...prefs.preferences,
      notifications: prefs.preferences.notifications || DEFAULT_NOTIFICATIONS,
      display: prefs.preferences.display || DEFAULT_DISPLAY
    }
  })
}`}
        </pre>
      </section>

      {/* Cache Invalidation */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Cache Invalidation via preference_mutations</div>
        <pre style={STYLES.codeBlock}>
{`// preference_mutations is a monotonic counter
// Increment on every preference change

// Update preference
async function updatePreference(userId, namespace, key, value) {
  await db.transaction(async (tx) => {
    // 1. Update preference document
    await tx.execute(\`
      UPDATE users
      SET preference_document = jsonb_set(
        preference_document,
        '{preferences, \${namespace}, \${key}}',
        '\${JSON.stringify(value)}'
      ),
      preference_mutations = preference_mutations + 1
      WHERE id = $1
    \`, [userId]);
  });

  // 2. Cache is automatically invalidated
  // Clients poll preference_mutations to detect changes
}

// Client-side cache check
function usePreferences(userId) {
  const [prefs, setPrefs] = useState(null);
  const [mutations, setMutations] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const current = await api.getMutationCount(userId);
      if (current > mutations) {
        const newPrefs = await api.getPreferences(userId);
        setPrefs(newPrefs);
        setMutations(current);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, mutations]);

  return prefs;
}`}
        </pre>
      </section>

      {/* View Extensions */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>View Extension Mappings</div>
        <pre style={STYLES.codeBlock}>
{`view_extensions:
  list:
    - component: PreferenceSummaryBadge
      position: after
      props:
        namespacesField: preference_namespaces
        versionField: preference_version

  detail:
    - component: PreferencePanel
      position: main
      priority: 55
      props:
        preferencesField: preference_document
        metadataField: preference_metadata
        namespaceField: preference_namespaces

  form:
    - component: PreferenceEditor
      position: main
      props:
        namespacesField: preference_namespaces
        documentField: preference_document
        registryNamespaceParameter: registryNamespace

  timeline:
    - component: PreferenceTimeline
      props:
        metadataField: preference_metadata`}
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
  title: 'Traits/Core/Preferenceable',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

// 1. Overview - First in nav
export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 2. Namespace Explorer - Browse namespaces
export const NamespaceExplorer: Story = {
  name: '2. Namespace Explorer',
  render: () => <NamespaceExplorerStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Preference Editor - Form editing
export const PreferenceEditor: Story = {
  name: '3. Preference Editor',
  render: () => <PreferenceEditorStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. Schema Versioning - Migration tracking
export const SchemaVersioning: Story = {
  name: '4. Schema Versioning',
  render: () => <SchemaVersioningStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 5. How It Works - Schema and configuration
export const HowItWorks: Story = {
  name: '5. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
