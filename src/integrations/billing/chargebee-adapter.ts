/**
 * Chargebee Billing Adapter
 * 
 * Translates Chargebee subscription/invoice/event payloads
 * into canonical billing domain types.
 * 
 * @module integrations/billing/chargebee-adapter
 */

import { DateTime } from 'luxon';
import type {
  CanonicalSubscriptionWithProvider,
  CanonicalInvoiceWithProvider,
  SubscriptionStatus,
  InvoiceStatus,
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
 * Chargebee subscription status mapping
 */
const CHARGEBEE_SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  'future': 'future',
  'in_trial': 'trialing',
  'active': 'active',
  'non_renewing': 'pending_cancellation',
  'paused': 'paused',
  'cancelled': 'terminated',
};

/**
 * Chargebee invoice status mapping
 */
const CHARGEBEE_INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  'pending': 'draft',
  'posted': 'posted',
  'payment_due': 'posted',
  'paid': 'paid',
  'voided': 'void',
  'not_paid': 'past_due',
};

/**
 * Chargebee event type mapping
 */
const CHARGEBEE_EVENT_TYPE_MAP: Record<string, BillingEventType> = {
  'subscription_created': 'subscription.created',
  'subscription_changed': 'subscription.updated',
  'subscription_cancelled': 'subscription.canceled',
  'subscription_paused': 'subscription.paused',
  'subscription_resumed': 'subscription.resumed',
  'invoice_generated': 'invoice.created',
  'invoice_updated': 'invoice.finalized',
  'payment_succeeded': 'invoice.payment_succeeded',
  'payment_failed': 'invoice.payment_failed',
};

/**
 * Chargebee billing period mapping
 */
const CHARGEBEE_PERIOD_MAP: Record<string, BillingInterval> = {
  'month': 'monthly',
  'quarter': 'quarterly',
  'year': 'annual',
  '2_years': 'biennial',
};

/**
 * Chargebee billing adapter
 */
export class ChargebeeAdapter implements BillingAdapter {
  readonly providerName = 'chargebee' as const;

