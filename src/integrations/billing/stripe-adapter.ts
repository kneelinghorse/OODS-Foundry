/**
 * Stripe Billing Adapter
 * 
 * Translates Stripe subscription/invoice/event payloads
 * into canonical billing domain types.
 * 
 * @module integrations/billing/stripe-adapter
 */

import { DateTime } from 'luxon';
import type {
  CanonicalSubscriptionWithProvider,
  CanonicalInvoiceWithProvider,
  CanonicalPaymentIntentWithProvider,
  SubscriptionStatus,
  InvoiceStatus,
  PaymentIntentStatus,
  BillingInterval,
} from '../../domain/billing/core.js';
import type { BillingEvent, BillingEventType } from '../../domain/billing/events.js';
import { createBillingEvent } from '../../domain/billing/events.js';
import {
  type BillingAdapter,
  TranslationError,
  requireField,
  getField,
  normalizeTimestamp,
} from './adapter.js';
import TimeService from '../../services/time';

/**
 * Stripe subscription status mapping
 */
const STRIPE_SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  'incomplete': 'future',
  'incomplete_expired': 'terminated',
  'trialing': 'trialing',
  'active': 'active',
  'past_due': 'delinquent',
  'canceled': 'terminated',
  'unpaid': 'delinquent',
  'paused': 'paused',
};

/**
 * Stripe invoice status mapping
 */
const STRIPE_INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  'draft': 'draft',
  'open': 'posted',
  'paid': 'paid',
  'uncollectible': 'past_due',
  'void': 'void',
};

/**
 * Stripe payment intent status mapping
 */
const STRIPE_PAYMENT_INTENT_STATUS_MAP: Record<string, PaymentIntentStatus> = {
  'requires_payment_method': 'requires_payment_method',
  'requires_confirmation': 'requires_confirmation',
  'requires_action': 'requires_action',
  'processing': 'processing',
  'succeeded': 'succeeded',
  'canceled': 'canceled',
};

/**
 * Stripe event type mapping
 */
const STRIPE_EVENT_TYPE_MAP: Record<string, BillingEventType> = {
  'customer.subscription.created': 'subscription.created',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.trial_will_end': 'subscription.trial_ending',
  'customer.subscription.deleted': 'subscription.canceled',
  'invoice.created': 'invoice.created',
  'invoice.finalized': 'invoice.finalized',
  'invoice.payment_succeeded': 'invoice.payment_succeeded',
  'invoice.payment_failed': 'invoice.payment_failed',
  'invoice.payment_action_required': 'invoice.payment_action_required',
  'invoice.voided': 'invoice.voided',
  'payment_intent.created': 'payment_intent.created',
  'payment_intent.processing': 'payment_intent.processing',
  'payment_intent.succeeded': 'payment_intent.succeeded',
  'payment_intent.payment_failed': 'payment_intent.failed',
  'payment_intent.canceled': 'payment_intent.canceled',
};

/**
 * Stripe billing interval mapping
 */
const STRIPE_INTERVAL_MAP: Record<string, BillingInterval> = {
  'month': 'monthly',
  'year': 'annual',
};

/**
 * Stripe billing adapter
 */
export class StripeAdapter implements BillingAdapter {
  readonly providerName = 'stripe' as const;

