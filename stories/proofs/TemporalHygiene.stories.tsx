/**
 * Temporal Hygiene Proofs
 * 
 * Demonstrates dual-time model (business_time vs system_time)
 * across billing scenarios with timezone-aware displays.
 * 
 * See: docs/policies/time.md
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DateTime } from 'luxon';
import TimeService, { type Tenant } from '../../src/services/time';
import type { CanonicalInvoice, CanonicalSubscription } from '../../src/domain/billing/core';

const meta = {
  title: 'Explorer/Proofs/Temporal Hygiene',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Temporal hygiene proof stories demonstrating:

- **Dual-time model**: Every entity has business_time (tenant-relative) and system_time (UTC audit trail)
- **Timezone handling**: Displays in tenant timezone while storing UTC
- **DST resilience**: Billing periods respect tenant calendar boundaries
- **Audit integrity**: System time provides immutable ordering

See \`docs/policies/time.md\` for full specification.
        `,
      },
    },
  },
  tags: ['vrt-critical'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Mock tenants
const tenantPacific: Tenant = {
  id: 'acme-corp',
  timezone: 'America/Los_Angeles',
};

const tenantEastern: Tenant = {
  id: 'globex-inc',
  timezone: 'America/New_York',
};

const tenantLondon: Tenant = {
  id: 'umbrella-ltd',
  timezone: 'Europe/London',
};

/**
 * Invoice Due Date Display
 * 
 * Shows invoice due dates in tenant timezone while maintaining
 * UTC system timestamp for audit.
 */
