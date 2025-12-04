/**
 * Billable Trait — SaaS Pricing Configuration Demo
 *
 * This story demonstrates the Billable trait which provides:
 * Consistent pricing configuration for SaaS plans and subscriptions.
 *
 * Unlike core traits (Identifiable, Timestampable) or lifecycle traits
 * (Archivable, Stateful), Billable is a DOMAIN trait specific to
 * SaaS billing contexts.
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? What problem does it solve?
 * 2. Plan Gallery - Visual showcase of pricing cards
 * 3. Pricing Models - The 4 pricing strategies
 * 4. How It Works - Schema fields and currency handling
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
 * Currency formatting helpers
 * ───────────────────────────────────────────────────────────────────────────── */

type CurrencyCode = 'usd' | 'eur' | 'gbp' | 'jpy';

const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; decimals: number; position: 'before' | 'after' }> = {
  usd: { symbol: '$', decimals: 2, position: 'before' },
  eur: { symbol: '€', decimals: 2, position: 'after' },
  gbp: { symbol: '£', decimals: 2, position: 'before' },
  jpy: { symbol: '¥', decimals: 0, position: 'before' },
};

function formatPrice(amountMinor: number, currency: CurrencyCode): string {
  const config = CURRENCY_CONFIG[currency];
  const amount = amountMinor / Math.pow(10, config.decimals);
  const formatted = config.decimals > 0
    ? amount.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })
    : amount.toLocaleString('en-US');

  return config.position === 'before'
    ? `${config.symbol}${formatted}`
    : `${formatted}${config.symbol}`;
}

