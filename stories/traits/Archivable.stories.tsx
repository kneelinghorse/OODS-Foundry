/**
 * Archivable Trait — Lifecycle Management Demo
 *
 * This story demonstrates the Archivable trait which provides:
 * Soft delete with retention policy and restore capability.
 *
 * Unlike Stateful (state machines) or Statusable (visual presentation),
 * Archivable is a LIFECYCLE concern: binary state (archived/not)
 * with time-based retention and restore windows.
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Archive States - Visual comparison of active vs archived
 * 3. Retention Policy - Timeline showing grace period and restore window
 * 4. How It Works - Mechanics of archive/restore lifecycle
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
 * Sample data for demonstrations
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_ARCHIVED_AT = new Date('2024-12-01T10:30:00Z');
const SAMPLE_RESTORE_DEADLINE = new Date('2024-12-31T10:30:00Z');

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Badge Components
 * ───────────────────────────────────────────────────────────────────────────── */

function ActiveBadge(): JSX.Element {
  return (
    <span
      style={{
        ...STYLES.badge,
        background: '#dcfce7',
        color: '#166534',
        border: '1px solid #86efac',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>●</span>
      Active
    </span>
  );
}

function ArchivedBadge(): JSX.Element {
  return (
    <span
      style={{
        ...STYLES.badge,
        background: '#f3f4f6',
        color: '#6b7280',
        border: '1px solid #d1d5db',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>◐</span>
      Archived
    </span>
  );
}

function DeletedBadge(): JSX.Element {
  return (
    <span
      style={{
        ...STYLES.badge,
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fca5a5',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>×</span>
      Permanently Deleted
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Archivable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Archivable</h1>
      <h2 style={STYLES.subheading}>
        Soft delete with retention policy and restore capability
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Archivable adds <strong>soft delete</strong> behavior to objects: instead of
          immediately removing data, objects enter an archived state where they can be
          <strong> restored</strong> within a configurable grace period.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Archivable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Deletion is permanent and immediate</li>
              <li>No recovery from accidental deletes</li>
              <li>Compliance audits lack deletion trails</li>
              <li>User requests for recovery impossible</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Archivable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Soft delete with grace period</li>
              <li>Restore within configured window</li>
              <li>Full audit trail of archive/restore</li>
              <li>Compliance-friendly retention policies</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Fields Added by Archivable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>is_archived</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Boolean flag indicating archive state</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>archived_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Timestamp when archived (null if active)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>restored_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Timestamp of last restore (if any)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>archive_reason</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Optional reason for archiving (max 160 chars)</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Lifecycle Diagram</h3>
        <div style={{
          padding: '2rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          textAlign: 'center',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.9375rem',
          lineHeight: 2,
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <ActiveBadge />
            <span style={{ margin: '0 1rem', color: '#888' }}>──archive──▶</span>
            <ArchivedBadge />
            <span style={{ margin: '0 1rem', color: '#888' }}>──restore──▶</span>
            <ActiveBadge />
          </div>
          <div style={{ color: '#888', fontSize: '0.875rem' }}>
            │<br />
            ▼ (after grace period expires)
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <DeletedBadge />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. ARCHIVE STATES — Visual comparison
 * ───────────────────────────────────────────────────────────────────────────── */

function ArchiveStatesStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Archive States</h1>
      <h2 style={STYLES.subheading}>
        Visual comparison of active vs archived objects
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Active State */}
          <div>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#dcfce7',
              borderRadius: '0.5rem 0.5rem 0 0',
              borderBottom: '2px solid #22c55e',
            }}>
              <h3 style={{ margin: 0, color: '#166534', fontSize: '1rem' }}>Active Object</h3>
            </div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderTop: 'none',
              borderRadius: '0 0 0.5rem 0.5rem',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <ActiveBadge />
              </div>
              <div style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>is_archived:</span>
                  <code style={{ color: '#22c55e' }}>false</code>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>archived_at:</span>
                  <code style={{ color: '#888' }}>null</code>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>reason:</span>
                  <code style={{ color: '#888' }}>null</code>
                </div>
              </div>
              <div style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                background: '#f0fdf4',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#166534',
              }}>
                Fully visible and accessible to users
              </div>
            </div>
          </div>

          {/* Archived State */}
          <div>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              borderRadius: '0.5rem 0.5rem 0 0',
              borderBottom: '2px solid #9ca3af',
            }}>
              <h3 style={{ margin: 0, color: '#4b5563', fontSize: '1rem' }}>Archived Object</h3>
            </div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderTop: 'none',
              borderRadius: '0 0 0.5rem 0.5rem',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <ArchivedBadge />
              </div>
              <div style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>is_archived:</span>
                  <code style={{ color: '#dc2626' }}>true</code>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>archived_at:</span>
                  <code>{formatDate(SAMPLE_ARCHIVED_AT)}</code>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ color: '#888', width: '100px' }}>reason:</span>
                  <code>"Inactive for 90 days"</code>
                </div>
              </div>
              <div style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                background: '#fef3c7',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#92400e',
              }}>
                Hidden from default views, can be restored
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reason Examples */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Common Archive Reasons</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[
            { reason: 'User requested deletion', icon: '👤' },
            { reason: 'Inactive for 90 days', icon: '⏰' },
            { reason: 'Subscription canceled', icon: '💳' },
            { reason: 'Duplicate entry', icon: '📋' },
            { reason: 'Data migration cleanup', icon: '🔄' },
            { reason: 'GDPR erasure request', icon: '🔒' },
          ].map(({ reason, icon }) => (
            <div key={reason} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
            }}>
              <span style={{ fontSize: '1.25rem' }}>{icon}</span>
              <code style={{ fontSize: '0.875rem', color: '#374151' }}>"{reason}"</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. RETENTION POLICY — Timeline visualization
 * ───────────────────────────────────────────────────────────────────────────── */

