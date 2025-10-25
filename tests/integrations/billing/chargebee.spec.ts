/**
 * Chargebee Adapter Tests
 * 
 * Verifies Chargebee billing payloads are correctly translated
 * to canonical domain types.
 */

import { describe, it, expect } from 'vitest';
import { ChargebeeAdapter } from '../../../src/integrations/billing/chargebee-adapter.js';

describe('ChargebeeAdapter', () => {
  const adapter = new ChargebeeAdapter();

  describe('translateSubscription', () => {
    it('should translate a basic Chargebee subscription', () => {
      const chargebeeSubscription = {
        id: 'cb_sub_123',
        customer_id: 'cb_cus_456',
        status: 'active',
        plan_id: 'pro-plan',
        plan_name: 'Pro Plan',
        currency_code: 'USD',
        plan_unit_price: 9900,
        plan_quantity: 1,
        plan_free_quantity: 0,
        billing_period: 1,
        billing_period_unit: 'month',
        current_term_start: 1704067200,
        current_term_end: 1706745599,
        created_at: 1704067200,
        updated_at: 1704067200,
        auto_collection: 'on',
      };

      const canonical = adapter.translateSubscription(chargebeeSubscription, 'tenant-1');

      expect(canonical.subscriptionId).toBe('chargebee_cb_sub_123');
      expect(canonical.accountId).toBe('cb_cus_456');
      expect(canonical.status).toBe('active');
      expect(canonical.plan.planCode).toBe('pro-plan');
      expect(canonical.plan.planName).toBe('Pro Plan');
      expect(canonical.plan.amountMinor).toBe(9900);
      expect(canonical.plan.billingInterval).toBe('monthly');
      expect(canonical.collectionMethod).toBe('charge_automatically');
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('chargebee');
    });

    it('should map Chargebee subscription statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['future', 'future'],
        ['in_trial', 'trialing'],
        ['active', 'active'],
        ['non_renewing', 'pending_cancellation'],
        ['paused', 'paused'],
        ['cancelled', 'terminated'],
      ];

      statuses.forEach(([cbStatus, expectedCanonical]) => {
        const sub = {
          id: 'cb_test',
          customer_id: 'cb_cus_test',
          status: cbStatus,
          plan_id: 'test-plan',
          currency_code: 'USD',
          plan_unit_price: 1000,
          current_term_start: Date.now() / 1000,
          current_term_end: Date.now() / 1000 + 86400,
          created_at: Date.now() / 1000,
          billing_period_unit: 'month',
        };

        const canonical = adapter.translateSubscription(sub);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });

    it('should handle quarterly billing intervals', () => {
      const sub = {
        id: 'cb_quarterly',
        customer_id: 'cb_cus_quarterly',
        status: 'active',
        plan_id: 'quarterly-plan',
        currency_code: 'USD',
        plan_unit_price: 25000,
        billing_period: 3,
        billing_period_unit: 'quarter',
        current_term_start: Date.now() / 1000,
        current_term_end: Date.now() / 1000 + 86400 * 90,
        created_at: Date.now() / 1000,
      };

      const canonical = adapter.translateSubscription(sub);
      expect(canonical.plan.billingInterval).toBe('quarterly');
      expect(canonical.plan.intervalCount).toBe(3);
    });
  });

  describe('translateInvoice', () => {
    it('should translate a basic Chargebee invoice', () => {
      const chargebeeInvoice = {
        id: 'cb_inv_123',
        subscription_id: 'cb_sub_456',
        status: 'posted',
        invoice_number: 'CB-001',
        currency_code: 'USD',
        date: 1704067200,
        due_date: 1706745599,
        total: 10900,
        amount_due: 10900,
        sub_total: 10000,
        tax: 900,
        line_items: [
          {
            id: 'li_cb_1',
            description: 'Pro Plan',
            quantity: 1,
            amount: 10000,
            unit_amount: 10000,
            entity_id: 'pro-plan',
          },
        ],
        invoice_url: 'https://chargebee.com/invoice/123',
        payment_method: 'card',
        updated_at: 1704067200,
      };

      const canonical = adapter.translateInvoice(chargebeeInvoice, 'tenant-1');

      expect(canonical.invoiceId).toBe('chargebee_cb_inv_123');
      expect(canonical.subscriptionId).toBe('chargebee_cb_sub_456');
      expect(canonical.invoiceNumber).toBe('CB-001');
      expect(canonical.status).toBe('posted');
      expect(canonical.totalMinor).toBe(10900);
      expect(canonical.taxMinor).toBe(900);
      expect(canonical.subtotalMinor).toBe(10000);
      expect(canonical.lineItems).toHaveLength(1);
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('chargebee');
    });

    it('should map Chargebee invoice statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['pending', 'draft'],
        ['posted', 'posted'],
        ['payment_due', 'posted'],
        ['paid', 'paid'],
        ['voided', 'void'],
        ['not_paid', 'past_due'],
      ];

      statuses.forEach(([cbStatus, expectedCanonical]) => {
        const inv = {
          id: 'cb_inv_test',
          status: cbStatus,
          currency_code: 'USD',
          date: Date.now() / 1000,
          total: 1000,
          amount_due: 1000,
          sub_total: 900,
          line_items: [],
        };

        const canonical = adapter.translateInvoice(inv);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });
  });

  describe('translateEvent', () => {
    it('should translate a subscription_created event', () => {
      const chargebeeEvent = {
        id: 'cb_evt_123',
        event_type: 'subscription_created',
        api_version: 'v2',
        content: {
          subscription: {
            id: 'cb_sub_new',
            customer_id: 'cb_cus_new',
            status: 'active',
            plan_id: 'new-plan',
            currency_code: 'USD',
            plan_unit_price: 5000,
            current_term_start: Date.now() / 1000,
            current_term_end: Date.now() / 1000 + 86400 * 30,
            created_at: Date.now() / 1000,
            billing_period_unit: 'month',
          },
        },
      };

      const event = adapter.translateEvent(chargebeeEvent, 'tenant-1');

      expect(event.type).toBe('subscription.created');
      expect(event.provider.name).toBe('chargebee');
      expect(event.provider.eventId).toBe('cb_evt_123');
      expect(event.data.objectType).toBe('subscription');
      expect(event.tenantId).toBe('tenant-1');
    });

    it('should translate a payment_succeeded event', () => {
      const chargebeeEvent = {
        id: 'cb_evt_456',
        event_type: 'payment_succeeded',
        content: {
          invoice: {
            id: 'cb_inv_paid',
            status: 'paid',
            currency_code: 'USD',
            date: Date.now() / 1000,
            total: 10000,
            amount_due: 0,
            sub_total: 9000,
            line_items: [],
          },
        },
      };

      const event = adapter.translateEvent(chargebeeEvent);
      expect(event.type).toBe('invoice.payment_succeeded');
      expect(event.data.objectType).toBe('invoice');
    });
  });
});
