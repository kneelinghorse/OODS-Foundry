/**
 * Metered Trait — Usage-Based Billing Demo
 *
 * This story demonstrates the Metered trait which provides:
 * Usage tracking, meter aggregation, and overage handling for usage-based billing.
 *
 * Metered complements Billable (pricing/plans) and Payable (payment processing)
 * by tracking consumption:
 * - Usage event ingestion
 * - Meter aggregation by period
 * - Threshold alerts and overage calculation
 * - Invoice line item generation
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Meter Types - Different usage meter categories
 * 3. Usage Dashboard - Real-time usage visualization
 * 4. Aggregation - Rollup pipeline from events to billing
 * 5. How It Works - Schema fields and performance considerations
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
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const METER_TYPES = [
  { id: 'api_calls', label: 'API Calls', unit: 'calls', icon: '🔌', color: '#3b82f6' },
  { id: 'storage_bytes', label: 'Storage', unit: 'GB', icon: '💾', color: '#8b5cf6' },
  { id: 'compute_minutes', label: 'Compute', unit: 'minutes', icon: '⚡', color: '#f59e0b' },
  { id: 'bandwidth_gb', label: 'Bandwidth', unit: 'GB', icon: '📡', color: '#10b981' },
  { id: 'active_users', label: 'Active Users', unit: 'MAU', icon: '👥', color: '#ec4899' },
  { id: 'messages_sent', label: 'Messages', unit: 'messages', icon: '💬', color: '#06b6d4' },
  { id: 'seats', label: 'Seats', unit: 'licenses', icon: '🪑', color: '#6366f1' },
  { id: 'records', label: 'Records', unit: 'records', icon: '📊', color: '#84cc16' },
];

const USAGE_EVENTS = [
  { meter: 'api_calls', value: 1523, timestamp: '2025-12-04T10:00:00Z' },
  { meter: 'api_calls', value: 2104, timestamp: '2025-12-04T11:00:00Z' },
  { meter: 'api_calls', value: 1876, timestamp: '2025-12-04T12:00:00Z' },
  { meter: 'storage_bytes', value: 1024000000, timestamp: '2025-12-04T10:00:00Z' },
  { meter: 'bandwidth_gb', value: 5.2, timestamp: '2025-12-04T10:00:00Z' },
];

const USAGE_SUMMARY = {
  api_calls: { used: 8500, limit: 10000, unit: 'calls', rate: 0.001 },
  storage: { used: 4.2, limit: 10, unit: 'GB', rate: 0.10 },
  bandwidth: { used: 45, limit: 100, unit: 'GB', rate: 0.05 },
  compute: { used: 120, limit: 200, unit: 'min', rate: 0.02 },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Components
 * ───────────────────────────────────────────────────────────────────────────── */

