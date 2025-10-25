/**
 * Billing Event Ingestion Service Tests
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import type { BillingAdapter, ProviderName } from '../../../src/integrations/billing/adapter.js';
import type { BillingEvent } from '../../../src/domain/billing/events.js';
import { BillingEventIngestionService } from '../../../src/services/billing/event-ingestion.js';
import { BillingEventsRouter } from '../../../src/domain/billing/events.js';
import { AuditLogService } from '../../../src/services/compliance/audit-service.js';
import { TenancyContext } from '../../../src/services/tenancy/tenancy-context.js';

const invoiceBusinessTime = DateTime.fromISO('2025-02-15T00:00:00Z');
const invoiceSystemTime = DateTime.fromISO('2025-02-01T00:00:00Z');

const canonicalEvent: BillingEvent = {
  eventId: 'evt_canonical',
  type: 'invoice.payment_succeeded',
  severity: 'info',
  timestamp: new Date().toISOString(),
  provider: {
    name: 'stripe',
    eventId: 'evt_raw',
    eventType: 'invoice.payment_succeeded',
  },
  data: {
    objectType: 'invoice',
    object: {
      invoiceId: 'inv_canonical',
      invoiceNumber: 'INV-001',
      subscriptionId: 'sub_canonical',
      status: 'paid',
      issuedAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      totalMinor: 1000,
      balanceMinor: 0,
      currency: 'usd',
      paymentTerms: 'net_30',
      taxMinor: 0,
      discountMinor: 0,
      subtotalMinor: 1000,
      lineItems: [],
      attachments: [],
      createdAt: invoiceSystemTime.toISO(),
      updatedAt: invoiceSystemTime.toISO(),
      business_time: invoiceBusinessTime,
      system_time: invoiceSystemTime,
    },
  },
};

afterEach(() => {
  TenancyContext.setCurrentTenant(null);
});

describe('BillingEventIngestionService', () => {
  it('ingests events through adapter, router, and audit log', async () => {
    const translateEvent = vi.fn(
      (_raw: unknown, tenantId?: string) =>
        ({
          ...canonicalEvent,
          tenantId,
        }) satisfies BillingEvent
    );

    const adapter: BillingAdapter = {
      providerName: 'stripe',
      translateSubscription: vi.fn(),
      translateInvoice: vi.fn(),
      translatePaymentIntent: vi.fn(),
      translateEvent,
    };

    const router = new BillingEventsRouter();
    const handler = vi.fn(async (event: BillingEvent) => ({
      eventId: event.eventId,
      status: 'accepted',
      processedAt: new Date().toISOString(),
      actions: ['handled'],
    }));

    router.subscribe({
      id: 'test-handler',
      eventTypes: ['invoice.payment_succeeded'],
      handler,
    });

    const auditService = new AuditLogService();
    const ingestionService = new BillingEventIngestionService({
      adapters: { stripe: adapter },
      router,
      auditService,
    });

    const result = await ingestionService.ingest(
      'stripe',
      { id: 'evt_raw' },
      {
        tenantId: 'tenant-123',
        actorId: 'svc.billing',
        metadata: { source: 'unit-test' },
      }
    );

    expect(translateEvent).toHaveBeenCalledWith({ id: 'evt_raw' }, 'tenant-123');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.ingestion.status).toBe('accepted');
    expect(result.event.tenantId).toBe('tenant-123');
    expect(result.auditEntry.tenantId).toBe('tenant-123');
    expect(result.auditEntry.action).toBe('billing.event.ingested');
    expect(result.auditEntry.actorId).toBe('svc.billing');

    const auditEntries = auditService.export({ tenantId: 'tenant-123' });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].metadata?.provider).toBe('stripe');
    expect(auditEntries[0].metadata?.source).toBe('unit-test');
  });

  it('derives tenant from TenancyContext when not provided explicitly', async () => {
    TenancyContext.setCurrentTenant('tenant-from-context');

    const translateEvent = vi.fn(
      (_raw: unknown, tenantId?: string) =>
        ({
          ...canonicalEvent,
          tenantId,
        }) satisfies BillingEvent
    );

    const adapter: BillingAdapter = {
      providerName: 'stripe',
      translateSubscription: vi.fn(),
      translateInvoice: vi.fn(),
      translatePaymentIntent: vi.fn(),
      translateEvent,
    };

    const ingestionService = new BillingEventIngestionService({
      adapters: { stripe: adapter },
    });

    const result = await ingestionService.ingest('stripe', { id: 'evt_raw' });

    expect(translateEvent).toHaveBeenCalledWith({ id: 'evt_raw' }, 'tenant-from-context');
    expect(result.event.tenantId).toBe('tenant-from-context');
    expect(result.auditEntry.tenantId).toBe('tenant-from-context');
  });

  it('throws when provider adapter is missing', async () => {
    const ingestionService = new BillingEventIngestionService();

    await expect(
      ingestionService.ingest('manual' as unknown as ProviderName, { id: 'evt_raw' })
    ).rejects.toThrow('No billing adapter registered for provider: manual');
  });
});
