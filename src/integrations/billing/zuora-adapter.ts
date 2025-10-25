/**
 * Zuora Billing Adapter
 * 
 * Translates Zuora subscription/invoice/event payloads
 * into canonical billing domain types.
 * 
 * @module integrations/billing/zuora-adapter
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
 * Zuora subscription status mapping
 */
const ZUORA_SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  'Draft': 'future',
  'PendingActivation': 'future',
  'PendingAcceptance': 'trialing',
  'Active': 'active',
  'Cancelled': 'terminated',
  'Suspended': 'paused',
  'Expired': 'terminated',
};

/**
 * Zuora invoice status mapping
 */
const ZUORA_INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  'Draft': 'draft',
  'Posted': 'posted',
  'Canceled': 'void',
  'Error': 'draft',
};

/**
 * Zuora event type mapping
 */
const ZUORA_EVENT_TYPE_MAP: Record<string, BillingEventType> = {
  'Subscription.Created': 'subscription.created',
  'Subscription.Updated': 'subscription.updated',
  'Subscription.Cancelled': 'subscription.canceled',
  'Subscription.Suspended': 'subscription.paused',
  'Invoice.Posted': 'invoice.posted',
  'PaymentMethod.PaymentCompleted': 'invoice.payment_succeeded',
  'PaymentMethod.PaymentFailed': 'invoice.payment_failed',
};

/**
 * Zuora billing period mapping
 */
const ZUORA_PERIOD_MAP: Record<string, BillingInterval> = {
  'Month': 'monthly',
  'Quarter': 'quarterly',
  'Annual': 'annual',
  'Year': 'annual',
  'Two_Years': 'biennial',
};

/**
 * Zuora billing adapter
 */
export class ZuoraAdapter implements BillingAdapter {
  readonly providerName = 'zuora' as const;

