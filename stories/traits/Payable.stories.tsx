/**
 * Payable Trait — Payment Processing Demo
 *
 * This story demonstrates the Payable trait which provides:
 * Provider-agnostic payment processing with refund handling and audit trails.
 *
 * Payable complements Billable (pricing/plans) and Metered (usage tracking)
 * by handling the actual money movement:
 * - Payment method management
 * - Payment lifecycle (initiated -> processing -> succeeded/failed)
 * - Refund workflows (partial/full)
 * - Provider abstraction (Stripe, PayPal, etc.)
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Payment Flow - Visual diagram of payment lifecycle
 * 3. Refund Handling - Refund eligibility and workflows
 * 4. How It Works - Schema fields and provider abstraction
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
 * Status Badge Components
 * ───────────────────────────────────────────────────────────────────────────── */

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';

function PaymentStatusBadge({ status }: { status: PaymentStatus }): JSX.Element {
  const configs: Record<PaymentStatus, { bg: string; color: string; border: string; icon: string }> = {
    pending: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '○' },
    processing: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '◐' },
    succeeded: { bg: '#dcfce7', color: '#166534', border: '#86efac', icon: '●' },
    failed: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', icon: '✕' },
    refunded: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '↩' },
    partially_refunded: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '↩' },
  };
  const config = configs[status];

  return (
    <span style={{
      ...STYLES.badge,
      background: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
    }}>
      <span style={{ fontSize: '0.875rem' }}>{config.icon}</span>
      {status.replace('_', ' ')}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Payment Method Icons
 * ───────────────────────────────────────────────────────────────────────────── */

function PaymentMethodIcon({ method }: { method: 'card' | 'bank' | 'wallet' }): JSX.Element {
  const icons: Record<string, string> = {
    card: '💳',
    bank: '🏦',
    wallet: '📱',
  };
  return <span style={{ fontSize: '1.25rem' }}>{icons[method]}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_PAYMENT_HISTORY = [
  { id: 'pay_001', amount: 9900, status: 'succeeded' as PaymentStatus, method: 'card', date: '2024-12-01', last4: '4242' },
  { id: 'pay_002', amount: 9900, status: 'succeeded' as PaymentStatus, method: 'card', date: '2024-11-01', last4: '4242' },
  { id: 'pay_003', amount: 9900, status: 'failed' as PaymentStatus, method: 'card', date: '2024-10-01', last4: '1234' },
  { id: 'pay_004', amount: 9900, status: 'succeeded' as PaymentStatus, method: 'card', date: '2024-10-02', last4: '4242' },
  { id: 'pay_005', amount: 4950, status: 'refunded' as PaymentStatus, method: 'card', date: '2024-09-15', last4: '4242' },
];

const PAYMENT_METHODS = [
  { id: 'pm_card_1', type: 'card' as const, brand: 'Visa', last4: '4242', expiry: '12/25', isDefault: true },
  { id: 'pm_card_2', type: 'card' as const, brand: 'Mastercard', last4: '5555', expiry: '08/26', isDefault: false },
  { id: 'pm_bank_1', type: 'bank' as const, brand: 'Chase', last4: '6789', expiry: '', isDefault: false },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function formatAmount(amountMinor: number): string {
  return `$${(amountMinor / 100).toFixed(2)}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Payable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Payable</h1>
      <h2 style={STYLES.subheading}>
        Payment processing with provider abstraction and refund handling
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Payable handles <strong>payment collection and refunds</strong> across your application.
          It abstracts payment providers (Stripe, PayPal, etc.) behind a consistent API while
          maintaining a complete audit trail of all payment attempts and outcomes.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Payable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Direct provider coupling (Stripe-specific code)</li>
              <li>Manual refund tracking across systems</li>
              <li>Inconsistent payment method handling</li>
              <li>No standardized audit trail</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Payable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Provider-agnostic payment API</li>
              <li>Automatic refund flow with policies</li>
              <li>Unified payment method storage</li>
              <li>Complete payment history audit trail</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Payable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>payment_method</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Current payment instrument</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>payment_history</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>List of payment attempts</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>refund_eligibility</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Whether refund is allowed</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>payment_status</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>pending / succeeded / failed / refunded</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Invoice', 'Order', 'Subscription', 'Payment Intent'].map((obj) => (
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

      {/* Payment History Preview */}
      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Payment History Example</h3>
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Method</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PAYMENT_HISTORY.slice(0, 3).map((payment) => (
                <tr key={payment.id}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>{payment.date}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>
                    {formatAmount(payment.amount)}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                    •••• {payment.last4}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. PAYMENT FLOW — Visual lifecycle diagram
 * ───────────────────────────────────────────────────────────────────────────── */

function PaymentFlowStory(): JSX.Element {
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>('succeeded');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Payment Flow</h1>
      <h2 style={STYLES.subheading}>
        Payment lifecycle: initiated to processing to outcome
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
          <div style={STYLES.groupLabel}>Payment Lifecycle Diagram</div>

          {/* Start state */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <PaymentStatusBadge status="pending" />
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Payment initiated
            </div>
          </div>

          {/* Arrow down */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#888' }}>
            |<br />
            v Processing with provider
          </div>

          {/* Processing state */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <PaymentStatusBadge status="processing" />
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Sent to payment provider
            </div>
          </div>

          {/* Branch to outcomes */}
          <div style={{ textAlign: 'center', marginBottom: '1rem', color: '#888' }}>
            |<br />
            +----------+----------+<br />
            v          v          v
          </div>

          {/* Outcome states */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div
              style={{
                padding: '1.5rem',
                background: selectedStatus === 'succeeded' ? '#dcfce7' : '#f9fafb',
                border: selectedStatus === 'succeeded' ? '2px solid #16a34a' : '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedStatus('succeeded')}
            >
              <PaymentStatusBadge status="succeeded" />
              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#166534' }}>
                Payment complete
              </div>
            </div>

            <div
              style={{
                padding: '1.5rem',
                background: selectedStatus === 'failed' ? '#fef2f2' : '#f9fafb',
                border: selectedStatus === 'failed' ? '2px solid #dc2626' : '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedStatus('failed')}
            >
              <PaymentStatusBadge status="failed" />
              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#dc2626' }}>
                Payment declined
              </div>
            </div>

            <div
              style={{
                padding: '1.5rem',
                background: selectedStatus === 'refunded' ? '#f3f4f6' : '#f9fafb',
                border: selectedStatus === 'refunded' ? '2px solid #6b7280' : '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedStatus('refunded')}
            >
              <PaymentStatusBadge status="refunded" />
              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Full/partial refund
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Method Selector */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Payment Method Selection</div>
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Select Payment Method</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {PAYMENT_METHODS.map((pm) => (
              <label
                key={pm.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: pm.isDefault ? '#eff6ff' : '#f9fafb',
                  border: pm.isDefault ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="payment_method"
                  defaultChecked={pm.isDefault}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <PaymentMethodIcon method={pm.type} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {pm.brand} •••• {pm.last4}
                    {pm.isDefault && (
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        background: '#3b82f6',
                        color: '#fff',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                      }}>
                        Default
                      </span>
                    )}
                  </div>
                  {pm.expiry && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Expires {pm.expiry}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Retry Flow */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Failed Payment Retry</div>
        <div style={{
          padding: '1.5rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>!</span>
            <div>
              <h4 style={{ margin: 0, color: '#dc2626' }}>Payment Failed</h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#7f1d1d' }}>
                Card ending in 1234 was declined. Please try another payment method.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={{
              padding: '0.75rem 1.5rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              Update Payment Method
            </button>
            <button style={{
              padding: '0.75rem 1.5rem',
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Retry Payment
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. REFUND HANDLING — Refund eligibility and workflows
 * ───────────────────────────────────────────────────────────────────────────── */

function RefundHandlingStory(): JSX.Element {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState(9900);
  const [refundReason, setRefundReason] = useState('');

  const originalAmount = 9900;
  const maxRefundableAmount = 9900;

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Refund Handling</h1>
      <h2 style={STYLES.subheading}>
        Eligibility rules, partial refunds, and policy enforcement
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Refund Form */}
          <div>
            <div style={STYLES.groupLabel}>Issue Refund</div>
            <div style={{
              padding: '1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.75rem',
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                  Original Payment
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  {formatAmount(originalAmount)}
                </div>
              </div>

              {/* Refund Type Toggle */}
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

              {/* Partial Amount Input */}
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
                      onChange={(e) => setRefundAmount(Math.min(parseFloat(e.target.value) * 100, maxRefundableAmount))}
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
                    Max refundable: {formatAmount(maxRefundableAmount)}
                  </div>
                </div>
              )}

              {/* Refund Reason */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Reason for Refund
                </div>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.9375rem',
                    background: '#fff',
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="customer_request">Customer request</option>
                  <option value="duplicate">Duplicate charge</option>
                  <option value="fraudulent">Fraudulent transaction</option>
                  <option value="service_not_rendered">Service not rendered</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button style={{
                width: '100%',
                padding: '0.875rem',
                background: refundReason ? '#dc2626' : '#e5e7eb',
                color: refundReason ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: refundReason ? 'pointer' : 'not-allowed',
              }}>
                Issue {formatAmount(refundAmount)} Refund
              </button>
            </div>
          </div>

          {/* Eligibility Rules */}
          <div>
            <div style={STYLES.groupLabel}>Refund Eligibility</div>
            <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Policy Rules</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#16a34a' }}>+</span>
                  <span style={{ fontSize: '0.875rem' }}>Within 30-day refund window</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#16a34a' }}>+</span>
                  <span style={{ fontSize: '0.875rem' }}>Payment status is "succeeded"</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#16a34a' }}>+</span>
                  <span style={{ fontSize: '0.875rem' }}>No previous refund issued</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#6b7280' }}>o</span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Admin approval required for &gt;$500</span>
                </div>
              </div>
            </div>

            <div style={{ ...STYLES.card, background: '#f0fdf4', borderColor: '#86efac' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>+</span>
                <span style={{ fontWeight: 600, color: '#166534' }}>Eligible for Refund</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534' }}>
                This payment meets all refund policy requirements.
              </p>
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
 * 4. HOW IT WORKS — Schema and provider abstraction
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Schema fields and provider abstraction
      </h2>

      {/* Provider Abstraction */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Provider Abstraction Layer</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Payable abstracts payment providers behind a consistent interface. Switch providers
          without changing application code:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { name: 'Stripe', color: '#635bff' },
            { name: 'PayPal', color: '#003087' },
            { name: 'Square', color: '#000' },
          ].map((provider) => (
            <div key={provider.name} style={{
              padding: '1rem',
              background: '#fff',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.5rem',
                background: provider.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
                margin: '0 auto 0.75rem',
              }}>
                {provider.name[0]}
              </div>
              <div style={{ fontWeight: 500 }}>{provider.name}</div>
            </div>
          ))}
        </div>
        <pre style={STYLES.codeBlock}>
{`// Provider configuration - easily swappable
const paymentProvider = {
  name: "stripe",
  apiKey: process.env.STRIPE_API_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
};

// Unified payment interface
interface PaymentProvider {
  charge(amount: number, method: PaymentMethod): Promise<PaymentResult>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
  getPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
}`}
        </pre>
      </section>

      {/* Payment Method Storage */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Tokenized Payment Method Storage</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Payment methods are tokenized for security. Actual card numbers are stored
          with the provider, never in your database:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Payment method stored in database (tokenized)
{
  payment_method_id: "pm_1234abc",
  type: "card",
  provider: "stripe",
  provider_method_id: "pm_stripe_xyz",  // Stripe's token
  last4: "4242",
  brand: "visa",
  exp_month: 12,
  exp_year: 2025,
  is_default: true,
  created_at: "2024-12-01T00:00:00Z"
}

// Never stored: full card number, CVV, etc.`}
        </pre>
      </section>

      {/* Refund Policy Configuration */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Refund Policy Configuration</div>
        <pre style={STYLES.codeBlock}>
{`// Trait parameters (configure at domain level)
{
  refundPolicy: {
    enabled: true,
    windowDays: 30,                 // Refund window
    requireReason: true,            // Must provide reason
    partialRefundsAllowed: true,    // Allow partial refunds
    approvalThresholdMinor: 50000,  // Admin approval > $500
    allowedReasons: [
      "customer_request",
      "duplicate",
      "fraudulent",
      "service_not_rendered",
      "other"
    ]
  },
  retryPolicy: {
    maxAttempts: 3,
    intervalHours: 24,
    notifyOnFailure: true
  }
}`}
        </pre>
      </section>

      {/* Schema Summary */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Complete Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Payable trait fields
{
  // Payment Method
  payment_method_id: string,         // Reference to stored method
  payment_method_type: string,       // "card" | "bank" | "wallet"
  payment_method_last4: string,      // Last 4 digits for display

  // Payment Status
  payment_status: string,            // "pending" | "processing" | "succeeded" | "failed" | "refunded"
  payment_amount_minor: integer,     // Amount in minor units (cents)
  payment_currency: string,          // ISO 4217 currency code

  // Payment History
  payment_history: PaymentAttempt[], // Array of payment attempts
  last_payment_at: timestamp,        // Most recent successful payment
  last_payment_error: string,        // Last failure reason (if any)

  // Refund Info
  refund_eligibility: boolean,       // Can this payment be refunded?
  refund_amount_minor: integer,      // Amount already refunded
  refund_reason: string,             // Reason for refund

  // Provider Info
  provider_payment_id: string,       // Provider's payment ID (Stripe, PayPal, etc.)
  provider_customer_id: string       // Provider's customer ID
}

// PaymentAttempt structure
{
  attempt_id: string,
  attempted_at: timestamp,
  amount_minor: integer,
  status: "succeeded" | "failed",
  failure_reason?: string,
  provider_response?: object
}`}
        </pre>
      </section>

      {/* Integration Example */}
      <section style={STYLES.section}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>See Payable in Context</h3>
            <p style={{ margin: 0, color: '#555', fontSize: '0.9375rem' }}>
              Learn how Payable works with Invoice, Subscription, and other billing objects.
            </p>
          </div>
          <div style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: '#fff',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            SaaS Billing Flow
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
  title: 'Traits/Domain/Payable',
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

// 2. Payment Flow — Visual lifecycle
export const PaymentFlow: Story = {
  name: '2. Payment Flow',
  render: () => <PaymentFlowStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Refund Handling — Refund workflows
export const RefundHandling: Story = {
  name: '3. Refund Handling',
  render: () => <RefundHandlingStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Schema and mechanics
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
