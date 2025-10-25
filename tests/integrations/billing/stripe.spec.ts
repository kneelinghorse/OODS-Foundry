/**
 * Stripe Adapter Tests
 * 
 * Verifies Stripe billing payloads are correctly translated
 * to canonical domain types.
 */

import { describe, it, expect } from 'vitest';
import { StripeAdapter } from '../../../src/integrations/billing/stripe-adapter.js';
import type { CanonicalSubscriptionWithProvider, CanonicalInvoiceWithProvider } from '../../../src/domain/billing/core.js';

describe('StripeAdapter', () => {
  const adapter = new StripeAdapter();

  describe('translateSubscription', () => {
    it('should translate a basic Stripe subscription', () => {
      const stripeSubscription = {
        id: 'sub_abc123',
        customer: 'cus_xyz789',
        status: 'active',
        currency: 'usd',
        current_period_start: 1704067200, // 2024-01-01
        current_period_end: 1735689599, // 2024-12-31
        created: 1704067200,
        items: [
          {
            price: {
              id: 'price_123',
              nickname: 'Pro Plan',
              unit_amount: 9900,
              currency: 'usd',
              recurring: {
                interval: 'month',
                interval_count: 1,
              },
            },
          },
        ],
        collection_method: 'charge_automatically',
      };

      const canonical = adapter.translateSubscription(stripeSubscription, 'tenant-1');

      expect(canonical.subscriptionId).toBe('stripe_sub_abc123');
      expect(canonical.accountId).toBe('cus_xyz789');
      expect(canonical.status).toBe('active');
      expect(canonical.plan.planCode).toBe('price_123');
      expect(canonical.plan.planName).toBe('Pro Plan');
      expect(canonical.plan.amountMinor).toBe(9900);
      expect(canonical.plan.billingInterval).toBe('monthly');
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('stripe');
      expect(canonical.provider.providerResourceId).toBe('sub_abc123');
      expect(canonical.provider.providerStatus).toBe('active');
    });

    it('should map Stripe subscription statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['incomplete', 'future'],
        ['incomplete_expired', 'terminated'],
        ['trialing', 'trialing'],
        ['active', 'active'],
        ['past_due', 'delinquent'],
        ['unpaid', 'delinquent'],
        ['canceled', 'terminated'],
        ['paused', 'paused'],
      ];

      statuses.forEach(([stripeStatus, expectedCanonical]) => {
        const sub = {
          id: 'sub_test',
          customer: 'cus_test',
          status: stripeStatus,
          currency: 'usd',
          current_period_start: Date.now() / 1000,
          current_period_end: Date.now() / 1000 + 86400,
          created: Date.now() / 1000,
          items: [],
        };

        const canonical = adapter.translateSubscription(sub);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });

    it('should handle trial subscriptions', () => {
      const stripeSubscription = {
        id: 'sub_trial',
        customer: 'cus_trial',
        status: 'trialing',
        currency: 'usd',
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000 + 86400 * 14,
        trial_end: Date.now() / 1000 + 86400 * 14,
        created: Date.now() / 1000,
        items: [
          {
            price: {
              id: 'price_trial',
              nickname: 'Trial Plan',
              unit_amount: 0,
              currency: 'usd',
              recurring: { interval: 'month', interval_count: 1 },
            },
          },
        ],
      };

      const canonical = adapter.translateSubscription(stripeSubscription);
      expect(canonical.status).toBe('trialing');
      expect(canonical.trialEndAt).toBeDefined();
    });
  });

  describe('translateInvoice', () => {
    it('should translate a basic Stripe invoice', () => {
      const stripeInvoice = {
        id: 'in_abc123',
        subscription: 'sub_xyz789',
        status: 'open',
        number: 'INV-001',
        currency: 'usd',
        created: 1704067200,
        due_date: 1704326400,
        total: 9900,
        amount_due: 9900,
        subtotal: 9000,
        tax: 900,
        lines: [
          {
            id: 'li_123',
            description: 'Pro Plan',
            quantity: 1,
            amount: 9000,
            unit_amount: 9000,
          },
        ],
        hosted_invoice_url: 'https://stripe.com/invoice/123',
        payment_method_type: 'card',
      };

      const canonical = adapter.translateInvoice(stripeInvoice, 'tenant-1');

      expect(canonical.invoiceId).toBe('stripe_in_abc123');
      expect(canonical.subscriptionId).toBe('stripe_sub_xyz789');
      expect(canonical.invoiceNumber).toBe('INV-001');
      expect(canonical.status).toBe('posted');
      expect(canonical.totalMinor).toBe(9900);
      expect(canonical.balanceMinor).toBe(9900);
      expect(canonical.taxMinor).toBe(900);
      expect(canonical.subtotalMinor).toBe(9000);
      expect(canonical.lineItems).toHaveLength(1);
      expect(canonical.lineItems[0].description).toBe('Pro Plan');
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('stripe');
    });

    it('should map Stripe invoice statuses correctly', () => {
      const statuses: Array<[string, string]> = [
        ['draft', 'draft'],
        ['open', 'posted'],
        ['paid', 'paid'],
        ['void', 'void'],
        ['uncollectible', 'past_due'],
      ];

      statuses.forEach(([stripeStatus, expectedCanonical]) => {
        const inv = {
          id: 'in_test',
          status: stripeStatus,
          currency: 'usd',
          created: Date.now() / 1000,
          total: 1000,
          amount_due: 1000,
          subtotal: 900,
          lines: [],
        };

        const canonical = adapter.translateInvoice(inv);
        expect(canonical.status).toBe(expectedCanonical);
      });
    });
  });

  describe('translatePaymentIntent', () => {
    it('should translate a Stripe payment intent', () => {
      const stripePaymentIntent = {
        id: 'pi_abc123',
        status: 'succeeded',
        amount: 9900,
        currency: 'usd',
        invoice: 'in_xyz789',
        created: 1704067200,
        payment_method_type: 'card',
      };

      const canonical = adapter.translatePaymentIntent(stripePaymentIntent, 'tenant-1');

      expect(canonical.paymentIntentId).toBe('stripe_pi_abc123');
      expect(canonical.invoiceId).toBe('stripe_in_xyz789');
      expect(canonical.status).toBe('succeeded');
      expect(canonical.amountMinor).toBe(9900);
      expect(canonical.currency).toBe('usd');
      expect(canonical.tenantId).toBe('tenant-1');
      expect(canonical.provider.provider).toBe('stripe');
    });

    it('should handle payment errors', () => {
      const stripePaymentIntent = {
        id: 'pi_failed',
        status: 'requires_payment_method',
        amount: 5000,
        currency: 'usd',
        created: Date.now() / 1000,
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined',
          decline_code: 'insufficient_funds',
        },
      };

      const canonical = adapter.translatePaymentIntent(stripePaymentIntent);
      expect(canonical.lastError).toBeDefined();
      expect(canonical.lastError?.code).toBe('card_declined');
      expect(canonical.lastError?.message).toBe('Your card was declined');
      expect(canonical.lastError?.declineCode).toBe('insufficient_funds');
    });
  });

  describe('translateEvent', () => {
    it('should translate a subscription.created event', () => {
      const stripeEvent = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        api_version: '2023-10-16',
        data: {
          object: {
            id: 'sub_new',
            customer: 'cus_new',
            status: 'active',
            currency: 'usd',
            current_period_start: Date.now() / 1000,
            current_period_end: Date.now() / 1000 + 86400 * 30,
            created: Date.now() / 1000,
            items: [],
          },
        },
      };

      const event = adapter.translateEvent(stripeEvent, 'tenant-1');

      expect(event.type).toBe('subscription.created');
      expect(event.provider.name).toBe('stripe');
      expect(event.provider.eventId).toBe('evt_123');
      expect(event.data.objectType).toBe('subscription');
      expect(event.tenantId).toBe('tenant-1');
    });

    it('should translate an invoice.payment_succeeded event', () => {
      const stripeEvent = {
        id: 'evt_456',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_paid',
            status: 'paid',
            currency: 'usd',
            created: Date.now() / 1000,
            total: 10000,
            amount_due: 0,
            subtotal: 9000,
            lines: [],
          },
        },
      };

      const event = adapter.translateEvent(stripeEvent);
      expect(event.type).toBe('invoice.payment_succeeded');
      expect(event.data.objectType).toBe('invoice');
      expect(event.severity).toBe('info');
    });
  });
});
