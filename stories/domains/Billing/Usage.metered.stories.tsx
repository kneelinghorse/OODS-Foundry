/**
 * Usage-Based Billing Stories
 * 
 * Demonstrates metered billing with usage events, aggregation,
 * and invoice integration.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DateTime } from 'luxon';
import React from 'react';
import type { CanonicalSubscription, CanonicalInvoice } from '../../../src/domain/billing/core.js';
import type { UsageEvent, UsageSummary } from '../../../src/domain/billing/usage.js';

/**
 * Usage Dashboard Component
 */
interface UsageDashboardProps {
  subscription: CanonicalSubscription;
  events: UsageEvent[];
  summary: UsageSummary;
  invoice: CanonicalInvoice;
  transitions?: Array<{ label: string; states: string[] }>;
}

const UsageDashboard: React.FC<UsageDashboardProps> = ({
  subscription,
  events,
  summary,
  invoice,
  transitions,
}) => {
  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>
          Usage-Based Billing Dashboard
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#666' }}>
          Subscription: {subscription.subscriptionId}
        </p>
      </div>
      
      {/* Subscription Overview */}
      <div style={{
        padding: '1.5rem',
        background: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
          Subscription Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Plan</div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>{subscription.plan.planName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Status</div>
            <div style={{ fontSize: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>
              {subscription.status}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Meter</div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>{subscription.usage?.meterName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Included Quantity</div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>
              {subscription.usage?.includedQuantity.toLocaleString()} {subscription.usage?.unitLabel}
            </div>
          </div>
        </div>
      </div>
      
      {/* Canonical State Timeline */}
      {transitions && transitions.length > 0 && (
        <div style={{
          padding: '1.5rem',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
            Canonical State Timeline
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {transitions.map((transition) => (
              <div key={transition.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {transition.label}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {transition.states.join(' → ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Usage Summary */}
      <div style={{
        padding: '1.5rem',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
          Usage Summary
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Usage</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1976d2' }}>
              {summary.totalQuantity.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>{summary.unit}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Events</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {summary.eventCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Average</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {summary.avgQuantity.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>per event</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Range</div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>
              {summary.minQuantity.toFixed(2)} - {summary.maxQuantity.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Events */}
      <div style={{
        padding: '1.5rem',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
          Recent Usage Events
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#666' }}>
                  Timestamp
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#666' }}>
                  Meter
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#666' }}>
                  Quantity
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#666' }}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 10).map((event) => (
                <tr key={event.eventId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {new Date(event.recordedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {event.meterName}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 500 }}>
                    {event.quantity.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {event.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Invoice Preview */}
      {invoice.usageLineItems && invoice.usageLineItems.length > 0 && (
        <div style={{
          padding: '1.5rem',
          background: '#f9fafb',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
            Invoice Preview
          </h2>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Invoice: {invoice.invoiceNumber}</div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Period: {new Date(subscription.currentPeriod.start).toLocaleDateString()} - {new Date(subscription.currentPeriod.end).toLocaleDateString()}
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#666' }}>
                  Description
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#666' }}>
                  Quantity
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#666' }}>
                  Rate
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#666' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.usageLineItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    {item.description}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right' }}>
                    {item.quantity.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right' }}>
                    {formatAmount(item.unitRateMinor, invoice.currency)}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 500 }}>
                    {formatAmount(item.totalMinor, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '2px solid #e0e0e0',
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Total: {formatAmount(invoice.totalMinor, invoice.currency)}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Due: {new Date(invoice.dueAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function (duplicated for story isolation)
function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(major);
}

const meta: Meta<typeof UsageDashboard> = {
  title: 'Domains/Billing/Usage-Based',
  component: UsageDashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UsageDashboard>;

/**
 * API Calls Metered Subscription
 */
export const APICallsMetered: Story = {
  name: 'Detail – API usage dashboard',
  args: {
    transitions: [
      {
        label: 'Subscription',
        states: ['trialing', 'active'],
      },
      {
        label: 'Invoice',
        states: ['draft', 'posted', 'paid'],
      },
    ],
    subscription: {
      subscriptionId: 'sub_api_metered_001',
      accountId: 'acc_startup_tech',
      status: 'active',
      plan: {
        planCode: 'api_metered',
        planName: 'API Metered Plan',
        billingInterval: 'monthly',
        intervalCount: 1,
        amountMinor: 4900, // $49/month base
        currency: 'USD',
        trialPeriodDays: 0,
      },
      currentPeriod: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      usage: {
        meterName: 'api_calls',
        includedQuantity: 10000,
        consumedQuantity: 15000,
        unitLabel: 'calls',
        rolloverStrategy: 'none',
        overageRateMinor: 5, // $0.05 per call
        projectedOverageMinor: 25000, // 5000 × $0.05
      },
      collectionMethod: 'charge_automatically',
      tenantId: 'tenant_001',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
      business_time: DateTime.fromISO('2025-01-01T00:00:00Z'),
      system_time: DateTime.fromISO('2025-01-15T00:00:00Z'),
    },
    events: Array.from({ length: 50 }, (_, i) => ({
      eventId: `evt_api_${i}`,
      subscriptionId: 'sub_api_metered_001',
      tenantId: 'tenant_001',
      meterName: 'api_calls',
      unit: 'api_calls' as const,
      quantity: Math.floor(Math.random() * 500) + 100,
      recordedAt: new Date(2025, 0, 1 + Math.floor(i / 3), Math.floor(Math.random() * 24)).toISOString(),
      source: ['api_gateway', 'webhook'][Math.floor(Math.random() * 2)] as 'api_gateway' | 'webhook',
      metadata: {
        endpoint: `/api/v1/endpoint${Math.floor(Math.random() * 5)}`,
        region: 'us-east-1',
      },
      createdAt: new Date(2025, 0, 1 + Math.floor(i / 3)).toISOString(),
    })),
    summary: {
      summaryId: 'sum_sub_api_metered_001_api_calls_2025-01-01',
      subscriptionId: 'sub_api_metered_001',
      tenantId: 'tenant_001',
      meterName: 'api_calls',
      unit: 'api_calls',
      period: 'monthly',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-02-01T00:00:00Z',
      totalQuantity: 15000,
      eventCount: 50,
      minQuantity: 100,
      maxQuantity: 600,
      avgQuantity: 300,
      aggregatedAt: '2025-01-31T23:59:00Z',
      createdAt: '2025-01-31T23:59:00Z',
      business_time: DateTime.fromISO('2025-02-01T00:00:00Z'),
      system_time: DateTime.fromISO('2025-01-31T23:59:00Z'),
    },
    invoice: {
      invoiceId: 'inv_001',
      invoiceNumber: 'INV-2025-001',
      subscriptionId: 'sub_api_metered_001',
      status: 'posted',
      issuedAt: '2025-02-01T00:00:00Z',
      dueAt: '2025-02-15T00:00:00Z',
      totalMinor: 29900, // $49 + $250 overage
      balanceMinor: 29900,
      currency: 'USD',
      paymentTerms: 'Net 15',
      taxMinor: 0,
      discountMinor: 0,
      subtotalMinor: 29900,
      lineItems: [],
      attachments: [],
      tenantId: 'tenant_001',
      createdAt: '2025-02-01T00:00:00Z',
      updatedAt: '2025-02-01T00:00:00Z',
      business_time: DateTime.fromISO('2025-02-15T00:00:00Z'),
      system_time: DateTime.fromISO('2025-02-01T00:00:00Z'),
      usageLineItems: [
        {
          id: 'li_base',
          description: 'API Metered Plan - Monthly',
          meterName: 'base_fee',
          unit: 'units',
          quantity: 1,
          unitRateMinor: 4900,
          totalMinor: 4900,
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2025-02-01T00:00:00Z',
          summaryId: 'base',
          createdAt: '2025-02-01T00:00:00Z',
        },
        {
          id: 'li_usage',
          description: 'API Calls - Overage (5,000 calls @ $0.05/call)',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 5000,
          unitRateMinor: 5,
          totalMinor: 25000,
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2025-02-01T00:00:00Z',
          summaryId: 'sum_sub_api_metered_001_api_calls_2025-01-01',
          createdAt: '2025-02-01T00:00:00Z',
        },
      ],
    },
  },
};

export const APICallsLeaderboard: Story = {
  name: 'List – Tenant usage leaderboard',
  args: {
    ...APICallsMetered.args,
    events: APICallsMetered.args?.events?.slice(0, 20) ?? [],
  },
  parameters: {
    docs: {
      description: {
        story: 'List view concentrates on the top usage events for quick comparisons across tenants and meters.',
      },
    },
  },
};

export const UsageAlertForm: Story = {
  name: 'Form – Configure usage anomaly alert',
  args: {
    ...APICallsMetered.args,
  },
  parameters: {
    docs: {
      description: {
        story: 'Form context demonstrates the configuration surface for alerting on projected overages.',
      },
    },
  },
};

/**
 * Compute Hours with High Usage
 */
export const ComputeHoursHeavyUse: Story = {
  name: 'Timeline – Compute hours anomaly',
  args: {
    transitions: [
      {
        label: 'Subscription',
        states: ['active', 'delinquent', 'active'],
      },
      {
        label: 'Invoice',
        states: ['draft', 'posted', 'payment_failed', 'posted'],
      },
    ],
    subscription: {
      subscriptionId: 'sub_compute_001',
      accountId: 'acc_analytics_co',
      status: 'active',
      plan: {
        planCode: 'compute_metered',
        planName: 'Compute Metered',
        billingInterval: 'monthly',
        intervalCount: 1,
        amountMinor: 9900,
        currency: 'USD',
        trialPeriodDays: 0,
      },
      currentPeriod: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      usage: {
        meterName: 'compute_hours',
        includedQuantity: 100,
        consumedQuantity: 450,
        unitLabel: 'hours',
        rolloverStrategy: 'none',
        overageRateMinor: 50, // $0.50/hour
        projectedOverageMinor: 17500,
      },
      collectionMethod: 'charge_automatically',
      tenantId: 'tenant_002',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
      business_time: DateTime.fromISO('2025-01-01T00:00:00Z'),
      system_time: DateTime.fromISO('2025-01-20T00:00:00Z'),
    },
    events: Array.from({ length: 30 }, (_, i) => ({
      eventId: `evt_compute_${i}`,
      subscriptionId: 'sub_compute_001',
      tenantId: 'tenant_002',
      meterName: 'compute_hours',
      unit: 'compute_hours' as const,
      quantity: Math.floor(Math.random() * 20) + 5,
      recordedAt: new Date(2025, 0, 1 + i, Math.floor(Math.random() * 24)).toISOString(),
      source: 'background_job' as const,
      metadata: {
        service: 'batch-processor',
        region: 'us-west-2',
      },
      createdAt: new Date(2025, 0, 1 + i).toISOString(),
    })),
    summary: {
      summaryId: 'sum_sub_compute_001_compute_hours_2025-01-01',
      subscriptionId: 'sub_compute_001',
      tenantId: 'tenant_002',
      meterName: 'compute_hours',
      unit: 'compute_hours',
      period: 'monthly',
      periodStart: '2025-01-01T00:00:00Z',
      periodEnd: '2025-02-01T00:00:00Z',
      totalQuantity: 450,
      eventCount: 30,
      minQuantity: 5,
      maxQuantity: 25,
      avgQuantity: 15,
      aggregatedAt: '2025-01-31T23:59:00Z',
      createdAt: '2025-01-31T23:59:00Z',
      business_time: DateTime.fromISO('2025-02-01T00:00:00Z'),
      system_time: DateTime.fromISO('2025-01-31T23:59:00Z'),
    },
    invoice: {
      invoiceId: 'inv_002',
      invoiceNumber: 'INV-2025-002',
      subscriptionId: 'sub_compute_001',
      status: 'posted',
      issuedAt: '2025-02-01T00:00:00Z',
      dueAt: '2025-02-15T00:00:00Z',
      totalMinor: 27400,
      balanceMinor: 27400,
      currency: 'USD',
      paymentTerms: 'Net 15',
      taxMinor: 0,
      discountMinor: 0,
      subtotalMinor: 27400,
      lineItems: [],
      attachments: [],
      tenantId: 'tenant_002',
      createdAt: '2025-02-01T00:00:00Z',
      updatedAt: '2025-02-01T00:00:00Z',
      business_time: DateTime.fromISO('2025-02-15T00:00:00Z'),
      system_time: DateTime.fromISO('2025-02-01T00:00:00Z'),
      usageLineItems: [
        {
          id: 'li_base_compute',
          description: 'Compute Metered - Monthly',
          meterName: 'base_fee',
          unit: 'units',
          quantity: 1,
          unitRateMinor: 9900,
          totalMinor: 9900,
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2025-02-01T00:00:00Z',
          summaryId: 'base',
          createdAt: '2025-02-01T00:00:00Z',
        },
        {
          id: 'li_usage_compute',
          description: 'Compute Hours - Overage (350 hours @ $0.50/hour)',
          meterName: 'compute_hours',
          unit: 'compute_hours',
          quantity: 350,
          unitRateMinor: 50,
          totalMinor: 17500,
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2025-02-01T00:00:00Z',
          summaryId: 'sum_sub_compute_001_compute_hours_2025-01-01',
          createdAt: '2025-02-01T00:00:00Z',
        },
      ],
    },
  },
};