  translateSubscription(
    rawSubscription: unknown,
    tenantId?: string
  ): CanonicalSubscriptionWithProvider {
    try {
      const sub = rawSubscription as Record<string, unknown>;
      
      const id = requireField<string>(sub, 'Id', 'zuora', 'subscription');
      const status = requireField<string>(sub, 'Status', 'zuora', 'subscription');
      const accountId = requireField<string>(sub, 'AccountId', 'zuora', 'subscription');
      const termStartDate = requireField<string>(sub, 'TermStartDate', 'zuora', 'subscription');
      const termEndDate = requireField<string>(sub, 'TermEndDate', 'zuora', 'subscription');
      
      // Map status
      const canonicalStatus = ZUORA_SUBSCRIPTION_STATUS_MAP[status] || 'active';

      // Parse rate plan charges (Zuora's pricing structure)
      const ratePlans = getField<Array<Record<string, unknown>>>(sub, 'RatePlans', []);
      const firstPlan = ratePlans[0] || {};
      const ratePlanCharges = getField<Array<Record<string, unknown>>>(firstPlan, 'RatePlanCharges', []);
      const firstCharge = ratePlanCharges[0] || {};
      
      const planName = getField<string>(firstPlan, 'ProductRatePlanName', 'Standard Plan');
      const billingPeriod = getField<string>(firstCharge, 'BillingPeriod', 'Month');
      const price = getField<number>(firstCharge, 'Price', 0);
      const currency = getField<string>(firstCharge, 'Currency', 'USD');
      
      const canonicalInterval = ZUORA_PERIOD_MAP[billingPeriod] || 'monthly';

      const periodStartIso = normalizeTimestamp(termStartDate);
      const periodEndIso = normalizeTimestamp(termEndDate);
      const defaultIso = TimeService.toIsoString(TimeService.nowSystem());
      const createdAtIso = normalizeTimestamp(getField<string>(sub, 'CreatedDate', defaultIso));
      const updatedAtIso = normalizeTimestamp(getField<string>(sub, 'UpdatedDate', defaultIso));
      const cancellationIso = getField<string>(sub, 'CancelledDate')
        ? normalizeTimestamp(getField<string>(sub, 'CancelledDate', defaultIso))
        : undefined;
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(periodEndIso);
      
      // Build canonical subscription
      const canonical: CanonicalSubscriptionWithProvider = {
        subscriptionId: `zuora_${id}`,
        accountId,
        status: canonicalStatus,
        statusNote: getField<string>(sub, 'Notes'),
        plan: {
          planCode: getField<string>(firstPlan, 'ProductRatePlanId', 'unknown'),
          planName,
          billingInterval: canonicalInterval,
          intervalCount: 1,
          amountMinor: price * 100, // Convert to minor units
          currency: currency.toLowerCase(),
          trialPeriodDays: 0, // Zuora doesn't have a standard trial field
        },
        currentPeriod: {
          start: periodStartIso,
          end: periodEndIso,
        },
        cancellationEffectiveAt: cancellationIso,
        collectionMethod: getField<string>(sub, 'AutoRenew', 'true') === 'true'
          ? 'charge_automatically'
          : 'send_invoice',
        tenantId,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'zuora',
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
      throw new TranslationError('zuora', 'subscription', 'Unexpected error', error);
    }
  }

  translateInvoice(
    rawInvoice: unknown,
    tenantId?: string
  ): CanonicalInvoiceWithProvider {
    try {
      const inv = rawInvoice as Record<string, unknown>;
      
      const id = requireField<string>(inv, 'Id', 'zuora', 'invoice');
      const status = requireField<string>(inv, 'Status', 'zuora', 'invoice');
      const accountId = getField<string>(inv, 'AccountId');
      const invoiceNumber = requireField<string>(inv, 'InvoiceNumber', 'zuora', 'invoice');
      const invoiceDate = requireField<string>(inv, 'InvoiceDate', 'zuora', 'invoice');
      const dueDate = getField<string>(inv, 'DueDate', invoiceDate);
      const amount = requireField<number>(inv, 'Amount', 'zuora', 'invoice');
      const balance = requireField<number>(inv, 'Balance', 'zuora', 'invoice');
      const currency = getField<string>(inv, 'Currency', 'USD');
      const taxAmount = getField<number>(inv, 'TaxAmount', 0);
      
      // Map status
      const canonicalStatus = ZUORA_INVOICE_STATUS_MAP[status] || 'posted';

      const issuedAtIso = normalizeTimestamp(invoiceDate);
      const dueAtIso = normalizeTimestamp(dueDate);
      const createdAtIso = normalizeTimestamp(getField<string>(inv, 'CreatedDate', invoiceDate));
      const updatedAtIso = normalizeTimestamp(getField<string>(inv, 'UpdatedDate', TimeService.toIsoString(TimeService.nowSystem())));
      const paidAtIso = inv.PostedDate ? normalizeTimestamp(inv.PostedDate) : undefined;
      const systemNow = TimeService.nowSystem();
      const businessTime = DateTime.fromISO(dueAtIso);
      
      // Parse invoice items
      const invoiceItems = getField<Array<Record<string, unknown>>>(inv, 'InvoiceItems', []);
      const lineItems = invoiceItems.map((item, idx) => ({
        id: getField<string>(item, 'Id', `line_${idx}`),
        description: getField<string>(item, 'ServiceStartDate', 'Line item'),
        quantity: getField<number>(item, 'Quantity', 1),
        amountMinor: getField<number>(item, 'ChargeAmount', 0) * 100,
        unitAmountMinor: getField<number>(item, 'UnitPrice', 0) * 100,
        productCode: getField<string>(item, 'ProductName'),
      }));
      
      // Build canonical invoice
      const canonical: CanonicalInvoiceWithProvider = {
        invoiceId: `zuora_${id}`,
        invoiceNumber,
        subscriptionId: accountId ? `zuora_${accountId}` : 'unknown',
        status: canonicalStatus,
        issuedAt: issuedAtIso,
        dueAt: dueAtIso,
        paidAt: paidAtIso,
        totalMinor: amount * 100, // Convert to minor units
        balanceMinor: balance * 100,
        currency: currency.toLowerCase(),
        paymentTerms: getField<string>(inv, 'PaymentTerm', 'net_30'),
        taxMinor: taxAmount * 100,
        discountMinor: 0, // Zuora doesn't have a direct discount field
        subtotalMinor: (amount - taxAmount) * 100,
        lineItems,
        attachments: [],
        portalUrl: getField<string>(inv, 'InvoiceURL'),
        paymentSource: 'invoice',
        tenantId,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        business_time: businessTime,
        system_time: systemNow,
        provider: {
          provider: 'zuora',
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
      throw new TranslationError('zuora', 'invoice', 'Unexpected error', error);
    }
  }

  translateEvent(
    rawEvent: unknown,
    tenantId?: string
  ): BillingEvent {
    try {
      const event = rawEvent as Record<string, unknown>;
      
      const id = requireField<string>(event, 'eventId', 'zuora', 'event');
      const eventType = requireField<string>(event, 'eventType', 'zuora', 'event');
      const payload = requireField<Record<string, unknown>>(event, 'payload', 'zuora', 'event');
      
      // Map event type
      const canonicalType = ZUORA_EVENT_TYPE_MAP[eventType];
      if (!canonicalType) {
        throw new TranslationError('zuora', 'event', `Unsupported event type: ${eventType}`);
      }
      
      // Translate object based on type
      let translatedObject: unknown;
      let objectType: 'subscription' | 'invoice' | 'payment_intent';
      
      if (eventType.startsWith('Subscription')) {
        objectType = 'subscription';
        translatedObject = this.translateSubscription(payload, tenantId);
      } else if (eventType.startsWith('Invoice') || eventType.startsWith('PaymentMethod')) {
        objectType = 'invoice';
        translatedObject = this.translateInvoice(payload, tenantId);
      } else {
        throw new TranslationError('zuora', 'event', `Unknown object type for event: ${eventType}`);
      }
      
      return createBillingEvent(
        canonicalType,
        {
          objectType,
          object: translatedObject as any,
        },
        {
          name: 'zuora',
          eventId: id,
          eventType,
        },
        {
          tenantId,
        }
      );
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError('zuora', 'event', 'Unexpected error', error);
    }
  }
}
