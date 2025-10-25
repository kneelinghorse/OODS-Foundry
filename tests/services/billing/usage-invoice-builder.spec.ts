/**
 * Usage Invoice Builder Integration Tests
 *
 * Verifies that usage summaries flow from the aggregator into canonical
 * invoices with proper tenancy isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { UsageAggregator } from '../../../src/services/billing/usage-aggregator.js';
import { UsageInvoiceBuilder } from '../../../src/services/billing/invoice-builder.js';
import {
  InMemoryUsageEventRepository,
  InMemoryUsageSummaryRepository,
} from '../../../src/services/billing/usage-repositories.js';
import type { UsageEventInput } from '../../../src/domain/billing/usage.js';
import type { CanonicalInvoice, CanonicalSubscription } from '../../../src/domain/billing/core.js';

const FIXED_NOW = new Date('2025-02-01T00:00:00Z');

describe('UsageInvoiceBuilder', () => {
  let eventRepo: InMemoryUsageEventRepository;
  let summaryRepo: InMemoryUsageSummaryRepository;
  let aggregator: UsageAggregator;
  let builder: UsageInvoiceBuilder;

  beforeEach(() => {
    eventRepo = new InMemoryUsageEventRepository();
    summaryRepo = new InMemoryUsageSummaryRepository();
    aggregator = new UsageAggregator({
      eventRepository: eventRepo,
      summaryRepository: summaryRepo,
      clock: () => FIXED_NOW,
    });
    builder = new UsageInvoiceBuilder({
      summaryRepository: summaryRepo,
      clock: () => FIXED_NOW,
    });
  });

  it('attaches metered usage line items and updates invoice totals', async () => {
    const tenantId = 'tenant-alpha';
    const subscriptionId = 'sub_metered_alpha';

    const usageEvents: UsageEventInput[] = [
      {
        tenantId,
        subscriptionId,
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 600,
        recordedAt: '2025-01-01T06:00:00Z',
        source: 'api_gateway',
      },
      {
        tenantId,
        subscriptionId,
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 400,
        recordedAt: '2025-01-01T12:00:00Z',
        source: 'api_gateway',
      },
      {
        tenantId,
        subscriptionId,
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 300,
        recordedAt: '2025-01-01T18:00:00Z',
        source: 'api_gateway',
      },
    ];

    // Cross-tenant noise to ensure isolation
    await aggregator.recordEvent({
      tenantId: 'tenant-beta',
      subscriptionId: 'sub_other',
      meterName: 'api_calls',
      unit: 'api_calls',
      quantity: 999,
      recordedAt: '2025-01-01T09:00:00Z',
      source: 'api_gateway',
    });

    await aggregator.recordEvents(usageEvents);

    await aggregator.aggregate(
      {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-02T00:00:00Z',
      },
      {
        period: 'daily',
        tenantId,
      }
    );

    const invoiceBusinessTime = DateTime.fromISO('2025-02-15T00:00:00Z');
    const invoiceSystemTime = DateTime.fromISO('2025-02-01T00:00:00Z');

    const baseInvoice: CanonicalInvoice = {
      invoiceId: 'inv-alpha',
      invoiceNumber: 'INV-ALPHA-001',
      subscriptionId,
      status: 'posted',
      issuedAt: '2025-02-01T00:00:00Z',
      dueAt: '2025-02-15T00:00:00Z',
      totalMinor: 4900,
      balanceMinor: 4900,
      currency: 'USD',
      paymentTerms: 'Net 15',
      taxMinor: 0,
      discountMinor: 0,
      subtotalMinor: 4900,
      lineItems: [
        {
          id: 'li-base',
          description: 'API Metered Plan - Base',
          quantity: 1,
          amountMinor: 4900,
          unitAmountMinor: 4900,
          productCode: 'api_base',
          planInterval: 'monthly',
        },
      ],
      attachments: [],
      createdAt: invoiceSystemTime.toISO(),
      updatedAt: invoiceSystemTime.toISO(),
      business_time: invoiceBusinessTime,
      system_time: invoiceSystemTime,
    };

    const subscriptionBusiness = DateTime.fromISO('2024-12-01T00:00:00Z');
    const subscriptionSystem = DateTime.fromISO('2024-12-15T00:00:00Z');

    const subscription: CanonicalSubscription = {
      subscriptionId,
      accountId: 'acct-alpha',
      status: 'active',
      plan: {
        planCode: 'api_metered',
        planName: 'API Metered',
        billingInterval: 'monthly',
        intervalCount: 1,
        amountMinor: 4900,
        currency: 'USD',
        trialPeriodDays: 0,
      },
      currentPeriod: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      collectionMethod: 'charge_automatically',
      usage: {
        meterName: 'api_calls',
        includedQuantity: 1000,
        consumedQuantity: 0,
        unitLabel: 'calls',
        rolloverStrategy: 'none',
        overageRateMinor: 5,
        projectedOverageMinor: 0,
      },
      tenantId,
      createdAt: subscriptionBusiness.toISO(),
      updatedAt: subscriptionSystem.toISO(),
      business_time: subscriptionBusiness,
      system_time: subscriptionSystem,
    };

    const enriched = await builder.attachUsage(baseInvoice, subscription);

    expect(enriched.usageSummaries?.length).toBeGreaterThan(0);
    expect(enriched.usageLineItems).toHaveLength(1);
    const [usageItem] = enriched.usageLineItems ?? [];
    expect(usageItem?.meterName).toBe('api_calls');
    expect(usageItem?.quantity).toBe(1300);
    expect(usageItem?.totalMinor).toBe(1500); // 300 overage × $0.05 = $15.00

    expect(enriched.subtotalMinor).toBe(6400);
    expect(enriched.totalMinor).toBe(6400);
    expect(enriched.balanceMinor).toBe(6400);

    const usageLine = enriched.lineItems.find((item) => item?.id === usageItem?.id);
    expect(usageLine?.amountMinor).toBe(usageItem?.totalMinor);
    expect(usageLine?.unitAmountMinor).toBe(usageItem?.unitRateMinor);
  });

  it('maintains tenancy isolation when attaching usage to invoices', async () => {
    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    await aggregator.recordEvents([
      {
        tenantId: tenantA,
        subscriptionId: 'sub-a',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 500,
        recordedAt: '2025-01-05T03:00:00Z',
        source: 'api_gateway',
      },
      {
        tenantId: tenantB,
        subscriptionId: 'sub-b',
        meterName: 'storage_gb',
        unit: 'storage_gb',
        quantity: 200,
        recordedAt: '2025-01-05T04:00:00Z',
        source: 'background_job',
      },
    ]);

    await aggregator.aggregate(
      {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      { tenantId: tenantA, period: 'monthly' }
    );

    await aggregator.aggregate(
      {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      { tenantId: tenantB, period: 'monthly' }
    );

    const invoiceABusiness = DateTime.fromISO('2025-02-10T00:00:00Z');
    const invoiceASystem = DateTime.fromISO('2025-02-01T00:00:00Z');

    const invoiceA: CanonicalInvoice = {
      invoiceId: 'inv-a',
      invoiceNumber: 'INV-A-001',
      subscriptionId: 'sub-a',
      status: 'posted',
      issuedAt: '2025-02-01T00:00:00Z',
      dueAt: '2025-02-10T00:00:00Z',
      totalMinor: 1000,
      balanceMinor: 1000,
      currency: 'USD',
      paymentTerms: 'Net 10',
      taxMinor: 0,
      discountMinor: 0,
      subtotalMinor: 1000,
      lineItems: [],
      attachments: [],
      createdAt: invoiceASystem.toISO(),
      updatedAt: invoiceASystem.toISO(),
      business_time: invoiceABusiness,
      system_time: invoiceASystem,
    };

    const invoiceB: CanonicalInvoice = {
      ...invoiceA,
      invoiceId: 'inv-b',
      invoiceNumber: 'INV-B-001',
      subscriptionId: 'sub-b',
    };

    const subscriptionABusiness = DateTime.fromISO('2025-01-01T00:00:00Z');
    const subscriptionASystem = DateTime.fromISO('2025-01-10T00:00:00Z');

    const subscriptionA: CanonicalSubscription = {
      subscriptionId: 'sub-a',
      accountId: 'acct-a',
      status: 'active',
      plan: {
        planCode: 'api_metered',
        planName: 'API Metered',
        billingInterval: 'monthly',
        intervalCount: 1,
        amountMinor: 1000,
        currency: 'USD',
        trialPeriodDays: 0,
      },
      currentPeriod: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-02-01T00:00:00Z',
      },
      collectionMethod: 'charge_automatically',
      usage: {
        meterName: 'api_calls',
        includedQuantity: 100,
        consumedQuantity: 0,
        unitLabel: 'calls',
        rolloverStrategy: 'none',
        overageRateMinor: 5,
        projectedOverageMinor: 0,
      },
      tenantId: tenantA,
      createdAt: subscriptionABusiness.toISO(),
      updatedAt: subscriptionASystem.toISO(),
      business_time: subscriptionABusiness,
      system_time: subscriptionASystem,
    };

    const subscriptionB: CanonicalSubscription = {
      ...subscriptionA,
      subscriptionId: 'sub-b',
      tenantId: tenantB,
      usage: {
        meterName: 'storage_gb',
        includedQuantity: 50,
        consumedQuantity: 0,
        unitLabel: 'GB',
        rolloverStrategy: 'none',
        overageRateMinor: 25,
        projectedOverageMinor: 0,
      },
    };

    const invoiceWithUsageA = await builder.attachUsage(invoiceA, subscriptionA);
    const invoiceWithUsageB = await builder.attachUsage(invoiceB, subscriptionB);

    expect(invoiceWithUsageA.usageLineItems?.[0]?.meterName).toBe('api_calls');
    expect(invoiceWithUsageB.usageLineItems?.[0]?.meterName).toBe('storage_gb');
    expect(invoiceWithUsageA.usageLineItems?.[0]?.meterName).not.toBe(
      invoiceWithUsageB.usageLineItems?.[0]?.meterName
    );
  });
});
