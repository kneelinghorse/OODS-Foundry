/**
 * Cancellable Trait — Cancellation Workflow Demo
 *
 * This story demonstrates the Cancellable trait which provides:
 * Cancellation workflows with policy guardrails and reason tracking.
 *
 * Unlike Archivable (simple soft delete), Cancellable supports complex
 * workflows: immediate vs period-end cancellation, reason collection,
 * and configurable policies.
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Cancellation Flow - Visual diagram of both cancellation paths
 * 3. Reason Picker - UI for collecting cancellation reasons
 * 4. How It Works - Policy checks and state transitions
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

function ActiveBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac',
    }}>
      <span style={{ fontSize: '0.875rem' }}>●</span>
      Active
    </span>
  );
}

function PendingCancellationBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fcd34d',
    }}>
      <span style={{ fontSize: '0.875rem' }}>◐</span>
      Pending Cancellation
    </span>
  );
}

function CanceledBadge(): JSX.Element {
  return (
    <span style={{
      ...STYLES.badge,
      background: '#f3f4f6',
      color: '#6b7280',
      border: '1px solid #d1d5db',
    }}>
      <span style={{ fontSize: '0.875rem' }}>○</span>
      Canceled
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const CANCELLATION_REASONS = [
  { code: 'too_expensive', label: 'Too expensive', icon: '💰' },
  { code: 'missing_features', label: 'Missing features I need', icon: '🔧' },
  { code: 'switching_competitor', label: 'Switching to a competitor', icon: '🔄' },
  { code: 'no_longer_needed', label: 'No longer needed', icon: '✓' },
  { code: 'technical_issues', label: 'Technical issues', icon: '⚠️' },
  { code: 'other', label: 'Other', icon: '💬' },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Cancellable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Cancellable</h1>
      <h2 style={STYLES.subheading}>
        Cancellation workflows with policy guardrails and reason tracking
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Cancellable adds <strong>structured cancellation workflows</strong> to objects.
          Configure policies for when cancellation is allowed, collect reasons for
          retention analytics, and choose between immediate or period-end execution.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Cancellable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Inconsistent cancellation UX</li>
              <li>No retention data collection</li>
              <li>Immediate cancellation only</li>
              <li>No policy enforcement</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Cancellable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Consistent cancellation flow</li>
              <li>Structured reason collection</li>
              <li>Immediate or period-end options</li>
              <li>Configurable policy guardrails</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Cancellable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>cancel_at_period_end</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Wait for billing period to end?</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>cancellation_reason</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Free-form explanation</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>cancellation_reason_code</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Structured code for analytics</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>cancellation_requested_at</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>When cancellation was initiated</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Subscription', 'Reservation', 'Order', 'Appointment'].map((obj) => (
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
        <h3 style={{ marginBottom: '1rem' }}>Business Value</h3>
        <div style={{
          padding: '1.5rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '0.75rem',
        }}>
          <p style={{ margin: 0, color: '#166534', lineHeight: 1.7 }}>
            <strong>Retention Analytics:</strong> Cancellation reasons provide valuable data
            for reducing churn. Know why customers leave to improve your product and reduce
            future cancellations.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. CANCELLATION FLOW — Visual diagram
 * ───────────────────────────────────────────────────────────────────────────── */

