/**
 * Statusable Trait — Design System Demo
 *
 * This story demonstrates the hidden value of OODS's status registry:
 * a semantic translation layer between business concepts and visual output.
 *
 * Navigation order is intentional:
 * 1. Overview - What is this? Why does it exist?
 * 2. Gallery - What does it look like? (visual, by domain)
 * 3. How It Works - How does the system produce this?
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../../src/components/base/Badge.js';
import {
  listStatuses,
  type StatusTone,
  type StatusPresentation,
} from '../../src/components/statusables/statusRegistry.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Extended status data for domains not yet in main registry
 * ───────────────────────────────────────────────────────────────────────────── */

type ExtendedStatus = {
  status: string;
  label: string;
  description: string;
  tone: StatusTone;
};

const PAYMENT_INTENT_STATUSES: ExtendedStatus[] = [
  { status: 'requires_payment_method', label: 'Requires Payment Method', description: 'Payment method needed', tone: 'info' },
  { status: 'requires_confirmation', label: 'Requires Confirmation', description: 'Awaiting confirmation', tone: 'info' },
  { status: 'processing', label: 'Processing', description: 'Payment in flight', tone: 'accent' },
  { status: 'requires_action', label: 'Requires Action', description: 'Customer action needed', tone: 'warning' },
  { status: 'succeeded', label: 'Succeeded', description: 'Payment captured', tone: 'success' },
  { status: 'canceled', label: 'Canceled', description: 'Payment canceled', tone: 'neutral' },
];

const TICKET_STATUSES: ExtendedStatus[] = [
  { status: 'new', label: 'New', description: 'Not yet triaged', tone: 'info' },
  { status: 'open', label: 'Open', description: 'In progress', tone: 'accent' },
  { status: 'pending', label: 'Pending', description: 'Waiting on requester', tone: 'warning' },
  { status: 'on_hold', label: 'On Hold', description: 'Paused', tone: 'neutral' },
  { status: 'solved', label: 'Solved', description: 'Resolution provided', tone: 'success' },
  { status: 'closed', label: 'Closed', description: 'Archived', tone: 'neutral' },
];

