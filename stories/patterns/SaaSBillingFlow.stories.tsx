import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Badge } from '../../src/components/base/Badge.js';
import '../../src/styles/globals.css';

const meta: Meta = {
  title: 'Domain Patterns/SaaS Billing Flow',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '900px',
    margin: '0 auto',
  },
  section: {
    marginBottom: '3rem',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '1rem',
    color: 'var(--color-text-default, #1a1a1a)',
  },
  subheading: {
    fontSize: '1.125rem',
    fontWeight: 500,
    marginBottom: '0.75rem',
    color: 'var(--color-text-muted, #666)',
  },
  paragraph: {
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    color: 'var(--color-text-default, #333)',
    marginBottom: '1rem',
  },
  flowContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '2rem',
    background: 'var(--color-bg-subtle, #f8f9fa)',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
  },
  objectBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.25rem 1.5rem',
    background: 'var(--color-bg-default, white)',
    border: '2px solid var(--color-border-default, #e0e0e0)',
    borderRadius: '8px',
    minWidth: '140px',
  },
  objectLabel: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-muted, #666)',
  },
  arrow: {
    fontSize: '1.5rem',
    color: 'var(--color-text-muted, #999)',
    padding: '0 0.25rem',
  },
  summaryBox: {
    padding: '1rem 1.25rem',
    background: 'var(--color-bg-subtle, #f8f9fa)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    borderLeft: '3px solid var(--color-border-emphasis, #0066cc)',
    marginTop: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  objectCard: {
    padding: '1rem',
    background: 'var(--color-bg-default, white)',
    border: '1px solid var(--color-border-default, #e0e0e0)',
    borderRadius: '8px',
  },
  objectCardLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-muted, #999)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  },
  caption: {
    fontSize: '0.8125rem',
    color: 'var(--color-text-muted, #666)',
    textAlign: 'center' as const,
    marginTop: '0.75rem',
    fontStyle: 'italic' as const,
  },
} as const;

function ObjectBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.objectBox}>
      <span style={styles.objectLabel}>{label}</span>
      {children}
    </div>
  );
}

function Arrow({ direction = 'forward' }: { direction?: 'forward' | 'backward' }) {
  return (
    <span style={styles.arrow} aria-hidden="true">
      {direction === 'forward' ? '\u2192' : '\u2190'}
    </span>
  );
}

export const Overview: Story = {
  name: '1. Overview',
  render: () => (
    <div style={styles.container}>
      <div style={styles.section}>
        <h1 style={styles.heading}>SaaS Billing Flow</h1>
        <p style={styles.paragraph}>
          This pattern demonstrates how OODS handles real business domain complexity.
          Three interconnected objects form the core billing flow, each with its own
          lifecycle status that cascades through the chain.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>The Three Objects</h2>
        <div style={styles.flowContainer}>
          <ObjectBox label="Subscription">
            <Badge status="active" domain="subscription" showIcon />
          </ObjectBox>
          <Arrow />
          <ObjectBox label="Invoice">
            <Badge status="posted" domain="invoice" showIcon />
          </ObjectBox>
          <Arrow />
          <ObjectBox label="PaymentIntent">
            <Badge tone="info" showIcon>Processing</Badge>
          </ObjectBox>
        </div>
        <p style={styles.paragraph}>
          <strong>Subscription</strong> generates <strong>Invoice</strong> on each billing cycle.
          Each Invoice initiates a <strong>PaymentIntent</strong> to collect payment.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>What This Demonstrates</h2>
        <ul style={{ ...styles.paragraph, paddingLeft: '1.25rem' }}>
          <li><strong>Object relationships:</strong> Subscriptions spawn Invoices, Invoices spawn PaymentIntents</li>
          <li><strong>Status cascades:</strong> Payment failure propagates backward through the chain</li>
          <li><strong>Trait consistency:</strong> All three use Stateful, Timestampable, and domain-specific traits</li>
          <li><strong>statusRegistry:</strong> Ensures visual consistency (same tone system everywhere)</li>
        </ul>
      </div>

      <div style={styles.summaryBox}>
        <strong>Key insight:</strong> OODS handles the same trait system across all domain objects.
        Whether it's a Subscription, Invoice, or PaymentIntent, the Stateful trait provides
        consistent status rendering through the statusRegistry.
      </div>
    </div>
  ),
};

export const HappyPath: Story = {
  name: '2. Happy Path',
  render: () => (
    <div style={styles.container}>
      <div style={styles.section}>
        <h1 style={styles.heading}>Happy Path: Successful Payment</h1>
        <p style={styles.paragraph}>
          When everything works correctly, status flows forward through the chain.
          Each object ends in a healthy state.
        </p>
      </div>

      <div style={styles.flowContainer}>
        <ObjectBox label="Subscription">
          <Badge status="active" domain="subscription" showIcon />
        </ObjectBox>
        <Arrow direction="forward" />
        <ObjectBox label="Invoice">
          <Badge status="paid" domain="invoice" showIcon />
        </ObjectBox>
        <Arrow direction="forward" />
        <ObjectBox label="PaymentIntent">
          <Badge tone="success" showIcon>Succeeded</Badge>
        </ObjectBox>
      </div>

      <p style={styles.caption}>
        Subscription generates Invoice. Invoice initiates PaymentIntent. Payment succeeds.
      </p>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Status Details</h2>
        <div style={styles.grid}>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>Subscription</div>
            <Badge status="active" domain="subscription" showIcon />
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Service is provisioned and billing is current.
            </p>
          </div>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>Invoice</div>
            <Badge status="paid" domain="invoice" showIcon />
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Invoice collected successfully in full.
            </p>
          </div>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>PaymentIntent</div>
            <Badge tone="success" showIcon>Succeeded</Badge>
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Payment method charged successfully.
            </p>
          </div>
        </div>
      </div>

      <div style={styles.summaryBox}>
        <strong>Result:</strong> All objects in healthy states. Customer has access,
        invoice is settled, payment is complete. The statusRegistry maps each status
        to the "success" tone for consistent green styling.
      </div>
    </div>
  ),
};