  translateSubscription(
    rawSubscription: unknown,
    tenantId?: string
  ): CanonicalSubscriptionWithProvider {
    try {
      const sub = rawSubscription as Record<string, unknown>;
      
      const id = requireField<string>(sub, 'id', 'stripe', 'subscription');
      const status = requireField<string>(sub, 'status', 'stripe', 'subscription');
      const customerId = requireField<string>(sub, 'customer', 'stripe', 'subscription');
      const currency = requireField<string>(sub, 'currency', 'stripe', 'subscription');
      const currentPeriodStart = requireField<number>(sub, 'current_period_start', 'stripe', 'subscription');
      const currentPeriodEnd = requireField<number>(sub, 'current_period_end', 'stripe', 'subscription');
      
      // Get plan/price data
      const items = getField<Array<Record<string, unknown>>>(sub, 'items', []);
      const firstItem = items[0];
      const price = firstItem ? getField<Record<string, unknown>>(firstItem, 'price', {}) : {};
      const plan = firstItem ? getField<Record<string, unknown>>(firstItem, 'plan', {}) : {};
      
      const planData = Object.keys(price).length > 0 ? price : plan;
      const planId = getField<string>(planData, 'id', 'unknown');
      const planNickname = getField<string>(planData, 'nickname', 'Standard Plan');
      const unitAmount = getField<number>(planData, 'unit_amount', 0);
      const interval = getField<string>(planData, 'interval', 'month');
      const intervalCount = getField<number>(planData, 'interval_count', 1);
      const trialPeriodDays = getField<number>(planData, 'trial_period_days', 0);
      
      // Map status
      const canonicalStatus = STRIPE_SUBSCRIPTION_STATUS_MAP[status] || 'active';
      const canonicalInterval = STRIPE_INTERVAL_MAP[interval] || 'monthly';

      const periodStartIso = normalizeTimestamp(currentPeriodStart);
      const periodEndIso = normalizeTimestamp(currentPeriodEnd);
      const createdAtIso = normalizeTimestamp(requireField<number>(sub, 'created', 'stripe', 'subscription'));
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(periodEndIso);
      
      // Build canonical subscription
      const canonical: CanonicalSubscriptionWithProvider = {
        subscriptionId: `stripe_${id}`,
        accountId: customerId,
        status: canonicalStatus,
        statusNote: getField<string>(sub, 'description'),
        plan: {
          planCode: planId,
          planName: planNickname,
          billingInterval: canonicalInterval,
          intervalCount,
          amountMinor: unitAmount,
          currency: currency.toLowerCase(),
          trialPeriodDays,
        },
        currentPeriod: {
          start: periodStartIso,
          end: periodEndIso,
        },
        trialEndAt: sub.trial_end ? normalizeTimestamp(sub.trial_end) : undefined,
        cancellationEffectiveAt: sub.cancel_at ? normalizeTimestamp(sub.cancel_at) : undefined,
        collectionMethod: getField<string>(sub, 'collection_method', 'charge_automatically') as 'charge_automatically' | 'send_invoice',
        tenantId,
        createdAt: createdAtIso,
        updatedAt: TimeService.toIsoString(systemNow),
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'stripe',
          providerResourceId: id,
          providerStatus: status,
          translatedAt: TimeService.toIsoString(systemNow),
          translationVersion: '1.0.0',
        },
      };

      return canonical;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('stripe', 'subscription', 'Unexpected error', error);
    }
  }

  translateInvoice(
    rawInvoice: unknown,
    tenantId?: string
  ): CanonicalInvoiceWithProvider {
    try {
      const inv = rawInvoice as Record<string, unknown>;
      
      const id = requireField<string>(inv, 'id', 'stripe', 'invoice');
      const status = requireField<string>(inv, 'status', 'stripe', 'invoice');
      const subscriptionId = getField<string>(inv, 'subscription');
      const number = getField<string>(inv, 'number', id);
      const currency = requireField<string>(inv, 'currency', 'stripe', 'invoice');
      const created = requireField<number>(inv, 'created', 'stripe', 'invoice');
      const dueDate = getField<number>(inv, 'due_date', created);
      const total = requireField<number>(inv, 'total', 'stripe', 'invoice');
      const amountDue = requireField<number>(inv, 'amount_due', 'stripe', 'invoice');
      const tax = getField<number>(inv, 'tax', 0);
      const subtotal = requireField<number>(inv, 'subtotal', 'stripe', 'invoice');
      
      // Map status
      const canonicalStatus = STRIPE_INVOICE_STATUS_MAP[status] || 'posted';
      const issuedAtIso = normalizeTimestamp(created);
      const dueAtIso = normalizeTimestamp(dueDate);
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(dueAtIso);
      
      // Parse line items
      const lines = getField<Array<Record<string, unknown>>>(inv, 'lines', []);
      const lineItems = lines.map((line, idx) => ({
        id: getField<string>(line, 'id', `line_${idx}`),
        description: getField<string>(line, 'description', 'Line item'),
        quantity: getField<number>(line, 'quantity', 1),
        amountMinor: getField<number>(line, 'amount', 0),
        unitAmountMinor: getField<number>(line, 'unit_amount', 0),
      }));
      
      // Build canonical invoice
      const canonical: CanonicalInvoiceWithProvider = {
        invoiceId: `stripe_${id}`,
        invoiceNumber: number,
        subscriptionId: subscriptionId ? `stripe_${subscriptionId}` : 'unknown',
        status: canonicalStatus,
        issuedAt: issuedAtIso,
        dueAt: dueAtIso,
        paidAt: inv.status_transitions && typeof inv.status_transitions === 'object' 
          ? normalizeTimestamp((inv.status_transitions as Record<string, unknown>).paid_at)
          : undefined,
        totalMinor: total,
        balanceMinor: amountDue,
        currency: currency.toLowerCase(),
        paymentTerms: getField<string>(inv, 'payment_terms', 'due_on_receipt'),
        taxMinor: tax || 0,
        discountMinor: getField<number>(inv, 'discount', 0),
        subtotalMinor: subtotal,
        lineItems,
        attachments: [],
        portalUrl: getField<string>(inv, 'hosted_invoice_url'),
        paymentSource: getField<string>(inv, 'payment_method_type', 'card') as 'card' | 'ach' | 'wire' | 'invoice',
        tenantId,
        createdAt: issuedAtIso,
        updatedAt: TimeService.toIsoString(systemNow),
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'stripe',
          providerResourceId: id,
          providerStatus: status,
          translatedAt: TimeService.toIsoString(systemNow),
          translationVersion: '1.0.0',
        },
      };

      return canonical;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('stripe', 'invoice', 'Unexpected error', error);
    }
  }

  translatePaymentIntent(
    rawPaymentIntent: unknown,
    tenantId?: string
  ): CanonicalPaymentIntentWithProvider {
    try {
      const pi = rawPaymentIntent as Record<string, unknown>;
      
      const id = requireField<string>(pi, 'id', 'stripe', 'payment_intent');
      const status = requireField<string>(pi, 'status', 'stripe', 'payment_intent');
      const amount = requireField<number>(pi, 'amount', 'stripe', 'payment_intent');
      const currency = requireField<string>(pi, 'currency', 'stripe', 'payment_intent');
      
      // Map status
      const canonicalStatus = STRIPE_PAYMENT_INTENT_STATUS_MAP[status] || 'processing';
      const createdAtIso = normalizeTimestamp(requireField<number>(pi, 'created', 'stripe', 'payment_intent'));
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(createdAtIso);
      
      const canonical: CanonicalPaymentIntentWithProvider = {
        paymentIntentId: `stripe_${id}`,
        invoiceId: getField<string>(pi, 'invoice') ? `stripe_${getField<string>(pi, 'invoice')}` : undefined,
        status: canonicalStatus,
        amountMinor: amount,
        currency: currency.toLowerCase(),
        paymentMethod: getField<string>(pi, 'payment_method_type', 'card') as 'card' | 'ach' | 'wire',
        confirmationUrl: getField<string>(pi, 'next_action')
          ? getField<string>((pi.next_action as Record<string, unknown>), 'redirect_to_url')
          : undefined,
        lastError: pi.last_payment_error ? {
          code: getField<string>(pi.last_payment_error as Record<string, unknown>, 'code', 'unknown'),
          message: getField<string>(pi.last_payment_error as Record<string, unknown>, 'message', 'Payment failed'),
          declineCode: getField<string>(pi.last_payment_error as Record<string, unknown>, 'decline_code'),
        } : undefined,
        tenantId,
        createdAt: createdAtIso,
        updatedAt: TimeService.toIsoString(systemNow),
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'stripe',
          providerResourceId: id,
          providerStatus: status,
          translatedAt: TimeService.toIsoString(systemNow),
          translationVersion: '1.0.0',
        },
      };

      return canonical;
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('stripe', 'payment_intent', 'Unexpected error', error);
    }
  }

  translateEvent(
    rawEvent: unknown,
    tenantId?: string
  ): BillingEvent {
    try {
      const event = rawEvent as Record<string, unknown>;
      
      const id = requireField<string>(event, 'id', 'stripe', 'event');
      const type = requireField<string>(event, 'type', 'stripe', 'event');
      const data = requireField<Record<string, unknown>>(event, 'data', 'stripe', 'event');
      const object = requireField<Record<string, unknown>>(data, 'object', 'stripe', 'event.data');
      
      // Map event type
      const canonicalType = STRIPE_EVENT_TYPE_MAP[type];
      if (!canonicalType) {
        throw new TranslationError('stripe', 'event', `Unsupported event type: ${type}`);
      }
      
      // Translate object based on type
      let translatedObject: unknown;
      let objectType: 'subscription' | 'invoice' | 'payment_intent';
      
      if (type.startsWith('customer.subscription')) {
        objectType = 'subscription';
        translatedObject = this.translateSubscription(object, tenantId);
      } else if (type.startsWith('invoice')) {
        objectType = 'invoice';
        translatedObject = this.translateInvoice(object, tenantId);
      } else if (type.startsWith('payment_intent')) {
        objectType = 'payment_intent';
        translatedObject = this.translatePaymentIntent(object, tenantId);
      } else {
        throw new TranslationError('stripe', 'event', `Unknown object type for event: ${type}`);
      }
      
      return createBillingEvent(
        canonicalType,
        {
          objectType,
          object: translatedObject as any,
        },
        {
          name: 'stripe',
          eventId: id,
          eventType: type,
          apiVersion: getField<string>(event, 'api_version'),
        },
        {
          tenantId,
          requestId: getField<string>(event, 'request')
            ? getField<string>((event.request as Record<string, unknown>), 'id')
            : undefined,
          idempotencyKey: getField<string>(event, 'idempotency_key'),
        }
      );
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('stripe', 'event', 'Unexpected error', error);
    }
  }
}
