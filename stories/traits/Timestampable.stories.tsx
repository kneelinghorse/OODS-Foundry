/**
 * Timestampable Trait — Temporal Formatting Demo
 *
 * This story demonstrates the Timestampable trait which provides:
 * Consistent temporal metadata and formatting for objects.
 *
 * Unlike Authable (access control) or Stateful (state machines),
 * Timestampable is primarily a FORMATTING concern: how timestamps
 * are displayed in different contexts.
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What fields does it add?
 * 2. Format Gallery - Visual showcase of different formats
 * 3. Relative vs Absolute - When to use each
 * 4. Localization - Timezone handling
 */

import React from 'react';
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
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample timestamp used throughout all examples
 * ───────────────────────────────────────────────────────────────────────────── */

// Use a fixed date for consistent display
const SAMPLE_TIMESTAMP = new Date('2024-12-01T15:30:00Z');
const SAMPLE_ISO = '2024-12-01T15:30:00Z';

/* ─────────────────────────────────────────────────────────────────────────────
 * Formatting helpers
 * ───────────────────────────────────────────────────────────────────────────── */

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
}

type FormatConfig = {
  name: string;
  description: string;
  format: (date: Date) => string;
  useCase: string;
};

const FORMATS: FormatConfig[] = [
  {
    name: 'Relative',
    description: 'Human-friendly time distance',
    format: formatRelative,
    useCase: 'List views, activity feeds',
  },
  {
    name: 'Short Date',
    description: 'Month, day, year',
    format: (d) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d),
    useCase: 'Table columns, compact displays',
  },
  {
    name: 'Long Date',
    description: 'Full month name',
    format: (d) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(d),
    useCase: 'Detail views, headers',
  },
  {
    name: 'Date + Time',
    description: 'Full datetime',
    format: (d) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d),
    useCase: 'Audit logs, precise records',
  },
  {
    name: 'ISO 8601',
    description: 'Machine-readable standard',
    format: (d) => d.toISOString(),
    useCase: 'APIs, exports, logs',
  },
  {
    name: 'Compact',
    description: 'Numeric short form',
    format: (d) => new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(d),
    useCase: 'Space-constrained UIs',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Timestampable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Timestampable</h1>
      <h2 style={STYLES.subheading}>
        Consistent temporal metadata for all objects
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Timestampable adds <strong>temporal metadata</strong> to objects: when they were created,
          when they were last modified, and a log of significant events. It also handles
          how these timestamps are <strong>displayed</strong> in different contexts.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without a System
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Inconsistent date formats across views</li>
              <li>Hardcoded timezone handling</li>
              <li>Missing audit trail fields</li>
              <li>"Updated 5 minutes ago" in one place, "12/1/24" in another</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Timestampable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Consistent formatting per context</li>
              <li>Configurable timezone handling</li>
              <li>Standard audit fields on every object</li>
              <li>Relative for scanning, absolute for precision</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Fields Added by Timestampable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>created_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>When the object was first created (immutable)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>updated_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Last modification timestamp (auto-updated)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>last_event</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Name of the most recent significant event</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>last_event_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>When that event occurred</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Question</h3>
        <div style={{
          padding: '1.5rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
        }}>
          <div style={{ fontSize: '1rem', color: '#475569', marginBottom: '0.5rem' }}>
            "How should I display this timestamp?"
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <code style={{ padding: '0.5rem 0.75rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '0.25rem' }}>
              {SAMPLE_ISO}
            </code>
            <span style={{ color: '#888', fontSize: '1.25rem' }}>→</span>
            <span style={{ padding: '0.5rem 0.75rem', background: '#dbeafe', borderRadius: '0.25rem', color: '#1e40af' }}>
              {formatRelative(SAMPLE_TIMESTAMP)}
            </span>
            <span style={{ color: '#666' }}>or</span>
            <span style={{ padding: '0.5rem 0.75rem', background: '#dcfce7', borderRadius: '0.25rem', color: '#166534' }}>
              {FORMATS[1].format(SAMPLE_TIMESTAMP)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. FORMAT GALLERY — Visual showcase of all formats
 * ───────────────────────────────────────────────────────────────────────────── */

function FormatGalleryStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Format Gallery</h1>
      <h2 style={STYLES.subheading}>
        The same timestamp in different display formats
      </h2>

      <section style={STYLES.section}>
        <div style={{
          padding: '1rem 1.5rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
        }}>
          <div style={STYLES.groupLabel}>Source Timestamp</div>
          <code style={{ fontSize: '1.125rem', fontWeight: 600, color: '#0369a1' }}>
            {SAMPLE_ISO}
          </code>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {FORMATS.map((fmt) => (
            <div key={fmt.name} style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr 250px',
              gap: '1rem',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{fmt.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fmt.description}</div>
              </div>
              <div style={{
                padding: '0.75rem 1rem',
                background: '#f3f4f6',
                borderRadius: '0.375rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: '#374151',
              }}>
                {fmt.format(SAMPLE_TIMESTAMP)}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {fmt.useCase}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Implementation</div>
        <pre style={STYLES.codeBlock}>
{`// Using Intl.DateTimeFormat (no external library needed)

// Short date
new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
// → "Dec 1, 2024"

// Long date
new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date)
// → "December 1, 2024"

// Date + time
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(date)
// → "Dec 1, 2024, 10:30 AM"

// ISO (machine-readable)
date.toISOString()
// → "2024-12-01T15:30:00.000Z"`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. RELATIVE VS ABSOLUTE — When to use each
 * ───────────────────────────────────────────────────────────────────────────── */

function RelativeVsAbsoluteStory(): JSX.Element {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Relative vs Absolute</h1>
      <h2 style={STYLES.subheading}>
        Choosing the right format for the context
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Relative column */}
          <div>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#dbeafe',
              borderRadius: '0.5rem 0.5rem 0 0',
              borderBottom: '2px solid #3b82f6',
            }}>
              <h3 style={{ margin: 0, color: '#1e40af', fontSize: '1rem' }}>Relative Timestamps</h3>
            </div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderTop: 'none',
              borderRadius: '0 0 0.5rem 0.5rem',
            }}>
              <p style={{ marginTop: 0, color: '#555', lineHeight: 1.7 }}>
                <strong>Use when recency matters.</strong> Users scan to understand "how fresh" something is.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <div style={STYLES.groupLabel}>Examples</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#3b82f6', fontWeight: 500 }}>5 minutes ago</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— very recent</span>
                  </li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#3b82f6', fontWeight: 500 }}>2 hours ago</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— today</span>
                  </li>
                  <li style={{ padding: '0.5rem 0' }}>
                    <span style={{ color: '#3b82f6', fontWeight: 500 }}>2 days ago</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— recent past</span>
                  </li>
                </ul>
              </div>
              <div style={STYLES.groupLabel}>Best For</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['List views', 'Activity feeds', 'Comments', 'Notifications'].map((use) => (
                  <span key={use} style={{
                    padding: '0.25rem 0.5rem',
                    background: '#eff6ff',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#3b82f6',
                  }}>
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Absolute column */}
          <div>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#dcfce7',
              borderRadius: '0.5rem 0.5rem 0 0',
              borderBottom: '2px solid #22c55e',
            }}>
              <h3 style={{ margin: 0, color: '#166534', fontSize: '1rem' }}>Absolute Timestamps</h3>
            </div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderTop: 'none',
              borderRadius: '0 0 0.5rem 0.5rem',
            }}>
              <p style={{ marginTop: 0, color: '#555', lineHeight: 1.7 }}>
                <strong>Use when precision matters.</strong> Users need to know the exact date/time.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <div style={STYLES.groupLabel}>Examples</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>Dec 1, 2024</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— date only</span>
                  </li>
                  <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>Dec 1, 2024 3:30 PM</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— with time</span>
                  </li>
                  <li style={{ padding: '0.5rem 0' }}>
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>December 1, 2024</span>
                    <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.875rem' }}>— formal</span>
                  </li>
                </ul>
              </div>
              <div style={STYLES.groupLabel}>Best For</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['Detail pages', 'Audit logs', 'Reports', 'Invoices'].map((use) => (
                  <span key={use} style={{
                    padding: '0.25rem 0.5rem',
                    background: '#f0fdf4',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#22c55e',
                  }}>
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Context examples */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Context Examples</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              List View
            </h4>
            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '0.75rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Project Alpha</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Updated 5 min ago</div>
            </div>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              Detail View
            </h4>
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>Created:</span>
                <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>Dec 1, 2024</span>
              </div>
              <div>
                <span style={{ color: '#6b7280' }}>Updated:</span>
                <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>Dec 3, 2024 at 3:30 PM</span>
              </div>
            </div>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              Tooltip Hybrid
            </h4>
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ color: '#3b82f6', fontWeight: 500, marginBottom: '0.25rem' }}>2 days ago</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                (hover shows: Dec 1, 2024 3:30 PM)
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. LOCALIZATION — Timezone handling
 * ───────────────────────────────────────────────────────────────────────────── */

function LocalizationStory(): JSX.Element {
  const timezones = [
    { name: 'UTC', zone: 'UTC', offset: '+00:00' },
    { name: 'PST (Los Angeles)', zone: 'America/Los_Angeles', offset: '-08:00' },
    { name: 'EST (New York)', zone: 'America/New_York', offset: '-05:00' },
    { name: 'CET (Paris)', zone: 'Europe/Paris', offset: '+01:00' },
    { name: 'JST (Tokyo)', zone: 'Asia/Tokyo', offset: '+09:00' },
  ];

  const formatInTimezone = (date: Date, timezone: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Localization</h1>
      <h2 style={STYLES.subheading}>
        The same moment displayed in different timezones
      </h2>

      <section style={STYLES.section}>
        <div style={{
          padding: '1rem 1.5rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
        }}>
          <div style={STYLES.groupLabel}>Source Timestamp (UTC)</div>
          <code style={{ fontSize: '1.125rem', fontWeight: 600, color: '#0369a1' }}>
            {SAMPLE_ISO}
          </code>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {timezones.map((tz) => (
            <div key={tz.zone} style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr 100px',
              gap: '1rem',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
            }}>
              <div style={{ fontWeight: 500, color: '#374151' }}>{tz.name}</div>
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.9375rem',
                color: '#111827',
              }}>
                {formatInTimezone(SAMPLE_TIMESTAMP, tz.zone)}
              </div>
              <div style={{
                padding: '0.25rem 0.5rem',
                background: '#f3f4f6',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                color: '#6b7280',
                textAlign: 'center',
              }}>
                {tz.offset}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Timezone parameter options */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Timestampable Timezone Options</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>UTC</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>
              Always display in UTC. Best for APIs, logs, and cross-timezone collaboration.
            </span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>LOCAL</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>
              Convert to user's browser timezone. Best for user-facing displays.
            </span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>OFFSET</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>
              Show with explicit offset (+05:30). Best when timezone context matters.
            </span>
          </div>
        </div>
      </section>

      {/* Implementation */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Implementation</div>
        <pre style={STYLES.codeBlock}>
{`// Intl.DateTimeFormat handles timezone conversion automatically

const utcTimestamp = '2024-12-01T15:30:00Z';
const date = new Date(utcTimestamp);

// Display in user's local timezone
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(date)
// Browser automatically uses local timezone

// Display in specific timezone
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Los_Angeles',
}).format(date)
// → "Dec 1, 2024, 7:30 AM"

// Display with timezone name
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'long',
  timeZone: 'America/New_York',
}).format(date)
// → "Dec 1, 2024, 10:30:00 AM EST"`}
        </pre>
      </section>

      {/* Best practices */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Best Practices</div>
        <div style={{
          padding: '1.5rem',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '0.5rem',
        }}>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 2, color: '#92400e' }}>
            <li><strong>Store in UTC</strong> — Always persist timestamps in UTC (ISO 8601)</li>
            <li><strong>Display locally</strong> — Convert to user's timezone for display</li>
            <li><strong>Show timezone when ambiguous</strong> — "3:30 PM EST" not just "3:30 PM"</li>
            <li><strong>Use relative for recency</strong> — "5 min ago" transcends timezones</li>
          </ul>
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
  title: 'Traits/Lifecycle/Timestampable',
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

// 2. Format Gallery — Visual showcase
export const FormatGallery: Story = {
  name: '2. Format Gallery',
  render: () => <FormatGalleryStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Relative vs Absolute — Usage guidance
export const RelativeVsAbsolute: Story = {
  name: '3. Relative vs Absolute',
  render: () => <RelativeVsAbsoluteStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. Localization — Timezone handling
export const Localization: Story = {
  name: '4. Localization',
  render: () => <LocalizationStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