const USER_STATUSES: ExtendedStatus[] = [
  { status: 'invited', label: 'Invited', description: 'Awaiting activation', tone: 'info' },
  { status: 'active', label: 'Active', description: 'In good standing', tone: 'success' },
  { status: 'suspended', label: 'Suspended', description: 'Temporarily suspended', tone: 'warning' },
  { status: 'locked', label: 'Locked', description: 'Too many failed attempts', tone: 'critical' },
  { status: 'deactivated', label: 'Deactivated', description: 'Account disabled', tone: 'neutral' },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Tone grouping helpers
 * ───────────────────────────────────────────────────────────────────────────── */

type ToneGroup = {
  label: string;
  description: string;
  tones: StatusTone[];
};

const TONE_GROUPS: ToneGroup[] = [
  { label: 'Healthy', description: 'Everything is working as expected', tones: ['success'] },
  { label: 'In Progress', description: 'Active work or processing', tones: ['accent', 'info'] },
  { label: 'Needs Attention', description: 'Action may be required soon', tones: ['warning'] },
  { label: 'Critical', description: 'Immediate action required', tones: ['critical'] },
  { label: 'Inactive', description: 'Ended, paused, or neutral states', tones: ['neutral'] },
];

function groupByTone<T extends { tone: StatusTone }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const group of TONE_GROUPS) {
    const matching = items.filter((item) => group.tones.includes(item.tone));
    if (matching.length > 0) {
      grouped.set(group.label, matching);
    }
  }

  return grouped;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '900px',
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
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginBottom: '1.5rem',
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
 * 1. OVERVIEW — What is this? Why does it exist?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Statusable</h1>
      <h2 style={STYLES.subheading}>
        Consistent status presentation across your entire application
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          OODS uses a <strong>status registry</strong> to ensure every status in your
          application renders consistently. Define the business meaning once,
          get the right badge everywhere.
        </p>

        {/* Before/After comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without a System
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Developer A uses a red badge</li>
              <li>Developer B uses an orange banner</li>
              <li>Developer C forgets the icon</li>
              <li>None of them match</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Status Registry
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Same status → same appearance</li>
              <li>Change once → updates everywhere</li>
              <li>Designers and devs share vocabulary</li>
              <li>Accessibility patterns built-in</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>The Mapping</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <code style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            status: "delinquent"
          </code>
          <span style={{ color: '#888', fontSize: '1.5rem' }}>→</span>
          <code style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            tone: warning
          </code>
          <span style={{ color: '#888', fontSize: '1.5rem' }}>→</span>
          <Badge status="delinquent" domain="subscription" showIcon />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. GALLERY — Visual showcase by domain, grouped by meaning
 * ───────────────────────────────────────────────────────────────────────────── */

interface DomainGalleryProps {
  title: string;
  subtitle: string;
  domain: string;
  statuses: Array<StatusPresentation | ExtendedStatus>;
}

function DomainGallery({ title, subtitle, domain, statuses }: DomainGalleryProps): JSX.Element {
  const grouped = groupByTone(statuses);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>{title}</h1>
      <h2 style={STYLES.subheading}>{subtitle}</h2>

      {Array.from(grouped.entries()).map(([groupLabel, items]) => (
        <div key={groupLabel} style={{ marginBottom: '2rem' }}>
          <div style={STYLES.groupLabel}>{groupLabel}</div>
          <div style={STYLES.badgeRow}>
            {items.map((item) => {
              const isExtended = !('badge' in item);
              return (
                <Badge
                  key={item.status}
                  status={item.status}
                  domain={domain}
                  tone={isExtended ? item.tone : undefined}
                  showIcon
                  title={item.description}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubscriptionGallery(): JSX.Element {
  const statuses = listStatuses('subscription');
  return (
    <DomainGallery
      title="Subscription States"
      subtitle="Billing lifecycle from trial to termination"
      domain="subscription"
      statuses={statuses}
    />
  );
}

function InvoiceGallery(): JSX.Element {
  const statuses = listStatuses('invoice');
  return (
    <DomainGallery
      title="Invoice States"
      subtitle="Payment document lifecycle"
      domain="invoice"
      statuses={statuses}
    />
  );
}

function PaymentGallery(): JSX.Element {
  return (
    <DomainGallery
      title="Payment Intent States"
      subtitle="Transaction processing flow"
      domain="payment_intent"
      statuses={PAYMENT_INTENT_STATUSES}
    />
  );
}

function TicketGallery(): JSX.Element {
  return (
    <DomainGallery
      title="Ticket States"
      subtitle="Support workflow progression"
      domain="ticket"
      statuses={TICKET_STATUSES}
    />
  );
}

function UserGallery(): JSX.Element {
  return (
    <DomainGallery
      title="User States"
      subtitle="Account lifecycle management"
      domain="user"
      statuses={USER_STATUSES}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. HOW IT WORKS — Narrative walkthrough
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Follow one status through the system
      </h2>

      {/* Scene 1: The Business Reality */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 1: The Business Reality</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Your subscription object has a status field. Today it's <strong>"delinquent"</strong> —
          the customer's payment failed and collection retries are in progress.
        </p>
        <pre style={STYLES.codeBlock}>
{`subscription = {
  id: "sub_abc123",
  customer: "cus_xyz789",
  status: "delinquent",  // ← This is what we're visualizing
  ...
}`}
        </pre>
      </section>

      {/* Scene 2: The Registry Lookup */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 2: The Registry Lookup</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The status registry maps this string to semantic presentation data:
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}>
          <div style={{ flex: '1 1 200px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Input</div>
            <code style={{ fontWeight: 600 }}>"delinquent"</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>→</div>
          <div style={{ flex: '1 1 200px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Tone</div>
            <code style={{ fontWeight: 600 }}>critical</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>→</div>
          <div style={{ flex: '1 1 200px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Label</div>
            <code style={{ fontWeight: 600 }}>Delinquent</code>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`getStatusPresentation('subscription', 'delinquent')
// → { tone: 'critical', label: 'Delinquent', icon: 'warning', ... }`}
        </pre>
      </section>

      {/* Scene 3: What the User Sees */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 3: What the User Sees</div>
        <p style={{ margin: '0 0 1.5rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The Badge component renders automatically with the right colors, icon, and label:
        </p>
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          padding: '2rem',
          background: '#fff',
          borderRadius: '0.5rem',
          border: '1px solid #e0e0e0',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Subtle (default)</div>
            <Badge status="delinquent" domain="subscription" emphasis="subtle" showIcon />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Solid (high emphasis)</div>
            <Badge status="delinquent" domain="subscription" emphasis="solid" showIcon />
          </div>
        </div>
      </section>

      {/* Scene 4: Why This Matters */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Why This Matters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Consistency</strong>
            <span style={{ color: '#666' }}>Same status → same appearance everywhere</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Single Source</strong>
            <span style={{ color: '#666' }}>Change the mapping → updates all instances</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Shared Language</strong>
            <span style={{ color: '#666' }}>Designers and developers use the same terms</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Accessibility</strong>
            <span style={{ color: '#666' }}>Tones map to ARIA patterns automatically</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 *
 * Story order matches learning progression:
 * 1. Overview (what/why)
 * 2. Galleries by domain (visual reference)
 * 3. How It Works (mechanics)
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<typeof Badge>;

const meta: Meta<typeof Badge> = {
  title: 'Traits/Lifecycle/Statusable',
  component: Badge,
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

// 2. Galleries — Grouped under domain names
export const Subscriptions: Story = {
  name: '2. Subscriptions',
  render: () => <SubscriptionGallery />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

export const Invoices: Story = {
  name: '3. Invoices',
  render: () => <InvoiceGallery />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

export const Payments: Story = {
  name: '4. Payments',
  render: () => <PaymentGallery />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

export const Tickets: Story = {
  name: '5. Tickets',
  render: () => <TicketGallery />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

export const Users: Story = {
  name: '6. Users',
  render: () => <UserGallery />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. How It Works — Last, for those who want the mechanics
export const HowItWorks: Story = {
  name: '7. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
