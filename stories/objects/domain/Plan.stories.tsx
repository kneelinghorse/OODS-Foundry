/**
 * Plan Object — Subscription/Pricing Plan Demo
 *
 * Plan represents a subscription/pricing plan and demonstrates how traits
 * compose into a complete domain object:
 * - Labelled: Display name and description
 * - Stateful: Lifecycle (draft -> active -> deprecated -> archived)
 * - Timestampable: Created/updated timestamps
 * - Priceable: Pricing tiers and billing periods
 *
 * Stories:
 * 1. Overview - What is a Plan object?
 * 2. Plan Cards - Individual plan display
 * 3. Comparison Grid - Side-by-side plan comparison
 * 4. Plan Lifecycle - State transitions for plans
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1200px',
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
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Type definitions
 * ───────────────────────────────────────────────────────────────────────────── */

type PlanStatus = 'draft' | 'active' | 'deprecated' | 'archived';
type BillingPeriod = 'monthly' | 'yearly';

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  status: PlanStatus;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: PlanFeature[];
  is_popular?: boolean;
  created_at: string;
  updated_at: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_PLANS: Plan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    description: 'Perfect for individuals and small projects',
    status: 'active',
    price_monthly: 900,
    price_yearly: 9000,
    currency: 'USD',
    features: [
      { name: 'Projects', included: true, limit: '3' },
      { name: 'Team members', included: true, limit: '1' },
      { name: 'Storage', included: true, limit: '5 GB' },
      { name: 'API access', included: false },
      { name: 'Priority support', included: false },
      { name: 'Custom branding', included: false },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-15T00:00:00Z',
  },
  {
    id: 'plan_pro',
    name: 'Professional',
    description: 'For growing teams that need more power',
    status: 'active',
    price_monthly: 2900,
    price_yearly: 29000,
    currency: 'USD',
    is_popular: true,
    features: [
      { name: 'Projects', included: true, limit: 'Unlimited' },
      { name: 'Team members', included: true, limit: '10' },
      { name: 'Storage', included: true, limit: '100 GB' },
      { name: 'API access', included: true },
      { name: 'Priority support', included: true },
      { name: 'Custom branding', included: false },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-08-20T00:00:00Z',
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
    status: 'active',
    price_monthly: 9900,
    price_yearly: 99000,
    currency: 'USD',
    features: [
      { name: 'Projects', included: true, limit: 'Unlimited' },
      { name: 'Team members', included: true, limit: 'Unlimited' },
      { name: 'Storage', included: true, limit: 'Unlimited' },
      { name: 'API access', included: true },
      { name: 'Priority support', included: true },
      { name: 'Custom branding', included: true },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-09-10T00:00:00Z',
  },
];

const LEGACY_PLAN: Plan = {
  id: 'plan_basic_legacy',
  name: 'Basic (Legacy)',
  description: 'This plan is no longer available for new subscribers',
  status: 'deprecated',
  price_monthly: 500,
  price_yearly: 5000,
  currency: 'USD',
  features: [
    { name: 'Projects', included: true, limit: '1' },
    { name: 'Team members', included: true, limit: '1' },
    { name: 'Storage', included: true, limit: '1 GB' },
    { name: 'API access', included: false },
    { name: 'Priority support', included: false },
    { name: 'Custom branding', included: false },
  ],
  created_at: '2022-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amountMinor / 100);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Status Badge Component
 * ───────────────────────────────────────────────────────────────────────────── */

function PlanStatusBadge({ status }: { status: PlanStatus }): JSX.Element {
  const configs: Record<PlanStatus, { bg: string; color: string; border: string; icon: string }> = {
    draft: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '○' },
    active: { bg: '#dcfce7', color: '#166534', border: '#86efac', icon: '●' },
    deprecated: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '!' },
    archived: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '×' },
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
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is a Plan object?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Plan</h1>
      <h2 style={STYLES.subheading}>
        Subscription/Pricing plan with lifecycle and feature management
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          A <strong>Plan</strong> represents a subscription or pricing tier that customers can
          subscribe to. It combines multiple traits to handle naming, lifecycle states,
          timestamps, and pricing information.
        </p>

        {/* Composed Traits */}
        <div style={STYLES.groupLabel}>Composed Traits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed' }}>Labelled</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>name, description fields</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>Stateful</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>draft, active, deprecated, archived</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0891b2' }}>Timestampable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>created_at, updated_at</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#dc2626' }}>Priceable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>price_monthly, price_yearly, currency</span>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Common Use Cases</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#f0fdf4', borderColor: '#86efac' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#166534' }}>SaaS Subscription Tiers</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534' }}>
              Starter, Pro, Enterprise plans with feature gating
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#eff6ff', borderColor: '#93c5fd' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#1e40af' }}>Service Packages</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af' }}>
              Basic, Standard, Premium service offerings
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fef3c7', borderColor: '#fcd34d' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#92400e' }}>Membership Levels</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
              Free, Silver, Gold, Platinum membership tiers
            </p>
          </div>
        </div>
      </section>

      {/* Schema Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Schema Structure</div>
        <pre style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          background: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          overflow: 'auto',
        }}>
{`{
  // Identity
  id: "plan_pro",

  // Labelled trait
  name: "Professional",
  description: "For growing teams",

  // Stateful trait
  status: "active",
  state_history: [...],

  // Timestampable trait
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-08-20T00:00:00Z",

  // Priceable trait
  price_monthly: 2900,      // $29.00 in minor units
  price_yearly: 29000,      // $290.00 in minor units
  currency: "USD",

  // Plan-specific
  features: [...],
  is_popular: true
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. PLAN CARDS — Individual plan display
 * ───────────────────────────────────────────────────────────────────────────── */

function PlanCard({ plan, billingPeriod, onSelect }: {
  plan: Plan;
  billingPeriod: BillingPeriod;
  onSelect?: () => void;
}): JSX.Element {
  const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly / 12;
  const isDeprecated = plan.status === 'deprecated';

  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: '1rem',
      border: plan.is_popular ? '2px solid #3b82f6' : '1px solid #e0e0e0',
      background: isDeprecated ? '#f9fafb' : '#fff',
      opacity: isDeprecated ? 0.8 : 1,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {plan.is_popular && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.25rem 1rem',
          background: '#3b82f6',
          color: '#fff',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}>
          Most Popular
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{plan.name}</h3>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>{plan.description}</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 700 }}>
            {formatPrice(price, plan.currency)}
          </span>
          <span style={{ color: '#666' }}>/mo</span>
        </div>
        {billingPeriod === 'yearly' && (
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem' }}>
            Billed annually ({formatPrice(plan.price_yearly, plan.currency)}/year)
          </div>
        )}
      </div>

      <div style={{ flex: 1, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {plan.features.map((feature) => (
            <div key={feature.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{
                color: feature.included ? '#16a34a' : '#d1d5db',
                fontSize: '1rem',
              }}>
                {feature.included ? '+' : '-'}
              </span>
              <span style={{
                color: feature.included ? '#374151' : '#9ca3af',
                fontSize: '0.875rem',
              }}>
                {feature.name}
                {feature.limit && feature.included && (
                  <span style={{ color: '#6b7280' }}> ({feature.limit})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onSelect}
        disabled={isDeprecated}
        style={{
          padding: '0.875rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: isDeprecated ? '#e5e7eb' : (plan.is_popular ? '#3b82f6' : '#1f2937'),
          color: isDeprecated ? '#9ca3af' : '#fff',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: isDeprecated ? 'not-allowed' : 'pointer',
        }}
      >
        {isDeprecated ? 'No Longer Available' : 'Get Started'}
      </button>
    </div>
  );
}

function PlanCardsStory(): JSX.Element {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Plan Cards</h1>
      <h2 style={STYLES.subheading}>
        Individual plan display with pricing and features
      </h2>

      {/* Billing Toggle */}
      <section style={{ ...STYLES.section, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'inline-flex',
          padding: '0.25rem',
          background: '#f3f4f6',
          borderRadius: '0.5rem',
        }}>
          <button
            onClick={() => setBillingPeriod('monthly')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: billingPeriod === 'monthly' ? '#fff' : 'transparent',
              boxShadow: billingPeriod === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: billingPeriod === 'yearly' ? '#fff' : 'transparent',
              boxShadow: billingPeriod === 'yearly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Yearly
            <span style={{
              marginLeft: '0.5rem',
              padding: '0.125rem 0.5rem',
              background: '#dcfce7',
              color: '#166534',
              borderRadius: '9999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}>
              Save 17%
            </span>
          </button>
        </div>
      </section>

      {/* Plan Cards Grid */}
      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {SAMPLE_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} billingPeriod={billingPeriod} />
          ))}
        </div>
      </section>

      {/* Legacy Plan Example */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Deprecated Plan Example</div>
        <div style={{ maxWidth: '320px' }}>
          <PlanCard plan={LEGACY_PLAN} billingPeriod={billingPeriod} />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. COMPARISON GRID — Side-by-side plan comparison
 * ───────────────────────────────────────────────────────────────────────────── */

function ComparisonGridStory(): JSX.Element {
  const allFeatureNames = SAMPLE_PLANS[0].features.map(f => f.name);

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Plan Comparison</h1>
      <h2 style={STYLES.subheading}>
        Side-by-side feature matrix for plan selection
      </h2>

      <section style={STYLES.section}>
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{
                  padding: '1.25rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #e0e0e0',
                  width: '200px',
                }}>
                  Feature
                </th>
                {SAMPLE_PLANS.map((plan) => (
                  <th key={plan.id} style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    background: plan.is_popular ? '#eff6ff' : undefined,
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{plan.name}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      {formatPrice(plan.price_monthly, plan.currency)}/mo
                    </div>
                    {plan.is_popular && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        background: '#3b82f6',
                        color: '#fff',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}>
                        Popular
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatureNames.map((featureName, i) => (
                <tr key={featureName} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid #e0e0e0',
                    fontWeight: 500,
                  }}>
                    {featureName}
                  </td>
                  {SAMPLE_PLANS.map((plan) => {
                    const feature = plan.features.find(f => f.name === featureName);
                    return (
                      <td key={plan.id} style={{
                        padding: '1rem',
                        textAlign: 'center',
                        borderBottom: '1px solid #e0e0e0',
                        background: plan.is_popular ? '#eff6ff' : undefined,
                      }}>
                        {feature?.included ? (
                          <span style={{ color: '#16a34a', fontWeight: 500 }}>
                            {feature.limit || '+'}
                          </span>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '1.25rem' }}></td>
                {SAMPLE_PLANS.map((plan) => (
                  <td key={plan.id} style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    background: plan.is_popular ? '#eff6ff' : undefined,
                  }}>
                    <button style={{
                      padding: '0.75rem 2rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: plan.is_popular ? '#3b82f6' : '#1f2937',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      Choose {plan.name}
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. PLAN LIFECYCLE — State transitions
 * ───────────────────────────────────────────────────────────────────────────── */

function PlanLifecycleStory(): JSX.Element {
  const lifecycleStages: { state: PlanStatus; description: string; actions: string[] }[] = [
    {
      state: 'draft',
      description: 'Plan is being configured. Not visible to customers.',
      actions: ['publish'],
    },
    {
      state: 'active',
      description: 'Plan is live and available for subscription.',
      actions: ['deprecate', 'archive'],
    },
    {
      state: 'deprecated',
      description: 'Plan is no longer offered to new customers. Existing subscribers retained.',
      actions: ['reactivate', 'archive'],
    },
    {
      state: 'archived',
      description: 'Plan is retired. All subscribers have been migrated.',
      actions: [],
    },
  ];

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Plan Lifecycle</h1>
      <h2 style={STYLES.subheading}>
        State transitions for subscription plans
      </h2>

      {/* Lifecycle Diagram */}
      <section style={STYLES.section}>
        <div style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {lifecycleStages.map((stage, index) => (
              <React.Fragment key={stage.state}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2rem',
                  width: '100%',
                  maxWidth: '600px',
                }}>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <PlanStatusBadge status={stage.state} />
                  </div>
                  <div style={{
                    flex: 2,
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#666',
                  }}>
                    {stage.description}
                  </div>
                </div>
                {index < lifecycleStages.length - 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>|</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* State Transition Rules */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Valid Transitions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <PlanStatusBadge status="draft" />
              <span style={{ color: '#888' }}>to</span>
              <PlanStatusBadge status="active" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>publish()</code> - Make plan available to customers
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <PlanStatusBadge status="active" />
              <span style={{ color: '#888' }}>to</span>
              <PlanStatusBadge status="deprecated" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>deprecate()</code> - Stop accepting new subscribers
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <PlanStatusBadge status="deprecated" />
              <span style={{ color: '#888' }}>to</span>
              <PlanStatusBadge status="active" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>reactivate()</code> - Resume accepting new subscribers
            </p>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ color: '#666', fontSize: '0.875rem' }}>any</span>
              <span style={{ color: '#888' }}>to</span>
              <PlanStatusBadge status="archived" />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              <code>archive()</code> - Permanently retire the plan
            </p>
          </div>
        </div>
      </section>

      {/* Business Rules */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Business Rules</div>
        <div style={{
          padding: '1.5rem',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '0.75rem',
        }}>
          <h4 style={{ margin: '0 0 1rem', color: '#92400e' }}>Before Archiving a Plan</h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#92400e', lineHeight: 1.8 }}>
            <li>All active subscribers must be migrated to another plan</li>
            <li>Subscription count must be zero</li>
            <li>Grace period (30 days) must have elapsed since deprecation</li>
            <li>Admin approval required for plans with revenue history</li>
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
  title: 'Objects/Domain Objects/Plan',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
};

export const PlanCards: Story = {
  name: '2. Plan Cards',
  render: () => <PlanCardsStory />,
};

export const ComparisonGrid: Story = {
  name: '3. Comparison Grid',
  render: () => <ComparisonGridStory />,
};

export const PlanLifecycle: Story = {
  name: '4. Plan Lifecycle',
  render: () => <PlanLifecycleStory />,
};
