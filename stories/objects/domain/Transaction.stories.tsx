/**
 * Transaction Object — Financial Transaction Demo
 *
 * Transaction represents a financial transaction and demonstrates how traits
 * compose into a complete domain object:
 * - Timestampable: Created/updated timestamps, transaction timing
 * - Payable: Payment method, amount, currency
 * - Refundable: Refund eligibility and processing
 * - Stateful: Transaction lifecycle (initiated -> processing -> completed/failed)
 *
 * Stories:
 * 1. Overview - What is a Transaction object?
 * 2. Transaction Detail - Full transaction view with parties and metadata
 * 3. Transaction Timeline - Visual lifecycle of a transaction
 * 4. Refund Flow - Refund eligibility and processing demonstration
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants
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
 * Type definitions
 * ───────────────────────────────────────────────────────────────────────────── */

type TransactionStatus = 'initiated' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
type PaymentMethod = 'card' | 'bank_transfer' | 'wallet';

interface TransactionParty {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'merchant';
}

interface TransactionEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, string>;
}

interface Transaction {
  id: string;
  reference: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_method_last4?: string;
  from: TransactionParty;
  to: TransactionParty;
  description: string;
  refund_amount?: number;
  refund_eligible: boolean;
  refund_deadline?: string;
  events: TransactionEvent[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_TRANSACTION: Transaction = {
  id: 'txn_abc123xyz',
  reference: 'INV-2024-001234',
  status: 'completed',
  amount: 15900,
  currency: 'USD',
  payment_method: 'card',
  payment_method_last4: '4242',
  from: {
    id: 'cust_jane',
    name: 'Jane Cooper',
    email: 'jane@example.com',
    type: 'customer',
  },
  to: {
    id: 'merchant_acme',
    name: 'Acme Corporation',
    email: 'billing@acme.com',
    type: 'merchant',
  },
  description: 'Professional Plan - Monthly Subscription',
  refund_eligible: true,
  refund_deadline: '2025-01-15T00:00:00Z',
  events: [
    {
      id: 'evt_1',
      type: 'transaction.initiated',
      timestamp: '2024-12-15T10:30:00Z',
      description: 'Payment initiated',
    },
    {
      id: 'evt_2',
      type: 'transaction.processing',
      timestamp: '2024-12-15T10:30:02Z',
      description: 'Sent to payment processor',
      metadata: { processor: 'stripe', processor_id: 'pi_123abc' },
    },
    {
      id: 'evt_3',
      type: 'transaction.completed',
      timestamp: '2024-12-15T10:30:05Z',
      description: 'Payment successful',
      metadata: { auth_code: 'A12345' },
    },
  ],
  created_at: '2024-12-15T10:30:00Z',
  updated_at: '2024-12-15T10:30:05Z',
  completed_at: '2024-12-15T10:30:05Z',
};

const FAILED_TRANSACTION: Transaction = {
  id: 'txn_failed789',
  reference: 'INV-2024-001235',
  status: 'failed',
  amount: 29900,
  currency: 'USD',
  payment_method: 'card',
  payment_method_last4: '1234',
  from: {
    id: 'cust_bob',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    type: 'customer',
  },
  to: {
    id: 'merchant_acme',
    name: 'Acme Corporation',
    email: 'billing@acme.com',
    type: 'merchant',
  },
  description: 'Enterprise Plan - Annual Subscription',
  refund_eligible: false,
  events: [
    {
      id: 'evt_1',
      type: 'transaction.initiated',
      timestamp: '2024-12-15T14:20:00Z',
      description: 'Payment initiated',
    },
    {
      id: 'evt_2',
      type: 'transaction.processing',
      timestamp: '2024-12-15T14:20:02Z',
      description: 'Sent to payment processor',
    },
    {
      id: 'evt_3',
      type: 'transaction.failed',
      timestamp: '2024-12-15T14:20:04Z',
      description: 'Card declined - Insufficient funds',
      metadata: { decline_code: 'insufficient_funds' },
    },
  ],
  created_at: '2024-12-15T14:20:00Z',
  updated_at: '2024-12-15T14:20:04Z',
};

const REFUNDED_TRANSACTION: Transaction = {
  id: 'txn_refund456',
  reference: 'INV-2024-001200',
  status: 'refunded',
  amount: 9900,
  currency: 'USD',
  payment_method: 'card',
  payment_method_last4: '5555',
  refund_amount: 9900,
  from: {
    id: 'cust_alice',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    type: 'customer',
  },
  to: {
    id: 'merchant_acme',
    name: 'Acme Corporation',
    email: 'billing@acme.com',
    type: 'merchant',
  },
  description: 'Starter Plan - Monthly Subscription',
  refund_eligible: false,
  events: [
    {
      id: 'evt_1',
      type: 'transaction.initiated',
      timestamp: '2024-12-01T09:00:00Z',
      description: 'Payment initiated',
    },
    {
      id: 'evt_2',
      type: 'transaction.completed',
      timestamp: '2024-12-01T09:00:03Z',
      description: 'Payment successful',
    },
    {
      id: 'evt_3',
      type: 'refund.requested',
      timestamp: '2024-12-10T15:30:00Z',
      description: 'Refund requested by customer',
      metadata: { reason: 'customer_request' },
    },
    {
      id: 'evt_4',
      type: 'refund.processed',
      timestamp: '2024-12-10T15:30:02Z',
      description: 'Full refund processed',
    },
  ],
  created_at: '2024-12-01T09:00:00Z',
  updated_at: '2024-12-10T15:30:02Z',
  completed_at: '2024-12-01T09:00:03Z',
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Status Badge Component
 * ───────────────────────────────────────────────────────────────────────────── */

function TransactionStatusBadge({ status }: { status: TransactionStatus }): JSX.Element {
  const configs: Record<TransactionStatus, { bg: string; color: string; border: string; icon: string }> = {
    initiated: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '○' },
    processing: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '◐' },
    completed: { bg: '#dcfce7', color: '#166534', border: '#86efac', icon: '●' },
    failed: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', icon: '!' },
    refunded: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '<-' },
    partially_refunded: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '<-' },
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
      {status.replace('_', ' ')}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is a Transaction object?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Transaction</h1>
      <h2 style={STYLES.subheading}>
        Financial transaction with payment processing and refund handling
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          A <strong>Transaction</strong> represents a financial movement between parties.
          It tracks the full lifecycle from initiation through completion (or failure),
          with support for refunds and a complete audit trail.
        </p>