export const FailurePath: Story = {
  name: '3. Failure Path',
  render: () => (
    <div style={styles.container}>
      <div style={styles.section}>
        <h1 style={styles.heading}>Failure Path: Payment Declined</h1>
        <p style={styles.paragraph}>
          When payment fails, status cascades <em>backward</em> through the chain.
          The PaymentIntent failure propagates to Invoice, then to Subscription.
        </p>
      </div>

      <div style={styles.flowContainer}>
        <ObjectBox label="Subscription">
          <Badge status="delinquent" domain="subscription" showIcon />
        </ObjectBox>
        <Arrow direction="backward" />
        <ObjectBox label="Invoice">
          <Badge status="past_due" domain="invoice" showIcon />
        </ObjectBox>
        <Arrow direction="backward" />
        <ObjectBox label="PaymentIntent">
          <Badge tone="critical" showIcon>Failed</Badge>
        </ObjectBox>
      </div>

      <p style={styles.caption}>
        Payment fails. Invoice becomes past due. Subscription marked delinquent.
      </p>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Status Details</h2>
        <div style={styles.grid}>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>Subscription</div>
            <Badge status="delinquent" domain="subscription" showIcon />
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Renewal payment failed; collection retries in progress.
            </p>
          </div>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>Invoice</div>
            <Badge status="past_due" domain="invoice" showIcon />
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Invoice is unpaid past its due date.
            </p>
          </div>
          <div style={styles.objectCard}>
            <div style={styles.objectCardLabel}>PaymentIntent</div>
            <Badge tone="critical" showIcon>Failed</Badge>
            <p style={{ ...styles.paragraph, fontSize: '0.8125rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Payment method was declined or errored.
            </p>
          </div>
        </div>
      </div>

      <div style={styles.summaryBox}>
        <strong>Result:</strong> All objects in critical states. The backward arrows
        illustrate how failure cascades up the chain. The statusRegistry maps
        delinquent, past_due, and failed to the "critical" tone for consistent red styling.
      </div>
    </div>
  ),
};

export const StatusCascade: Story = {
  name: '4. Status Cascade',
  render: () => (
    <div style={styles.container}>
      <div style={styles.section}>
        <h1 style={styles.heading}>Status Cascade: Consistent Tones</h1>
        <p style={styles.paragraph}>
          The statusRegistry ensures visual consistency across all three objects.
          Related statuses map to the same tone, making system state instantly readable.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Success Tones</h2>
        <p style={styles.paragraph}>
          Healthy states all use the "success" tone:
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Badge status="active" domain="subscription" showIcon />
          <Badge status="paid" domain="invoice" showIcon />
          <Badge tone="success" showIcon>Succeeded</Badge>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Critical Tones</h2>
        <p style={styles.paragraph}>
          Failure states all use the "critical" tone:
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Badge status="delinquent" domain="subscription" showIcon />
          <Badge status="past_due" domain="invoice" showIcon />
          <Badge tone="critical" showIcon>Failed</Badge>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Info/Pending Tones</h2>
        <p style={styles.paragraph}>
          In-progress states use the "info" tone:
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Badge status="trialing" domain="subscription" showIcon />
          <Badge status="posted" domain="invoice" showIcon />
          <Badge tone="info" showIcon>Processing</Badge>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Full Subscription Lifecycle</h2>
        <p style={styles.paragraph}>
          All subscription statuses with their tones:
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Badge status="future" domain="subscription" showIcon />
          <Badge status="trialing" domain="subscription" showIcon />
          <Badge status="active" domain="subscription" showIcon />
          <Badge status="paused" domain="subscription" showIcon />
          <Badge status="pending_cancellation" domain="subscription" showIcon />
          <Badge status="delinquent" domain="subscription" showIcon />
          <Badge status="terminated" domain="subscription" showIcon />
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.subheading}>Full Invoice Lifecycle</h2>
        <p style={styles.paragraph}>
          All invoice statuses with their tones:
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Badge status="draft" domain="invoice" showIcon />
          <Badge status="posted" domain="invoice" showIcon />
          <Badge status="paid" domain="invoice" showIcon />
          <Badge status="past_due" domain="invoice" showIcon />
          <Badge status="void" domain="invoice" showIcon />
        </div>
      </div>

      <div style={styles.summaryBox}>
        <strong>Key insight:</strong> The statusRegistry automatically assigns tones based on
        token references in the status map. DELINQUENT, PAST_DUE, and FAILED all reference
        "danger" tokens, so they receive the "critical" tone. This ensures visual consistency
        without manual coordination.
      </div>
    </div>
  ),
};