  translateSubscription(
    rawSubscription: unknown,
    tenantId?: string
  ): CanonicalSubscriptionWithProvider {
    try {
      const sub = rawSubscription as Record<string, unknown>;
      
      const id = requireField<string>(sub, 'id', 'chargebee', 'subscription');
      const status = requireField<string>(sub, 'status', 'chargebee', 'subscription');
      const customerId = requireField<string>(sub, 'customer_id', 'chargebee', 'subscription');
      const planId = requireField<string>(sub, 'plan_id', 'chargebee', 'subscription');
      const currency = requireField<string>(sub, 'currency_code', 'chargebee', 'subscription');
      const currentTermStart = requireField<number>(sub, 'current_term_start', 'chargebee', 'subscription');
      const currentTermEnd = requireField<number>(sub, 'current_term_end', 'chargebee', 'subscription');
      
      // Map status
      const canonicalStatus = CHARGEBEE_SUBSCRIPTION_STATUS_MAP[status] || 'active';

      // Parse plan details
      const planUnitPrice = getField<number>(sub, 'plan_unit_price', 0);
      const planQuantity = getField<number>(sub, 'plan_quantity', 1);
      const planFreeQuantity = getField<number>(sub, 'plan_free_quantity', 0);
      const billingPeriod = getField<number>(sub, 'billing_period', 1);
      const billingPeriodUnit = getField<string>(sub, 'billing_period_unit', 'month');
      
      const canonicalInterval = CHARGEBEE_PERIOD_MAP[billingPeriodUnit] || 'monthly';

      const periodStartIso = normalizeTimestamp(currentTermStart);
      const periodEndIso = normalizeTimestamp(currentTermEnd);
      const createdAtIso = normalizeTimestamp(requireField<number>(sub, 'created_at', 'chargebee', 'subscription'));
      const updatedAtIso = normalizeTimestamp(getField<number>(sub, 'updated_at', DateTime.utc().toSeconds()));
      const trialEndIso = sub.trial_end ? normalizeTimestamp(sub.trial_end) : undefined;
      const cancellationIso = sub.cancelled_at ? normalizeTimestamp(sub.cancelled_at) : undefined;
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(periodEndIso);
      
      // Build canonical subscription
      const canonical: CanonicalSubscriptionWithProvider = {
        subscriptionId: `chargebee_${id}`,
        accountId: customerId,
        status: canonicalStatus,
        plan: {
          planCode: planId,
          planName: getField<string>(sub, 'plan_name', planId),
          billingInterval: canonicalInterval,
          intervalCount: billingPeriod,
          amountMinor: planUnitPrice * planQuantity,
          currency: currency.toLowerCase(),
          trialPeriodDays: getField<number>(sub, 'trial_end')
            ? Math.floor((getField<number>(sub, 'trial_end', 0) - currentTermStart) / 86400)
            : 0,
        },
        currentPeriod: {
          start: periodStartIso,
          end: periodEndIso,
        },
        trialEndAt: trialEndIso,
        cancellationEffectiveAt: cancellationIso,
        collectionMethod: getField<string>(sub, 'auto_collection', 'on') === 'on'
          ? 'charge_automatically'
          : 'send_invoice',
        usage: planFreeQuantity > 0 ? {
          meterName: getField<string>(sub, 'plan_name', 'Usage'),
          includedQuantity: planFreeQuantity,
          consumedQuantity: getField<number>(sub, 'plan_quantity', 0),
          unitLabel: 'units',
          rolloverStrategy: 'none',
        } : undefined,
        tenantId,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'chargebee',
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
      throw new TranslationError('chargebee', 'subscription', 'Unexpected error', error);
    }
  }

  translateInvoice(
    rawInvoice: unknown,
    tenantId?: string
  ): CanonicalInvoiceWithProvider {
    try {
      const inv = rawInvoice as Record<string, unknown>;
      
      const id = requireField<string>(inv, 'id', 'chargebee', 'invoice');
      const status = requireField<string>(inv, 'status', 'chargebee', 'invoice');
      const subscriptionId = getField<string>(inv, 'subscription_id');
      const currency = requireField<string>(inv, 'currency_code', 'chargebee', 'invoice');
      const date = requireField<number>(inv, 'date', 'chargebee', 'invoice');
      const dueDate = getField<number>(inv, 'due_date', date);
      const total = requireField<number>(inv, 'total', 'chargebee', 'invoice');
      const amountDue = requireField<number>(inv, 'amount_due', 'chargebee', 'invoice');
      const tax = getField<number>(inv, 'tax', 0);
      const subTotal = requireField<number>(inv, 'sub_total', 'chargebee', 'invoice');
      
      // Map status
      const canonicalStatus = CHARGEBEE_INVOICE_STATUS_MAP[status] || 'posted';

      const issuedAtIso = normalizeTimestamp(date);
      const dueAtIso = normalizeTimestamp(dueDate);
      const updatedAtIso = normalizeTimestamp(getField<number>(inv, 'updated_at', DateTime.utc().toSeconds()));
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(dueAtIso);
      const paidAtIso = inv.paid_at ? normalizeTimestamp(inv.paid_at) : undefined;
      
      // Parse line items
      const lineItems = getField<Array<Record<string, unknown>>>(inv, 'line_items', []).map((line, idx) => ({
        id: getField<string>(line, 'id', `line_${idx}`),
        description: getField<string>(line, 'description', 'Line item'),
        quantity: getField<number>(line, 'quantity', 1),
        amountMinor: getField<number>(line, 'amount', 0),
        unitAmountMinor: getField<number>(line, 'unit_amount', 0),
        productCode: getField<string>(line, 'entity_id'),
      }));
      
      // Build canonical invoice
      const canonical: CanonicalInvoiceWithProvider = {
        invoiceId: `chargebee_${id}`,
        invoiceNumber: getField<string>(inv, 'invoice_number', id),
        subscriptionId: subscriptionId ? `chargebee_${subscriptionId}` : 'unknown',
        status: canonicalStatus,
        issuedAt: issuedAtIso,
        dueAt: dueAtIso,
        paidAt: paidAtIso,
        totalMinor: total,
        balanceMinor: amountDue,
        currency: currency.toLowerCase(),
        paymentTerms: getField<string>(inv, 'payment_terms', 'net_30'),
        taxMinor: tax,
        discountMinor: getField<number>(inv, 'discounts', 0),
        subtotalMinor: subTotal,
        lineItems,
        attachments: [],
        portalUrl: getField<string>(inv, 'invoice_url'),
        paymentSource: getField<string>(inv, 'payment_method', 'invoice') as 'card' | 'ach' | 'wire' | 'invoice',
        tenantId,
        createdAt: issuedAtIso,
        updatedAt: updatedAtIso,
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'chargebee',
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
      throw new TranslationError('chargebee', 'invoice', 'Unexpected error', error);
    }
  }

  translateEvent(
    rawEvent: unknown,
    tenantId?: string
  ): BillingEvent {
    try {
      const event = rawEvent as Record<string, unknown>;
      
      const id = requireField<string>(event, 'id', 'chargebee', 'event');
      const eventType = requireField<string>(event, 'event_type', 'chargebee', 'event');
      const content = requireField<Record<string, unknown>>(event, 'content', 'chargebee', 'event');
      
      // Map event type
      const canonicalType = CHARGEBEE_EVENT_TYPE_MAP[eventType];
      if (!canonicalType) {
        throw new TranslationError('chargebee', 'event', `Unsupported event type: ${eventType}`);
      }
      
      // Translate object based on type
      let translatedObject: unknown;
      let objectType: 'subscription' | 'invoice' | 'payment_intent';
      
      if (eventType.startsWith('subscription')) {
        objectType = 'subscription';
        const subscription = requireField<Record<string, unknown>>(content, 'subscription', 'chargebee', 'event.content');
        translatedObject = this.translateSubscription(subscription, tenantId);
      } else if (eventType.startsWith('invoice') || eventType.startsWith('payment')) {
        objectType = 'invoice';
        const invoice = requireField<Record<string, unknown>>(content, 'invoice', 'chargebee', 'event.content');
        translatedObject = this.translateInvoice(invoice, tenantId);
      } else {
        throw new TranslationError('chargebee', 'event', `Unknown object type for event: ${eventType}`);
      }
      
      return createBillingEvent(
        canonicalType,
        {
          objectType,
          object: translatedObject as any,
        },
        {
          name: 'chargebee',
          eventId: id,
          eventType,
          apiVersion: getField<string>(event, 'api_version'),
        },
        {
          tenantId,
        }
      );
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('chargebee', 'event', 'Unexpected error', error);
    }
  }
}