function RetentionPolicyStory(): JSX.Element {
  const gracePeriodDays = 30;
  const restoreWindowDays = 30;

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Retention Policy</h1>
      <h2 style={STYLES.subheading}>
        Grace periods and restore windows
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Archivable uses <strong>retention policies</strong> to control how long archived
          objects can be restored before permanent deletion.
        </p>

        {/* Configuration Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>gracePeriodDays</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Days before permanent deletion (0-365)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>restoreWindowDays</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Days user can restore (≤ gracePeriodDays)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>retainHistory</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Keep archive/restore event log</span>
          </div>
        </div>
      </section>

      {/* Timeline Visualization */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Timeline Example: 30-Day Grace Period</div>
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          {/* Timeline bar */}
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <div style={{
              height: '8px',
              background: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: '70%',
                height: '100%',
                background: 'linear-gradient(to right, #22c55e, #22c55e 70%, #eab308 70%, #eab308)',
              }} />
            </div>

            {/* Markers */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '1rem',
              fontSize: '0.75rem',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#374151' }}>Archive Date</div>
                <div style={{ color: '#6b7280' }}>{formatDate(SAMPLE_ARCHIVED_AT)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#ca8a04' }}>Restore Window Closes</div>
                <div style={{ color: '#6b7280' }}>Day {restoreWindowDays}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, color: '#dc2626' }}>Permanent Deletion</div>
                <div style={{ color: '#6b7280' }}>Day {gracePeriodDays}</div>
              </div>
            </div>
          </div>

          {/* Zones explanation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{
              padding: '1rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '2px' }} />
                <strong style={{ color: '#166534', fontSize: '0.875rem' }}>Restore Window Open</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534' }}>
                User can restore the object at any time during this period.
              </p>
            </div>
            <div style={{
              padding: '1rem',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '2px' }} />
                <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>Admin-Only Restore</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                Only admins can restore. Countdown to permanent deletion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policy Examples */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Common Policy Configurations</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Standard (30/30)</h4>
            <pre style={{ ...STYLES.codeBlock, margin: 0, fontSize: '0.8125rem' }}>
{`gracePeriodDays: 30
restoreWindowDays: 30
retainHistory: true`}
            </pre>
            <p style={{ marginBottom: 0, marginTop: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
              Full user control for 30 days
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Compliance (90/30)</h4>
            <pre style={{ ...STYLES.codeBlock, margin: 0, fontSize: '0.8125rem' }}>
{`gracePeriodDays: 90
restoreWindowDays: 30
retainHistory: true`}
            </pre>
            <p style={{ marginBottom: 0, marginTop: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
              Extended retention for audits
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Immediate (0/0)</h4>
            <pre style={{ ...STYLES.codeBlock, margin: 0, fontSize: '0.8125rem' }}>
{`gracePeriodDays: 0
restoreWindowDays: 0
retainHistory: false`}
            </pre>
            <p style={{ marginBottom: 0, marginTop: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
              Hard delete (use sparingly)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Lifecycle mechanics
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        The archive/restore lifecycle step by step
      </h2>

      {/* Step 1: Archive Action */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 1: Archive Action</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          When an object is archived, the system sets the archive flag and timestamp:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Before archive
{
  id: "proj_abc123",
  name: "Old Project",
  is_archived: false,
  archived_at: null,
  archive_reason: null
}

// archive(id, reason)

// After archive
{
  id: "proj_abc123",
  name: "Old Project",
  is_archived: true,
  archived_at: "2024-12-01T10:30:00Z",
  archive_reason: "Inactive for 90 days"
}`}
        </pre>
      </section>

      {/* Step 2: Grace Period */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 2: Grace Period Countdown</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The object remains in the database but is hidden from default queries.
          A background job tracks the grace period:
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '1rem',
        }}>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>30</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Days Left</div>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#eab308' }}>15</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Days Left</div>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>3</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Days Left</div>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Query excludes archived by default
SELECT * FROM projects WHERE is_archived = false;

// Admin query includes archived
SELECT * FROM projects WHERE is_archived = true;`}
        </pre>
      </section>

      {/* Step 3: Restore Action */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 3: Restore Action (Optional)</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Within the restore window, the object can be restored to active status:
        </p>
        <pre style={STYLES.codeBlock}>
{`// restore(id)

// After restore
{
  id: "proj_abc123",
  name: "Old Project",
  is_archived: false,
  archived_at: null,
  restored_at: "2024-12-05T14:00:00Z",
  archive_reason: null
}

// History log (if retainHistory: true)
{
  event: "restored",
  timestamp: "2024-12-05T14:00:00Z",
  previous_archived_at: "2024-12-01T10:30:00Z",
  restored_by: "user_xyz"
}`}
        </pre>
      </section>

      {/* Step 4: Permanent Deletion */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 4: Permanent Deletion</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          After the grace period expires, the scheduled job permanently deletes the object:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Background job runs daily
SELECT id FROM projects
WHERE is_archived = true
  AND archived_at < NOW() - INTERVAL '30 days';

// For each expired object:
// 1. Log deletion event (if retainHistory)
// 2. CASCADE delete related records
// 3. Remove from database

DELETE FROM projects WHERE id = 'proj_abc123';`}
        </pre>
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '0.5rem',
        }}>
          <strong style={{ color: '#dc2626' }}>Warning:</strong>
          <span style={{ color: '#7f1d1d', marginLeft: '0.5rem' }}>
            Permanent deletion cannot be undone. Ensure grace periods are appropriate for your use case.
          </span>
        </div>
      </section>

      {/* Schema Summary */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Schema Fields Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>is_archived</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>BOOLEAN — Current state flag</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>archived_at</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>TIMESTAMP — When archived</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>restored_at</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>TIMESTAMP — Last restore</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>archive_reason</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>VARCHAR(160) — Deletion reason</span>
          </div>
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
  title: 'Traits/Lifecycle/Archivable',
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

// 2. Archive States — Visual comparison
export const ArchiveStates: Story = {
  name: '2. Archive States',
  render: () => <ArchiveStatesStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Retention Policy — Timeline
export const RetentionPolicy: Story = {
  name: '3. Retention Policy',
  render: () => <RetentionPolicyStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Lifecycle mechanics
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