        {/* Composed Traits */}
        <div style={STYLES.groupLabel}>Composed Traits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0891b2' }}>Timestampable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>created_at, updated_at, completed_at</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed' }}>Payable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>amount, currency, payment_method</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#dc2626' }}>Refundable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>refund_eligible, refund_amount</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>Stateful</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>initiated, processing, completed, failed</span>
          </div>
        </div>
      </section>

      {/* Transaction States */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Transaction States</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <TransactionStatusBadge status="initiated" />
          <TransactionStatusBadge status="processing" />
          <TransactionStatusBadge status="completed" />
          <TransactionStatusBadge status="failed" />
          <TransactionStatusBadge status="refunded" />
          <TransactionStatusBadge status="partially_refunded" />
        </div>
      </section>

      {/* Schema Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Schema Structure</div>
        <pre style={STYLES.codeBlock}>
{`{
  // Identity
  id: "txn_abc123xyz",
  reference: "INV-2024-001234",

  // Stateful trait
  status: "completed",

  // Payable trait
  amount: 15900,           // $159.00 in minor units
  currency: "USD",
  payment_method: "card",
  payment_method_last4: "4242",

  // Parties
  from: { id: "cust_jane", name: "Jane Cooper", ... },
  to: { id: "merchant_acme", name: "Acme Corp", ... },

  // Refundable trait
  refund_eligible: true,
  refund_deadline: "2025-01-15T00:00:00Z",

  // Timestampable trait
  created_at: "2024-12-15T10:30:00Z",
  completed_at: "2024-12-15T10:30:05Z",

  // Audit trail
  events: [...]
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. TRANSACTION DETAIL — Full transaction view
 * ───────────────────────────────────────────────────────────────────────────── */

function TransactionDetailCard({ transaction }: { transaction: Transaction }): JSX.Element {
  const paymentMethodIcons: Record<PaymentMethod, string> = {
    card: 'Credit Card',
    bank_transfer: 'Bank Transfer',
    wallet: 'Digital Wallet',
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '1rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
            Transaction ID
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
            {transaction.id}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Ref: {transaction.reference}
          </div>
        </div>
        <TransactionStatusBadge status={transaction.status} />
      </div>

      {/* Amount */}
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        borderBottom: '1px solid #e0e0e0',
        background: '#f9fafb',
      }}>
        <div style={{
          fontSize: '3rem',
          fontWeight: 700,
          color: transaction.status === 'refunded' ? '#9ca3af' : '#1f2937',
          textDecoration: transaction.status === 'refunded' ? 'line-through' : 'none',
        }}>
          {formatAmount(transaction.amount, transaction.currency)}
        </div>
        {transaction.refund_amount && (
          <div style={{ color: '#dc2626', fontSize: '1.125rem', marginTop: '0.5rem' }}>
            Refunded: {formatAmount(transaction.refund_amount, transaction.currency)}
          </div>
        )}
        <div style={{ color: '#666', marginTop: '0.5rem' }}>
          {transaction.description}
        </div>
      </div>

      {/* Parties */}
      <div style={{
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '1rem',
        alignItems: 'center',
        borderBottom: '1px solid #e0e0e0',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>From</div>
          <div style={{ fontWeight: 600 }}>{transaction.from.name}</div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>{transaction.from.email}</div>
        </div>
        <div style={{ fontSize: '1.5rem', color: '#9ca3af' }}>-&gt;</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>To</div>
          <div style={{ fontWeight: 600 }}>{transaction.to.name}</div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>{transaction.to.email}</div>
        </div>
      </div>

      {/* Payment Method & Timing */}
      <div style={{
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
            Payment Method
          </div>
          <div style={{ fontWeight: 500 }}>
            {paymentMethodIcons[transaction.payment_method]}
            {transaction.payment_method_last4 && ` ending ${transaction.payment_method_last4}`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
            {transaction.completed_at ? 'Completed' : 'Created'}
          </div>
          <div style={{ fontWeight: 500 }}>
            {formatDate(transaction.completed_at || transaction.created_at)}
          </div>
        </div>
      </div>

      {/* Refund Eligibility */}
      {transaction.status === 'completed' && transaction.refund_eligible && (
        <div style={{
          padding: '1rem 1.5rem',
          background: '#f0fdf4',
          borderTop: '1px solid #86efac',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ color: '#166534', fontWeight: 500 }}>Refund eligible</span>
            {transaction.refund_deadline && (
              <span style={{ color: '#166534', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                until {new Date(transaction.refund_deadline).toLocaleDateString()}
              </span>
            )}
          </div>
          <button style={{
            padding: '0.5rem 1rem',
            background: '#fff',
            border: '1px solid #86efac',
            borderRadius: '0.375rem',
            color: '#166534',
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Issue Refund
          </button>
        </div>
      )}
    </div>
  );
}

function TransactionDetailStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Transaction Detail</h1>
      <h2 style={STYLES.subheading}>
        Full transaction view with parties, amounts, and metadata
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Completed Transaction</div>
        <TransactionDetailCard transaction={SAMPLE_TRANSACTION} />
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Failed Transaction</div>
        <TransactionDetailCard transaction={FAILED_TRANSACTION} />
      </section>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Refunded Transaction</div>
        <TransactionDetailCard transaction={REFUNDED_TRANSACTION} />
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. TRANSACTION TIMELINE — Visual lifecycle
 * ───────────────────────────────────────────────────────────────────────────── */

function TransactionTimeline({ events }: { events: TransactionEvent[] }): JSX.Element {
  const getEventIcon = (type: string): { icon: string; color: string } => {
    if (type.includes('completed') || type.includes('processed')) return { icon: '+', color: '#16a34a' };
    if (type.includes('failed')) return { icon: '!', color: '#dc2626' };
    if (type.includes('refund')) return { icon: '<-', color: '#6b7280' };
    return { icon: 'o', color: '#3b82f6' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {events.map((event, index) => {
        const { icon, color } = getEventIcon(event.type);
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} style={{ display: 'flex', gap: '1rem' }}>
            {/* Timeline connector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}>
                {icon}
              </div>
              {!isLast && (
                <div style={{
                  width: '2px',
                  flex: 1,
                  minHeight: '40px',
                  background: '#e5e7eb',
                }} />
              )}
            </div>

            {/* Event content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1.5rem' }}>
              <div style={{ fontWeight: 500 }}>{event.description}</div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                {formatDate(event.timestamp)}
              </div>
              {event.metadata && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#f9fafb',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span style={{ color: '#888' }}>{key}:</span> {value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionTimelineStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Transaction Timeline</h1>
      <h2 style={STYLES.subheading}>
        Visual lifecycle of a transaction from initiation to completion
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        <section>
          <div style={STYLES.groupLabel}>Successful Transaction</div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <TransactionTimeline events={SAMPLE_TRANSACTION.events} />
          </div>
        </section>

        <section>
          <div style={STYLES.groupLabel}>Failed Transaction</div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <TransactionTimeline events={FAILED_TRANSACTION.events} />
          </div>
        </section>

        <section>
          <div style={STYLES.groupLabel}>Refunded Transaction</div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <TransactionTimeline events={REFUNDED_TRANSACTION.events} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. REFUND FLOW — Refund demonstration
 * ───────────────────────────────────────────────────────────────────────────── */

function RefundFlowStory(): JSX.Element {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState(SAMPLE_TRANSACTION.amount);
  const originalAmount = SAMPLE_TRANSACTION.amount;

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Refund Flow</h1>
      <h2 style={STYLES.subheading}>
        Refund eligibility checking and processing
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Refund Form */}
          <div>
            <div style={STYLES.groupLabel}>Issue Refund</div>
            <div style={{ ...STYLES.card, background: '#fff' }}>
              {/* Original Transaction Summary */}
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.875rem', color: '#888', marginBottom: '0.25rem' }}>
                  Original Transaction
                </div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem' }}>
                  {SAMPLE_TRANSACTION.id}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {formatAmount(originalAmount, SAMPLE_TRANSACTION.currency)}
                </div>
              </div>

              {/* Refund Type */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                  Refund Type
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setRefundType('full'); setRefundAmount(originalAmount); }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: refundType === 'full' ? '#3b82f6' : '#fff',
                      color: refundType === 'full' ? '#fff' : '#374151',
                      border: refundType === 'full' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Full Refund
                  </button>
                  <button
                    onClick={() => { setRefundType('partial'); setRefundAmount(Math.floor(originalAmount / 2)); }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: refundType === 'partial' ? '#3b82f6' : '#fff',
                      color: refundType === 'partial' ? '#fff' : '#374151',
                      border: refundType === 'partial' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Partial Refund
                  </button>
                </div>
              </div>

              {/* Partial Amount */}
              {refundType === 'partial' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    Refund Amount
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', color: '#374151' }}>$</span>
                    <input
                      type="number"
                      value={(refundAmount / 100).toFixed(2)}
                      onChange={(e) => setRefundAmount(Math.min(parseFloat(e.target.value) * 100, originalAmount))}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    Max: {formatAmount(originalAmount, SAMPLE_TRANSACTION.currency)}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Reason for Refund
                </div>
                <select style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.9375rem',
                  background: '#fff',
                }}>
                  <option value="">Select a reason...</option>
                  <option value="customer_request">Customer request</option>
                  <option value="duplicate">Duplicate charge</option>
                  <option value="service_issue">Service issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button style={{
                width: '100%',
                padding: '0.875rem',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Process {formatAmount(refundAmount, SAMPLE_TRANSACTION.currency)} Refund
              </button>
            </div>
          </div>

          {/* Eligibility Rules */}
          <div>
            <div style={STYLES.groupLabel}>Eligibility Check</div>
            <div style={{ ...STYLES.card, background: '#f0fdf4', borderColor: '#86efac', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', color: '#16a34a' }}>+</span>
                <span style={{ fontWeight: 600, color: '#166534' }}>Eligible for Refund</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534' }}>
                This transaction meets all refund policy requirements.
              </p>
            </div>

            <div style={{ ...STYLES.card, background: '#fff' }}>
              <h4 style={{ margin: '0 0 1rem' }}>Policy Checks</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { passed: true, label: 'Within 30-day refund window' },
                  { passed: true, label: 'Transaction status is "completed"' },
                  { passed: true, label: 'No previous refund issued' },
                  { passed: true, label: 'Amount under $500 (no approval needed)' },
                ].map((check, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: check.passed ? '#16a34a' : '#dc2626' }}>
                      {check.passed ? '+' : '-'}
                    </span>
                    <span style={{ fontSize: '0.875rem' }}>{check.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Refund Timeline */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Refund Processing Timeline</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {[
              { label: 'Requested', time: 'Now', active: true },
              { label: 'Processing', time: '1-2 days', active: false },
              { label: 'Completed', time: '3-5 days', active: false },
              { label: 'Credited', time: '5-10 days', active: false },
            ].map((step, index) => (
              <React.Fragment key={step.label}>
                {index > 0 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    background: step.active ? '#3b82f6' : '#e5e7eb',
                  }} />
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: step.active ? '#3b82f6' : '#e5e7eb',
                    color: step.active ? '#fff' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    margin: '0 auto 0.5rem',
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{step.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{step.time}</div>
                </div>
              </React.Fragment>
            ))}
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
  title: 'Objects/Domain Objects/Transaction',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
};

export const TransactionDetail: Story = {
  name: '2. Transaction Detail',
  render: () => <TransactionDetailStory />,
};

export const Timeline: Story = {
  name: '3. Transaction Timeline',
  render: () => <TransactionTimelineStory />,
};

export const RefundFlow: Story = {
  name: '4. Refund Flow',
  render: () => <RefundFlowStory />,
};