function UsageGauge({
  used,
  limit,
  unit,
  label,
  color = '#3b82f6'
}: {
  used: number;
  limit: number;
  unit: string;
  label: string;
  color?: string;
}): JSX.Element {
  const percent = Math.min((used / limit) * 100, 100);
  const isWarning = percent >= 80;
  const isOver = percent >= 100;

  return (
    <div style={{
      padding: '1rem',
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.875rem', color: isOver ? '#dc2626' : isWarning ? '#f59e0b' : '#6b7280' }}>
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div style={{
        height: '8px',
        background: '#f3f4f6',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          background: isOver ? '#dc2626' : isWarning ? '#f59e0b' : color,
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      {isWarning && !isOver && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>
          Approaching limit ({percent.toFixed(0)}% used)
        </div>
      )}
      {isOver && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#dc2626' }}>
          Limit exceeded - overage charges apply
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Metered?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Metered</h1>
      <h2 style={STYLES.subheading}>
        Usage-based billing with meter aggregation and overage handling
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Metered enables <strong>usage-based billing</strong> by tracking consumption events,
          aggregating them into billing periods, and calculating overages. Essential for
          API products, cloud services, and any pay-per-use business model.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Metered
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Manual usage tracking across services</li>
              <li>Billing discrepancies from missed events</li>
              <li>No real-time usage visibility</li>
              <li>Complex overage calculations</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Metered
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Automated event ingestion pipeline</li>
              <li>Real-time usage aggregation</li>
              <li>Threshold alerts before limits</li>
              <li>Automatic invoice line items</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Metered</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>usage_events</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Raw usage event stream</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>usage_aggregates</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Rolled-up usage by period</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>current_usage</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Real-time usage counter</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>usage_limits</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Configured thresholds</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Subscription', 'API Key', 'Resource', 'Tenant'].map((obj) => (
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

      {/* Quick Preview */}
      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Usage at a Glance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <UsageGauge used={8500} limit={10000} unit="calls" label="API Calls" color="#3b82f6" />
          <UsageGauge used={4.2} limit={10} unit="GB" label="Storage" color="#8b5cf6" />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. METER TYPES — Different usage meter categories
 * ───────────────────────────────────────────────────────────────────────────── */

function MeterTypesStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Meter Types</h1>
      <h2 style={STYLES.subheading}>
        Common usage meters for SaaS and API products
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Available Meter Types</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {METER_TYPES.map((meter) => (
            <div key={meter.id} style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: `${meter.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                margin: '0 auto 0.75rem',
              }}>
                {meter.icon}
              </div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{meter.label}</div>
              <code style={{ fontSize: '0.75rem', color: '#6b7280' }}>{meter.id}</code>
              <div style={{
                marginTop: '0.5rem',
                padding: '0.25rem 0.5rem',
                background: '#f3f4f6',
                borderRadius: '0.25rem',
                fontSize: '0.6875rem',
                color: '#374151',
              }}>
                Unit: {meter.unit}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Unit Formatting */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Unit Formatting Examples</div>
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Meter</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Raw Value</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Formatted</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>api_calls</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>15234</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>15,234 calls</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>$0.001/call</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>storage_bytes</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>5368709120</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>5.0 GB</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>$0.10/GB</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>compute_minutes</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>4567</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>76.1 hours</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>$0.02/min</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem' }}>active_users</td>
                <td style={{ padding: '1rem', fontFamily: 'monospace' }}>1523</td>
                <td style={{ padding: '1rem' }}>1,523 MAU</td>
                <td style={{ padding: '1rem' }}>$5.00/100 MAU</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Meter Configuration */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Meter Configuration</div>
        <pre style={STYLES.codeBlock}>
{`// Define meters for a subscription plan
{
  meters: [
    {
      id: "api_calls",
      displayName: "API Calls",
      unit: "calls",
      aggregation: "sum",           // sum, max, avg, last
      includedQuantity: 10000,      // Included in base plan
      overageRateMinor: 1,          // $0.01 per 10 calls
      overageUnit: 10               // Charged per 10 calls
    },
    {
      id: "storage_bytes",
      displayName: "Storage",
      unit: "bytes",
      formatUnit: "GB",             // Display in GB
      aggregation: "max",           // Peak usage
      includedQuantity: 10737418240, // 10 GB
      overageRateMinor: 10          // $0.10 per GB
    }
  ]
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. USAGE DASHBOARD — Real-time usage visualization
 * ───────────────────────────────────────────────────────────────────────────── */

function UsageDashboardStory(): JSX.Element {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Simulated daily usage data for chart
  const dailyUsage = [
    { day: 'Mon', calls: 1200 },
    { day: 'Tue', calls: 1850 },
    { day: 'Wed', calls: 2300 },
    { day: 'Thu', calls: 1950 },
    { day: 'Fri', calls: 2100 },
    { day: 'Sat', calls: 800 },
    { day: 'Sun', calls: 300 },
  ];
  const maxUsage = Math.max(...dailyUsage.map(d => d.calls));

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Usage Dashboard</h1>
      <h2 style={STYLES.subheading}>
        Real-time monitoring with threshold alerts
      </h2>

      {/* Period Selector */}
      <section style={STYLES.section}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedPeriod === period ? '#3b82f6' : '#fff',
                color: selectedPeriod === period ? '#fff' : '#374151',
                border: selectedPeriod === period ? 'none' : '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {Object.entries(USAGE_SUMMARY).map(([key, data]) => (
            <div key={key} style={{
              padding: '1.25rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {key.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
                {data.used.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                of {data.limit.toLocaleString()} {data.unit}
              </div>
              <div style={{
                marginTop: '0.75rem',
                height: '4px',
                background: '#f3f4f6',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min((data.used / data.limit) * 100, 100)}%`,
                  height: '100%',
                  background: data.used >= data.limit ? '#dc2626' : data.used >= data.limit * 0.8 ? '#f59e0b' : '#3b82f6',
                }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Chart */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>API Calls - Last 7 Days</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '200px' }}>
            {dailyUsage.map((day) => (
              <div key={day.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  height: `${(day.calls / maxUsage) * 160}px`,
                  background: 'linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: '4px',
                }} />
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>{day.day}</div>
                <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{day.calls.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Threshold Alerts */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Active Alerts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            padding: '1rem 1.25rem',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <span style={{ fontSize: '1.25rem' }}>!</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#92400e' }}>API Calls at 85%</div>
              <div style={{ fontSize: '0.875rem', color: '#a16207' }}>
                8,500 of 10,000 calls used. Consider upgrading your plan.
              </div>
            </div>
            <button style={{
              padding: '0.5rem 1rem',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Upgrade
            </button>
          </div>
        </div>
      </section>

      {/* Overage Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Projected Overage</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 500 }}>If current usage continues:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>+$12.50</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Estimated 2,500 additional API calls at $0.005/call overage rate.
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. AGGREGATION — Rollup pipeline from events to billing
 * ───────────────────────────────────────────────────────────────────────────── */

function AggregationStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Aggregation</h1>
      <h2 style={STYLES.subheading}>
        From raw events to invoice line items
      </h2>

      {/* Pipeline Diagram */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Aggregation Pipeline</div>
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Raw Events */}
            <div style={{
              flex: 1,
              padding: '1rem',
              background: '#eff6ff',
              border: '2px solid #3b82f6',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
              <div style={{ fontWeight: 600, color: '#1e40af' }}>Raw Events</div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                Per-second ingestion
              </div>
            </div>

            <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>→</div>

            {/* Daily Aggregates */}
            <div style={{
              flex: 1,
              padding: '1rem',
              background: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📈</div>
              <div style={{ fontWeight: 600, color: '#166534' }}>Daily Rollup</div>
              <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.25rem' }}>
                Sum by meter + day
              </div>
            </div>

            <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>→</div>

            {/* Billing Period */}
            <div style={{
              flex: 1,
              padding: '1rem',
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
              <div style={{ fontWeight: 600, color: '#92400e' }}>Period Total</div>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                Monthly aggregate
              </div>
            </div>

            <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>→</div>

            {/* Invoice Line */}
            <div style={{
              flex: 1,
              padding: '1rem',
              background: '#f3e8ff',
              border: '2px solid #a855f7',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🧾</div>
              <div style={{ fontWeight: 600, color: '#7e22ce' }}>Invoice Line</div>
              <div style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: '0.25rem' }}>
                Apply rate card
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aggregation Periods */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Aggregation Periods</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { period: 'hourly', desc: 'Real-time dashboards', retention: '7 days' },
            { period: 'daily', desc: 'Usage reports', retention: '90 days' },
            { period: 'weekly', desc: 'Trend analysis', retention: '1 year' },
            { period: 'billing_period', desc: 'Invoice generation', retention: 'Forever' },
          ].map((p) => (
            <div key={p.period} style={{
              padding: '1.25rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                {p.period.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.5rem' }}>{p.desc}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Retention: {p.retention}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Invoice Line Items */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Generated Invoice Line Items</div>
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Description</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Quantity</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Rate</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>Pro Plan - Monthly</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>1</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>$99.00</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>$99.00</td>
              </tr>
              <tr style={{ background: '#f0fdf4' }}>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                  API Calls (included: 10,000)
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>10,000</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>—</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#16a34a' }}>$0.00</td>
              </tr>
              <tr style={{ background: '#fef3c7' }}>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                  API Calls - Overage
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>2,500</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>$0.005</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: '#92400e' }}>$12.50</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Total</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, fontSize: '1.125rem' }}>$111.50</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. HOW IT WORKS — Schema and performance considerations
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Event schema, aggregation pipeline, and performance
      </h2>

      {/* Usage Event Schema */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Usage Event Schema</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Each usage event captures a single consumption instance with minimal overhead:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Usage event structure
{
  event_id: "evt_abc123",           // Unique event ID
  subscription_id: "sub_xyz789",    // Parent subscription
  meter_name: "api_calls",          // Which meter
  quantity: 1,                      // Amount consumed
  timestamp: "2025-12-04T10:00:00Z", // When it occurred
  source: "api_gateway",            // Event source
  metadata: {                       // Optional context
    endpoint: "/api/v1/users",
    region: "us-east-1",
    status_code: 200
  },
  idempotency_key: "req_abc123"     // Deduplication key
}`}
        </pre>
      </section>

      {/* Aggregation Pipeline */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Aggregation Pipeline</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Events are aggregated at multiple granularities for different use cases:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Daily aggregate (computed from events)
{
  aggregate_id: "agg_daily_20251204",
  subscription_id: "sub_xyz789",
  meter_name: "api_calls",
  period: "daily",
  period_start: "2025-12-04T00:00:00Z",
  period_end: "2025-12-05T00:00:00Z",

  // Aggregated values
  total_quantity: 15234,
  event_count: 892,
  min_quantity: 1,
  max_quantity: 150,
  avg_quantity: 17.08,

  computed_at: "2025-12-04T23:59:00Z"
}

// Billing period aggregate (for invoicing)
{
  aggregate_id: "agg_billing_202512",
  period: "billing",
  total_quantity: 125000,
  included_quantity: 100000,
  overage_quantity: 25000,
  overage_amount_minor: 12500  // $125.00
}`}
        </pre>
      </section>

      {/* Threshold Alerting */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Threshold Alerting</div>
        <pre style={STYLES.codeBlock}>
{`// Alert configuration
{
  thresholds: [
    {
      meter: "api_calls",
      level: "warning",
      percent: 80,                  // 80% of limit
      notification: ["email", "slack"]
    },
    {
      meter: "api_calls",
      level: "critical",
      percent: 100,                 // At limit
      notification: ["email", "slack", "pagerduty"]
    }
  ],

  // Projected overage alerts
  projection: {
    enabled: true,
    lookbackDays: 7,                // Use last 7 days
    alertDaysBeforeEnd: 5          // Alert 5 days before period end
  }
}`}
        </pre>
      </section>

      {/* Performance Considerations */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Performance Considerations</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Event Ingestion</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>Async queue processing</li>
              <li>Batch inserts (1000 events/batch)</li>
              <li>Idempotency key deduplication</li>
            </ul>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Query Optimization</h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>Read from aggregates, not events</li>
              <li>Time-series partitioning</li>
              <li>Materialized views for dashboards</li>
            </ul>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Ingestion rate limits
{
  maxEventsPerSecond: 10000,        // Per tenant
  batchSize: 1000,                  // Events per insert
  retentionDays: {
    raw_events: 30,                 // 30 days hot storage
    daily_aggregates: 365,          // 1 year
    billing_aggregates: "forever"   // Never deleted
  }
}`}
        </pre>
      </section>

      {/* Complete Schema */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Complete Trait Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Metered trait fields
{
  // Meter Configuration
  meters: Meter[],                   // Configured meters

  // Current Period Usage
  current_usage: {
    [meter_name]: {
      consumed: number,              // Current consumption
      included: number,              // Included in plan
      remaining: number,             // Available before overage
      projected_end: number          // Projected end-of-period
    }
  },

  // Limits & Alerts
  usage_limits: {
    [meter_name]: number            // Configured limits
  },
  alert_thresholds: ThresholdConfig[],

  // Billing
  overage_rate_minor: number,        // Price per overage unit
  overage_unit: number,              // Units per overage charge
  rollover_strategy: "none" | "credits" | "unlimited"
}

// Meter definition
interface Meter {
  id: string;
  displayName: string;
  unit: string;
  aggregation: "sum" | "max" | "avg" | "last";
  includedQuantity: number;
  overageRateMinor: number;
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
  title: 'Traits/Domain/Metered',
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

// 2. Meter Types — Different meter categories
export const MeterTypes: Story = {
  name: '2. Meter Types',
  render: () => <MeterTypesStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Usage Dashboard — Real-time monitoring
export const UsageDashboard: Story = {
  name: '3. Usage Dashboard',
  render: () => <UsageDashboardStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. Aggregation — Event rollup pipeline
export const Aggregation: Story = {
  name: '4. Aggregation',
  render: () => <AggregationStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 5. How It Works — Schema and mechanics
export const HowItWorks: Story = {
  name: '5. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