function formatInterval(interval: string, count: number = 1): string {
  if (count === 1) {
    return `/${interval.replace('ly', '')}`;
  }
  return `every ${count} ${interval.replace('ly', '')}s`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample plan data
 * ───────────────────────────────────────────────────────────────────────────── */

type Plan = {
  plan_code: string;
  plan_name: string;
  amount_minor: number;
  currency: CurrencyCode;
  billing_interval: string;
  interval_count: number;
  trial_period_days?: number;
  pricing_model: 'flat' | 'per_unit' | 'tiered' | 'package';
  featured?: boolean;
};

const SAMPLE_PLANS: Plan[] = [
  {
    plan_code: 'starter_monthly',
    plan_name: 'Starter',
    amount_minor: 2900,
    currency: 'usd',
    billing_interval: 'monthly',
    interval_count: 1,
    trial_period_days: 14,
    pricing_model: 'flat',
  },
  {
    plan_code: 'pro_monthly',
    plan_name: 'Pro',
    amount_minor: 9900,
    currency: 'usd',
    billing_interval: 'monthly',
    interval_count: 1,
    trial_period_days: 14,
    pricing_model: 'flat',
    featured: true,
  },
  {
    plan_code: 'enterprise_annual',
    plan_name: 'Enterprise',
    amount_minor: 29900,
    currency: 'usd',
    billing_interval: 'monthly',
    interval_count: 1,
    trial_period_days: 30,
    pricing_model: 'flat',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Plan Card Component
 * ───────────────────────────────────────────────────────────────────────────── */

function PlanCard({ plan }: { plan: Plan }): JSX.Element {
  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: '0.75rem',
      border: plan.featured ? '2px solid #7c3aed' : '1px solid #e0e0e0',
      background: plan.featured ? '#faf5ff' : '#fff',
      textAlign: 'center',
      position: 'relative',
    }}>
      {plan.featured && (
        <div style={{
          position: 'absolute',
          top: '-0.75rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.25rem 0.75rem',
          background: '#7c3aed',
          color: '#fff',
          borderRadius: '9999px',
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Most Popular
        </div>
      )}

      <h3 style={{ marginTop: plan.featured ? '0.5rem' : 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        {plan.plan_name}
      </h3>

      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#111827' }}>
          {formatPrice(plan.amount_minor, plan.currency)}
        </span>
        <span style={{ fontSize: '1rem', color: '#6b7280' }}>
          {formatInterval(plan.billing_interval, plan.interval_count)}
        </span>
      </div>

      {plan.trial_period_days && (
        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          background: '#dcfce7',
          color: '#166534',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 500,
          marginBottom: '1rem',
        }}>
          {plan.trial_period_days}-day free trial
        </div>
      )}

      <div style={{
        padding: '0.5rem',
        background: '#f3f4f6',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        color: '#6b7280',
        fontFamily: 'ui-monospace, monospace',
      }}>
        {plan.plan_code}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Billable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Billable</h1>
      <h2 style={STYLES.subheading}>
        SaaS pricing configuration for plans and subscriptions
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Billable normalizes <strong>recurring price configuration</strong> across your SaaS
          application. Define plan pricing once, render it consistently in pricing pages,
          checkout flows, and admin dashboards.
        </p>

        {/* Problem/Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#fca5a5', background: '#fef2f2' }}>
            <h3 style={{ marginTop: 0, color: '#dc2626', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Without Billable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Price formatting differs across pages</li>
              <li>Currency symbols hardcoded everywhere</li>
              <li>Trial periods tracked inconsistently</li>
              <li>Interval display varies by component</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              With Billable
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>Consistent price display everywhere</li>
              <li>Multi-currency with proper formatting</li>
              <li>Standardized trial period handling</li>
              <li>Flexible interval configurations</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Fields Added by Billable</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>plan_name</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Human-readable plan label</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>amount_minor</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Price in minor units (cents)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>currency</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>ISO 4217 currency code</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>billing_interval</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Cadence (monthly, annual)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>trial_period_days</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>Intro trial length</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>pricing_model</code>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>flat, per_unit, tiered, package</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Used By</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {['Subscription', 'Plan', 'Price', 'Invoice Line Item'].map((obj) => (
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. PLAN GALLERY — Visual showcase
 * ───────────────────────────────────────────────────────────────────────────── */

function PlanGalleryStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Plan Gallery</h1>
      <h2 style={STYLES.subheading}>
        Pricing cards rendered from Billable trait data
      </h2>

      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Standard Pricing Grid</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          {SAMPLE_PLANS.map((plan) => (
            <PlanCard key={plan.plan_code} plan={plan} />
          ))}
        </div>
      </section>

      {/* Currency Variations */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Currency Formatting</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { currency: 'usd' as CurrencyCode, amount: 9900, label: 'US Dollar' },
            { currency: 'eur' as CurrencyCode, amount: 8900, label: 'Euro' },
            { currency: 'gbp' as CurrencyCode, amount: 7900, label: 'British Pound' },
            { currency: 'jpy' as CurrencyCode, amount: 1500, label: 'Japanese Yen' },
          ].map(({ currency, amount, label }) => (
            <div key={currency} style={{
              padding: '1.25rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {formatPrice(amount, currency)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                {label}
              </div>
              <code style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{currency.toUpperCase()}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Interval Variations */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Billing Intervals</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { interval: 'monthly', count: 1, amount: 9900 },
            { interval: 'quarterly', count: 1, amount: 26900 },
            { interval: 'annual', count: 1, amount: 99900 },
          ].map(({ interval, count, amount }) => (
            <div key={interval} style={{
              padding: '1.25rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                  {formatPrice(amount, 'usd')}
                </span>
                <span style={{ color: '#6b7280' }}>
                  {formatInterval(interval, count)}
                </span>
              </div>
              <div style={{
                display: 'inline-block',
                padding: '0.25rem 0.5rem',
                background: '#f3f4f6',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                color: '#374151',
                textTransform: 'capitalize',
              }}>
                {interval}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. PRICING MODELS — The 4 strategies
 * ───────────────────────────────────────────────────────────────────────────── */

function PricingModelsStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Pricing Models</h1>
      <h2 style={STYLES.subheading}>
        Four strategies for calculating recurring charges
      </h2>

      <section style={STYLES.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Flat */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#dbeafe',
                color: '#2563eb',
                borderRadius: '0.5rem',
                fontSize: '1.25rem',
              }}>
                ═
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Flat</h3>
                <code style={{ fontSize: '0.75rem', color: '#6b7280' }}>pricing_model: "flat"</code>
              </div>
            </div>
            <p style={{ margin: '0 0 1rem', color: '#555', lineHeight: 1.6 }}>
              Fixed price per billing period. Same charge regardless of usage or quantity.
            </p>
            <div style={{
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.875rem',
            }}>
              <div style={{ color: '#6b7280' }}>Example:</div>
              <div style={{ fontWeight: 600 }}>$99/month</div>
            </div>
          </div>

          {/* Per Unit */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#dcfce7',
                color: '#16a34a',
                borderRadius: '0.5rem',
                fontSize: '1.25rem',
              }}>
                ×
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Per Unit</h3>
                <code style={{ fontSize: '0.75rem', color: '#6b7280' }}>pricing_model: "per_unit"</code>
              </div>
            </div>
            <p style={{ margin: '0 0 1rem', color: '#555', lineHeight: 1.6 }}>
              Price multiplied by quantity. Common for seat-based or license pricing.
            </p>
            <div style={{
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.875rem',
            }}>
              <div style={{ color: '#6b7280' }}>Example:</div>
              <div style={{ fontWeight: 600 }}>$10/seat × 15 seats = $150</div>
            </div>
          </div>

          {/* Tiered */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fef3c7',
                color: '#d97706',
                borderRadius: '0.5rem',
                fontSize: '1.25rem',
              }}>
                ≡
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Tiered</h3>
                <code style={{ fontSize: '0.75rem', color: '#6b7280' }}>pricing_model: "tiered"</code>
              </div>
            </div>
            <p style={{ margin: '0 0 1rem', color: '#555', lineHeight: 1.6 }}>
              Price varies by usage tier. Lower rates at higher volumes.
            </p>
            <div style={{
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.875rem',
            }}>
              <div style={{ color: '#6b7280' }}>Example:</div>
              <div>1-100: $0.10/unit</div>
              <div>101-500: $0.08/unit</div>
              <div style={{ fontWeight: 600 }}>501+: $0.05/unit</div>
            </div>
          </div>

          {/* Package */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f3e8ff',
                color: '#9333ea',
                borderRadius: '0.5rem',
                fontSize: '1.25rem',
              }}>
                ⊞
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Package</h3>
                <code style={{ fontSize: '0.75rem', color: '#6b7280' }}>pricing_model: "package"</code>
              </div>
            </div>
            <p style={{ margin: '0 0 1rem', color: '#555', lineHeight: 1.6 }}>
              Bundled units at fixed price. Overage charged per additional bundle.
            </p>
            <div style={{
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.875rem',
            }}>
              <div style={{ color: '#6b7280' }}>Example:</div>
              <div style={{ fontWeight: 600 }}>$50 per 1,000 API calls</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>When to Use Each Model</div>
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Model</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Best For</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Example Use Case</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>Flat</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#555' }}>Simple subscriptions</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>SaaS starter plans, streaming services</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>Per Unit</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#555' }}>Seat-based pricing</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>Team collaboration tools, CRM licenses</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>Tiered</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#555' }}>Usage-based with volume discounts</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>API calls, email sends, storage</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', fontWeight: 500 }}>Package</td>
                <td style={{ padding: '1rem', color: '#555' }}>Prepaid bundles</td>
                <td style={{ padding: '1rem', color: '#6b7280' }}>Credits packs, SMS bundles</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Schema and mechanics
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Schema fields and currency handling
      </h2>

      {/* Currency Handling */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Currency Handling: Minor Units</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Billable stores prices in <strong>minor currency units</strong> (cents, pence, etc.)
          to avoid floating-point precision issues:
        </p>
        <pre style={STYLES.codeBlock}>
{`// Store in minor units (cents for USD)
{
  amount_minor: 9900,    // Not 99.00
  currency: "usd"
}

// Convert for display
const displayPrice = amount_minor / 100;  // 99.00

// Decimal precision varies by currency
{
  "usd": 2,  // $99.99 → 9999 minor units
  "eur": 2,  // €89.99 → 8999 minor units
  "jpy": 0   // ¥1500 → 1500 minor units (no decimals)
}`}
        </pre>
      </section>

      {/* Interval Calculation */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Interval Calculation</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Combine <code>billing_interval</code> and <code>interval_count</code> for flexible cadences:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem' }}>monthly × 1</code>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>= Monthly</span>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem' }}>monthly × 3</code>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>= Quarterly</span>
          </div>
          <div style={{ padding: '1rem', background: '#fff', borderRadius: '0.5rem', textAlign: 'center' }}>
            <code style={{ display: 'block', marginBottom: '0.5rem' }}>monthly × 12</code>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>= Annual</span>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Quarterly billing
{
  billing_interval: "monthly",
  interval_count: 3
}

// Semi-annual billing
{
  billing_interval: "monthly",
  interval_count: 6
}`}
        </pre>
      </section>

      {/* Schema Summary */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Complete Schema</div>
        <pre style={STYLES.codeBlock}>
{`// Billable trait fields
{
  // Required
  plan_code: string,        // "pro_monthly"
  plan_name: string,        // "Pro"
  billing_interval: string, // "monthly" | "quarterly" | "annual"
  amount_minor: integer,    // 9900 (= $99.00)
  currency: string,         // "usd"

  // Optional
  interval_count: integer,       // 1 (default)
  trial_period_days: integer,    // 14
  collection_method: string,     // "charge_automatically" | "send_invoice"
  billing_anchor_day: integer,   // 1-31
  pricing_model: string          // "flat" | "per_unit" | "tiered" | "package"
}

// Trait parameters (configure at domain level)
{
  defaultCurrency: "usd",
  supportedIntervals: ["monthly", "quarterly", "annual"],
  decimalPrecision: 2
}`}
        </pre>
      </section>

      {/* Cross-link */}
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
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>See Billable in Context</h3>
            <p style={{ margin: 0, color: '#555', fontSize: '0.9375rem' }}>
              Learn how Billable works with Subscription, Invoice, and other SaaS objects.
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
            SaaS Billing Flow →
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
  title: 'Traits/Domain/Billable',
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

// 2. Plan Gallery — Visual showcase
export const PlanGallery: Story = {
  name: '2. Plan Gallery',
  render: () => <PlanGalleryStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. Pricing Models — The 4 strategies
export const PricingModels: Story = {
  name: '3. Pricing Models',
  render: () => <PricingModelsStory />,
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