function CancellationFlowStory(): JSX.Element {
  const [selectedPath, setSelectedPath] = useState<'period_end' | 'immediate'>('period_end');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Cancellation Flow</h1>
      <h2 style={STYLES.subheading}>
        Two paths: immediate vs end-of-period cancellation
      </h2>

      <section style={STYLES.section}>
        {/* Flow Diagram */}
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          marginBottom: '2rem',
        }}>
          <div style={STYLES.groupLabel}>Cancellation Flow Diagram</div>

          {/* Start state */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <ActiveBadge />
          </div>

          {/* Arrow down */}
          <div style={{ textAlign: 'center', marginBottom: '1rem', color: '#888' }}>
            │<br />
            ▼ User requests cancellation
          </div>

          {/* Two paths */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Period End Path */}
            <div style={{
              padding: '1.5rem',
              background: selectedPath === 'period_end' ? '#fef3c7' : '#f9fafb',
              border: selectedPath === 'period_end' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => setSelectedPath('period_end')}>
              <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#92400e' }}>
                Cancel at Period End
              </h4>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <PendingCancellationBadge />
              </div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#555' }}>
                Service continues until current billing period ends. Customer retains access.
              </p>
              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.875rem' }}>
                │<br />
                ▼ Period ends<br />
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <CanceledBadge />
              </div>
            </div>

            {/* Immediate Path */}
            <div style={{
              padding: '1.5rem',
              background: selectedPath === 'immediate' ? '#fef2f2' : '#f9fafb',
              border: selectedPath === 'immediate' ? '2px solid #ef4444' : '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => setSelectedPath('immediate')}>
              <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#dc2626' }}>
                Cancel Immediately
              </h4>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <CanceledBadge />
              </div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#555' }}>
                Service ends right away. May trigger prorated refund depending on policy.
              </p>
              <div style={{
                padding: '0.75rem',
                background: '#fff',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                color: '#6b7280',
                textAlign: 'center',
              }}>
                No intermediate state
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Toggle UI */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>The Period-End Toggle</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          maxWidth: '400px',
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedPath === 'period_end'}
                onChange={(e) => setSelectedPath(e.target.checked ? 'period_end' : 'immediate')}
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
              <span style={{ fontWeight: 500 }}>Cancel at end of billing period</span>
            </label>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {selectedPath === 'period_end'
              ? 'Your subscription will remain active until January 15, 2025.'
              : 'Your subscription will be canceled immediately.'}
          </p>
        </div>
      </section>

      {/* Timestamp display */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Cancellation Timestamps</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
              cancellation_requested_at
            </code>
            <span style={{ color: '#374151', fontSize: '0.9375rem' }}>Dec 3, 2024 at 2:30 PM</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              When user initiated cancellation
            </div>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
              canceled_at
            </code>
            <span style={{ color: '#374151', fontSize: '0.9375rem' }}>
              {selectedPath === 'period_end' ? 'Jan 15, 2025 (scheduled)' : 'Dec 3, 2024 at 2:30 PM'}
            </span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              When cancellation takes effect
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. REASON PICKER — UI for collecting reasons
 * ───────────────────────────────────────────────────────────────────────────── */

function ReasonPickerStory(): JSX.Element {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherText, setOtherText] = useState('');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Reason Picker</h1>
      <h2 style={STYLES.subheading}>
        Collecting structured cancellation reasons for retention analytics
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Reason Picker UI */}
          <div>
            <div style={STYLES.groupLabel}>Cancellation Form</div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.125rem' }}>
                Why are you canceling?
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: selectedReason === reason.code ? '#eff6ff' : '#f9fafb',
                      border: selectedReason === reason.code ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.code}
                      checked={selectedReason === reason.code}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      style={{ width: '1rem', height: '1rem' }}
                    />
                    <span style={{ fontSize: '1rem' }}>{reason.icon}</span>
                    <span style={{ fontWeight: selectedReason === reason.code ? 500 : 400 }}>
                      {reason.label}
                    </span>
                  </label>
                ))}
              </div>

              {selectedReason === 'other' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <textarea
                    placeholder="Please tell us more..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '0.5rem',
                      fontSize: '0.9375rem',
                      resize: 'vertical',
                      minHeight: '80px',
                    }}
                  />
                </div>
              )}

              <button style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: selectedReason ? '#dc2626' : '#e5e7eb',
                color: selectedReason ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: selectedReason ? 'pointer' : 'not-allowed',
              }}>
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div>
            <div style={STYLES.groupLabel}>Policy Configuration</div>
            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                requireReason: true
              </code>
              <span style={{ color: '#666', fontSize: '0.875rem' }}>
                User must select a reason before canceling
              </span>
            </div>

            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                allowedReasons
              </code>
              <pre style={{ ...STYLES.codeBlock, margin: 0, fontSize: '0.75rem' }}>
{`[
  "too_expensive",
  "missing_features",
  "switching_competitor",
  "no_longer_needed",
  "technical_issues",
  "other"
]`}
              </pre>
            </div>

            <div style={STYLES.groupLabel}>Data Captured</div>
            <pre style={STYLES.codeBlock}>
{`{
  cancellation_reason_code: "${selectedReason || 'null'}",
  cancellation_reason: "${selectedReason === 'other' ? otherText || '(free text)' : CANCELLATION_REASONS.find(r => r.code === selectedReason)?.label || 'null'}"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Analytics Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Retention Analytics Dashboard</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Top Cancellation Reasons (Last 30 Days)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { code: 'too_expensive', count: 42, percent: 35 },
              { code: 'missing_features', count: 28, percent: 23 },
              { code: 'no_longer_needed', count: 24, percent: 20 },
              { code: 'switching_competitor', count: 16, percent: 13 },
              { code: 'other', count: 11, percent: 9 },
            ].map((stat) => {
              const reason = CANCELLATION_REASONS.find(r => r.code === stat.code);
              return (
                <div key={stat.code} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: '1.5rem' }}>{reason?.icon}</span>
                  <span style={{ width: '180px', fontSize: '0.875rem' }}>{reason?.label}</span>
                  <div style={{ flex: 1, height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${stat.percent}%`,
                      height: '100%',
                      background: '#3b82f6',
                      borderRadius: '4px',
                    }} />
                  </div>
                  <span style={{ width: '60px', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
                    {stat.count} ({stat.percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Policy checks and state transitions
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Policy checks and state transitions
      </h2>

      {/* Step 1 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 1: User Initiates Cancellation</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          User clicks "Cancel Subscription" in account settings:
        </p>
        <pre style={STYLES.codeBlock}>
{`// API call
POST /subscriptions/sub_abc123/cancel
{
  cancel_at_period_end: true,
  reason_code: "too_expensive",
  reason: "Budget constraints this quarter"
}`}
        </pre>
      </section>

      {/* Step 2 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 2: Policy Check</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The system validates the request against configured policies:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontSize: '0.8125rem' }}>
              allowCancellationAfterStart
            </code>
            <span style={{ fontSize: '0.875rem', color: '#166534' }}>✓ true</span>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontSize: '0.8125rem' }}>
              cancellationWindowHours
            </code>
            <span style={{ fontSize: '0.875rem', color: '#166534' }}>✓ null (no limit)</span>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontSize: '0.8125rem' }}>
              requireReason
            </code>
            <span style={{ fontSize: '0.875rem', color: '#166534' }}>✓ reason provided</span>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Policy validation
if (!policy.allowCancellationAfterStart && subscription.started) {
  throw new PolicyViolation("Cancellation not allowed after start");
}

if (policy.cancellationWindowHours) {
  const hoursElapsed = (now - subscription.created_at) / 3600000;
  if (hoursElapsed > policy.cancellationWindowHours) {
    throw new PolicyViolation("Cancellation window has closed");
  }
}

if (policy.requireReason && !request.reason_code) {
  throw new ValidationError("Reason is required");
}`}
        </pre>
      </section>

      {/* Step 3 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 3: State Transition</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Based on <code>cancel_at_period_end</code>, the subscription transitions:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Period End = true</strong>
            <code style={{ fontSize: '0.8125rem' }}>status: "active" → "pending_cancellation"</code>
          </div>
          <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Period End = false</strong>
            <code style={{ fontSize: '0.8125rem' }}>status: "active" → "canceled"</code>
          </div>
        </div>
      </section>

      {/* Step 4 */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Step 4: Record Updated</div>
        <pre style={STYLES.codeBlock}>
{`// After cancellation request
{
  subscription_id: "sub_abc123",
  status: "pending_cancellation",
  cancel_at_period_end: true,
  cancellation_requested_at: "2024-12-03T14:30:00Z",
  cancellation_reason_code: "too_expensive",
  cancellation_reason: "Budget constraints this quarter",
  current_period_end: "2025-01-15T00:00:00Z"  // When it will cancel
}

// After period ends (scheduled job)
{
  status: "canceled",
  canceled_at: "2025-01-15T00:00:00Z"
}`}
        </pre>
      </section>

      {/* Schema Summary */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Complete Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Cancellable trait fields
{
  // State
  cancel_at_period_end: boolean,       // Wait for period end?
  cancellation_requested_at: timestamp, // When user initiated

  // Reason (for retention analytics)
  cancellation_reason_code: string,    // Structured code
  cancellation_reason: string,         // Free-form text

  // Result
  canceled_at: timestamp               // When cancellation took effect
}

// Trait parameters (configure at domain level)
{
  allowCancellationAfterStart: true,   // Can cancel after service starts?
  cancellationWindowHours: null,       // Time limit for cancellation (null = no limit)
  requireReason: true,                 // Must provide reason?
  allowedReasons: [                    // Valid reason codes
    "too_expensive",
    "missing_features",
    "switching_competitor",
    "no_longer_needed",
    "technical_issues",
    "other"
  ]
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
  title: 'Traits/Lifecycle/Cancellable',
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

// 2. Cancellation Flow — Visual diagram
export const CancellationFlow: Story = {
  name: '2. Cancellation Flow',
  render: () => <CancellationFlowStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Reason Picker — Form UI
export const ReasonPicker: Story = {
  name: '3. Reason Picker',
  render: () => <ReasonPickerStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Policy and mechanics
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
