/**
 * Zuora Adapter Tests
 * 
 * Verifies Zuora billing payloads are correctly translated
 * to canonical domain types.
 */

import { describe, it, expect } from 'vitest';
import { ZuoraAdapter } from '../../../src/integrations/billing/zuora-adapter.js';

describe('ZuoraAdapter', () => {
  const adapter = new ZuoraAdapter();

  describe('translateSubscription', () => {
    it('should translate a basic Zuora subscription', () => {
      const zuoraSubscription = {
        Id: 'zuora-sub-123',
        Status: 'Active',
        AccountId: 'zuora-acct-456',
        Name: 'Enterprise Subscription',
        TermStartDate: '2024-01-01',
        TermEndDate: '2024-12-31',
        CreatedDate: '2024-01-01T00:00:00Z',
        UpdatedDate: '2024-01-01T00:00:00Z',
        AutoRenew: 'true',
        RatePlans: [
          {
            ProductRatePlanId: 'rp-123',
            ProductRatePlanName: 'Enterprise Plan',
            RatePlanCharges: [
              {
                Id: 'rpc-456',
                Price: 299.00,
                Currency: 'USD',
                BillingPeriod: 'Annual',
              },
            ],
          },
        ],
      };

      const canonical = adapter.translateSubscription(zuoraSubscription, 'tenant-1');

      expect(canonical.subscriptionId).toBe('zuora_zuora-sub-123');
      expect(canonical.accountId).toBe('zuora-acct-456');
      expect(canonical.status).toBe('active');
      expect(canonical.plan.planCode).toBe('rp-123');
      expect(canonical.plan.planName).toBe('Enterprise Plan');
      expect(canonical.plan.amountMinor).toBe(29900);
      expect(canonical.plan.billingInterval).toBe('annual');
      expect(canonical.collectionMethod).toBe('charge_automatically');
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('zuora');
    });

    it('should map Zuora subscription statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['Draft', 'future'],
        ['PendingActivation', 'future'],
        ['PendingAcceptance', 'trialing'],
        ['Active', 'active'],
        ['Cancelled', 'terminated'],
        ['Suspended', 'paused'],
        ['Expired', 'terminated'],
      ];

      statuses.forEach(([zuoraStatus, expectedCanonical]) => {
        const sub = {
          Id: 'zuora-test',
          AccountId: 'zuora-acct-test',
          Status: zuoraStatus,
          TermStartDate: new Date().toISOString(),
          TermEndDate: new Date(Date.now() + 86400000).toISOString(),
          RatePlans: [],
        };

        const canonical = adapter.translateSubscription(sub);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });

    it('should handle monthly billing periods', () => {
      const sub = {
        Id: 'zuora-monthly',
        AccountId: 'zuora-acct-monthly',
        Status: 'Active',
        TermStartDate: '2024-01-01',
        TermEndDate: '2024-02-01',
        RatePlans: [
          {
            ProductRatePlanId: 'rp-monthly',
            ProductRatePlanName: 'Monthly Plan',
            RatePlanCharges: [
              {
                Price: 29.00,
                Currency: 'USD',
                BillingPeriod: 'Month',
              },
            ],
          },
        ],
      };

      const canonical = adapter.translateSubscription(sub);
      expect(canonical.plan.billingInterval).toBe('monthly');
      expect(canonical.plan.amountMinor).toBe(2900);
    });
  });

  describe('translateInvoice', () => {
    it('should translate a basic Zuora invoice', () => {
      const zuoraInvoice = {
        Id: 'zuora-inv-123',
        AccountId: 'zuora-acct-456',
        Status: 'Posted',
        InvoiceNumber: 'ZU-001',
        InvoiceDate: '2024-01-01',
        DueDate: '2024-01-31',
        Amount: 299.00,
        Balance: 299.00,
        Currency: 'USD',
        TaxAmount: 29.00,
        CreatedDate: '2024-01-01T00:00:00Z',
        UpdatedDate: '2024-01-01T00:00:00Z',
        InvoiceItems: [
          {
            Id: 'ii-789',
            ServiceStartDate: '2024-01-01',
            Quantity: 1,
            ChargeAmount: 270.00,
            UnitPrice: 270.00,
            ProductName: 'Enterprise Plan',
          },
        ],
        InvoiceURL: 'https://zuora.com/invoice/123',
      };

      const canonical = adapter.translateInvoice(zuoraInvoice, 'tenant-1');

      expect(canonical.invoiceId).toBe('zuora_zuora-inv-123');
      expect(canonical.subscriptionId).toBe('zuora_zuora-acct-456');
      expect(canonical.invoiceNumber).toBe('ZU-001');
      expect(canonical.status).toBe('posted');
      expect(canonical.totalMinor).toBe(29900);
      expect(canonical.balanceMinor).toBe(29900);
      expect(canonical.taxMinor).toBe(2900);
      expect(canonical.lineItems).toHaveLength(1);
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('zuora');
    });

    it('should map Zuora invoice statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['Draft', 'draft'],
        ['Posted', 'posted'],
        ['Canceled', 'void'],
        ['Error', 'draft'],
      ];

      statuses.forEach(([zuoraStatus, expectedCanonical]) => {
        const inv = {
          Id: 'zuora-inv-test',
          Status: zuoraStatus,
          InvoiceNumber: 'TEST-001',
          InvoiceDate: new Date().toISOString(),
          Amount: 100.00,
          Balance: 100.00,
          InvoiceItems: [],
        };

        const canonical = adapter.translateInvoice(inv);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });
  });

  describe('translateEvent', () => {
    it('should translate a Subscription.Created event', () => {
      const zuoraEvent = {
        eventId: 'zuora-evt-123',
        eventType: 'Subscription.Created',
        payload: {
          Id: 'zuora-sub-new',
          AccountId: 'zuora-acct-new',
          Status: 'Active',
          TermStartDate: new Date().toISOString(),
          TermEndDate: new Date(Date.now() + 86400000 * 365).toISOString(),
          RatePlans: [],
        },
      };

      const event = adapter.translateEvent(zuoraEvent, 'tenant-1');

      expect(event.type).toBe('subscription.created');
      expect(event.provider.name).toBe('zuora');
      expect(event.provider.eventId).toBe('zuora-evt-123');
      expect(event.data.objectType).toBe('subscription');
      expect(event.tenantId).toBe('tenant-1');
    });

    it('should translate an Invoice.Posted event', () => {
      const zuoraEvent = {
        eventId: 'zuora-evt-456',
        eventType: 'Invoice.Posted',
        payload: {
          Id: 'zuora-inv-posted',
          Status: 'Posted',
          InvoiceNumber: 'ZU-002',
          InvoiceDate: new Date().toISOString(),
          Amount: 500.00,
          Balance: 500.00,
          InvoiceItems: [],
        },
      };

      const event = adapter.translateEvent(zuoraEvent);
      expect(event.type).toBe('invoice.posted');
      expect(event.data.objectType).toBe('invoice');
    });
  });
});