export const InvoiceDueDates: Story = {
  render: () => {
    const systemTime = DateTime.fromISO('2025-10-25T16:00:00Z');
    
    const invoices: Array<CanonicalInvoice & { tenant: Tenant }> = [
      createMockInvoice('INV-001', tenantPacific, systemTime),
      createMockInvoice('INV-002', tenantEastern, systemTime),
      createMockInvoice('INV-003', tenantLondon, systemTime),
    ];

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Invoice Due Dates (Dual-Time Display)</h2>
        <p className="text-sm text-gray-600">
          System recorded all invoices at the same UTC moment, but each displays
          in the tenant's timezone for accurate aging calculations.
        </p>
        
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div key={invoice.invoiceNumber} className="border rounded p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{invoice.invoiceNumber}</div>
                  <div className="text-sm text-gray-600">{invoice.tenant.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    Due: {TimeService.formatForTenant(invoice.business_time, invoice.tenant, 'MMM dd, yyyy')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {TimeService.displayInTenantZone(invoice.business_time, invoice.tenant)}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                <div>System recorded: {invoice.system_time.toISO()}</div>
                <div className="text-[10px] mt-1">
                  Tenant TZ: {invoice.tenant.timezone}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Billing Period Boundaries
 * 
 * Demonstrates monthly billing periods calculated in tenant timezone
 * to ensure accurate "same day" invoice generation across timezones.
 */
export const BillingPeriodBoundaries: Story = {
  render: () => {
    const periods = [
      { tenant: tenantPacific, label: 'Pacific Time' },
      { tenant: tenantEastern, label: 'Eastern Time' },
      { tenant: tenantLondon, label: 'London Time' },
    ].map(({ tenant, label }) => {
      const [start, end] = TimeService.billingPeriod(2025, 11, tenant);
      return { tenant, label, start, end };
    });

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">November 2025 Billing Periods</h2>
        <p className="text-sm text-gray-600">
          Each tenant's billing month starts at local midnight and ends at local end-of-month.
          Note the UTC offsets differ, but business days align.
        </p>
        
        <div className="grid gap-4">
          {periods.map(({ tenant, label, start, end }) => (
            <div key={tenant.id} className="border rounded p-4">
              <div className="font-semibold mb-2">{label} ({tenant.id})</div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Period Start:</span>
                  <span className="font-mono">
                    {start.toFormat('MMM dd, yyyy HH:mm ZZZZ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Period End:</span>
                  <span className="font-mono">
                    {end.toFormat('MMM dd, yyyy HH:mm ZZZZ')}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">UTC Start:</span>
                  <span className="font-mono text-xs">{start.toUTC().toISO()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">UTC End:</span>
                  <span className="font-mono text-xs">{end.toUTC().toISO()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Subscription Lifecycle Events
 * 
 * Shows subscription state changes with dual timestamps for
 * business analytics (tenant time) and system audit (UTC).
 */
export const SubscriptionLifecycle: Story = {
  render: () => {
    const events = [
      {
        action: 'Trial Started',
        businessTime: DateTime.fromISO('2025-10-01T00:00:00', { zone: 'America/Los_Angeles' }),
        systemTime: DateTime.fromISO('2025-10-01T07:00:00Z'),
      },
      {
        action: 'Trial Ending Soon',
        businessTime: DateTime.fromISO('2025-10-14T00:00:00', { zone: 'America/Los_Angeles' }),
        systemTime: DateTime.fromISO('2025-10-14T07:00:00Z'),
      },
      {
        action: 'Converted to Paid',
        businessTime: DateTime.fromISO('2025-10-15T09:23:00', { zone: 'America/Los_Angeles' }),
        systemTime: DateTime.fromISO('2025-10-15T16:23:00Z'),
      },
      {
        action: 'First Renewal',
        businessTime: DateTime.fromISO('2025-11-15T00:00:00', { zone: 'America/Los_Angeles' }),
        systemTime: DateTime.fromISO('2025-11-15T08:00:00Z'),
      },
    ];

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Subscription Timeline (Acme Corp - Pacific Time)</h2>
        <p className="text-sm text-gray-600">
          Business events align to tenant calendar, while system time maintains audit ordering.
        </p>
        
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          
          <div className="space-y-4">
            {events.map((event, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <div className="relative z-10 w-4 h-4 mt-1 bg-blue-600 rounded-full border-2 border-white" />
                
                <div className="flex-1 border rounded p-3">
                  <div className="font-semibold">{event.action}</div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-500">Business Time</div>
                      <div className="font-mono mt-1">
                        {event.businessTime.toFormat('MMM dd, yyyy HH:mm')}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {event.businessTime.zoneName}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-gray-500">System Time</div>
                      <div className="font-mono mt-1">
                        {event.systemTime.toFormat('MMM dd, yyyy HH:mm')}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">UTC</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

/**
 * DST Transition Handling
 * 
 * Proves that billing periods remain stable across DST transitions.
 */
export const DSTTransition: Story = {
  render: () => {
    const tenant = tenantEastern; // New York observes DST
    
    // March 2025: DST starts on March 9
    const [marchStart, marchEnd] = TimeService.billingPeriod(2025, 3, tenant);
    
    // November 2025: DST ends on November 2
    const [novStart, novEnd] = TimeService.billingPeriod(2025, 11, tenant);

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">DST Transition Resilience</h2>
        <p className="text-sm text-gray-600">
          Billing periods in New York remain stable across DST transitions.
          March gains an hour (spring forward), November loses an hour (fall back).
        </p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded p-4">
            <div className="font-semibold mb-3">March 2025 (DST Starts Mar 9)</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Start:</span>{' '}
                <span className="font-mono">{marchStart.toFormat('MMM dd HH:mm ZZZZ')}</span>
              </div>
              <div>
                <span className="text-gray-600">End:</span>{' '}
                <span className="font-mono">{marchEnd.toFormat('MMM dd HH:mm ZZZZ')}</span>
              </div>
              <div className="pt-2 border-t text-xs text-gray-500">
                Period duration: {formatDuration(marchStart, marchEnd)}
              </div>
            </div>
          </div>
          
          <div className="border rounded p-4">
            <div className="font-semibold mb-3">November 2025 (DST Ends Nov 2)</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Start:</span>{' '}
                <span className="font-mono">{novStart.toFormat('MMM dd HH:mm ZZZZ')}</span>
              </div>
              <div>
                <span className="text-gray-600">End:</span>{' '}
                <span className="font-mono">{novEnd.toFormat('MMM dd HH:mm ZZZZ')}</span>
              </div>
              <div className="pt-2 border-t text-xs text-gray-500">
                Period duration: {formatDuration(novStart, novEnd)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <strong>Note:</strong> TimeService handles DST transitions transparently via Luxon.
          Business day boundaries remain stable regardless of wall-clock adjustments.
        </div>
      </div>
    );
  },
};

// Helper: Create mock invoice
function createMockInvoice(
  number: string,
  tenant: Tenant,
  systemTime: DateTime
): CanonicalInvoice & { tenant: Tenant } {
  const businessTime = systemTime.setZone(tenant.timezone);
  const dueDate = businessTime.plus({ days: 30 });

  return {
    invoiceId: `inv_${number.toLowerCase()}`,
    invoiceNumber: number,
    subscriptionId: 'sub_test',
    status: 'draft',
    issuedAt: businessTime.toISO()!,
    dueAt: dueDate.toISO()!,
    totalMinor: 9900,
    balanceMinor: 9900,
    currency: 'USD',
    paymentTerms: 'Net 30',
    taxMinor: 0,
    discountMinor: 0,
    subtotalMinor: 9900,
    lineItems: [],
    attachments: [],
    business_time: dueDate,
    system_time: systemTime,
    createdAt: systemTime.toISO()!,
    updatedAt: systemTime.toISO()!,
    tenant,
  };
}

// Helper: Format duration
function formatDuration(start: DateTime, end: DateTime): string {
  const diff = end.diff(start, ['days', 'hours']);
  return `${Math.floor(diff.days)} days, ${Math.floor(diff.hours % 24)} hours`;
}
