/**
 * Canonical Billing Domain Types
 * 
 * Provider-agnostic billing entities that preserve sovereignty
 * and prevent third-party terminology leakage.
 * 
 * Dual-time model: All entities include business_time and system_time
 * See: docs/policies/time.md
 * 
 * @module domain/billing/core
 */

import type { SubscriptionState, InvoiceState } from './states.js';
import type { ProviderName } from '../../integrations/billing/adapter.js';
import type { UsageLineItem, UsageSummary } from './usage.js';
import type { DateTime } from 'luxon';

/**
 * Canonical subscription states (7-state model)
 * @deprecated Use SubscriptionState from ./states.js
 */
export type SubscriptionStatus = SubscriptionState;

/**
 * Canonical invoice states (5-state model)
 * @deprecated Use InvoiceState from ./states.js
 */
export type InvoiceStatus = InvoiceState;

/**
 * Payment intent status
 */
export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

/**
 * Billing interval types
 */
export type BillingInterval =
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'biennial';

/**
 * Canonical billing account (provider-agnostic)
 */
export interface BillingAccount {
  /** Internal account identifier */
  accountId: string;
  
  /** Account display name */
  accountName: string;
  
  /** Immutable customer key for CRM/billing linkage */
  accountKey?: string;
  
  /** Customer success owner */
  accountOwner?: string;
  
  /** Owner contact email */
  accountOwnerEmail?: string;
  
  /** Billing contact information */
  billingContact?: {
    name?: string;
    email?: string;
    title?: string;
  };
  
  /** Account health score (0-100) */
  healthScore?: number;
  
  /** Risk segment classification */
  riskSegment?: 'growth' | 'stable' | 'at_risk' | 'churned';
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Preferred payment method */
  paymentMethod?: 'card' | 'ach' | 'wire' | 'invoice';
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Free-form notes */
  notes?: string;
  
  /** Metadata (non-PII only) */
  metadata?: Record<string, unknown>;
  
  /** Business time: account creation in tenant timezone */
  business_time: DateTime;
  
  /** System time: immutable UTC record creation timestamp */
  system_time: DateTime;
  
  /** @deprecated Use business_time instead */
  createdAt: string;
  
  /** @deprecated Use system_time instead */
  updatedAt: string;
}

/**
 * Canonical subscription
 */
export interface CanonicalSubscription {
  /** Internal subscription identifier */
  subscriptionId: string;
  
  /** Parent billing account */
  accountId: string;
  
  /** Subscription status */
  status: SubscriptionStatus;
  
  /** Status explanation */
  statusNote?: string;
  
  /** Plan information */
  plan: {
    planCode: string;
    planName: string;
    billingInterval: BillingInterval;
    intervalCount: number;
    amountMinor: number;
    currency: string;
    trialPeriodDays: number;
  };
  
  /** Current billing period */
  currentPeriod: {
    start: string;
    end: string;
  };
  
  /** Trial end date (if applicable) */
  trialEndAt?: string;
  
  /** Cancellation effective date (if pending) */
  cancellationEffectiveAt?: string;
  
  /** Expected renewal price (minor units) */
  renewalRateMinor?: number;
  
  /** Collection method */
  collectionMethod: 'charge_automatically' | 'send_invoice';
  
  /** Metering/usage information */
  usage?: {
    meterName: string;
    includedQuantity: number;
    consumedQuantity: number;
    unitLabel: string;
    rolloverStrategy: 'none' | 'carry_forward' | 'expire';
    overageRateMinor?: number;
    projectedOverageMinor?: number;
  };
  
  /** Refund policy */
  refund?: {
    refundableUntil?: string;
    refundPolicyUrl?: string;
    totalRefundedMinor: number;
    creditMemoBalanceMinor?: number;
    creditMemoType?: string;
    requiresManagerApproval: boolean;
  };
  
  /** Account health metrics */
  healthScore?: number;
  riskSegment?: string;
  
  /** Free-form notes */
  notes?: string;
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Business time: subscription lifecycle event in tenant timezone */
  business_time: DateTime;
  
  /** System time: immutable UTC record timestamp */
  system_time: DateTime;
  
  /** @deprecated Use business_time instead */
  createdAt: string;
  
  /** @deprecated Use system_time instead */
  updatedAt: string;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  /** Line item ID */
  id: string;
  
  /** Line item description */
  description: string;
  
  /** Quantity */
  quantity: number;
  
  /** Total amount (minor units) */
  amountMinor: number;
  
  /** Unit amount (minor units) */
  unitAmountMinor: number;
  
  /** Product code */
  productCode?: string;
  
  /** Plan interval (if applicable) */
  planInterval?: string;
}

/**
 * Asset reference (attachments, PDFs, etc.)
 */
export interface AssetReference {
  /** Asset ID */
  id: string;
  
  /** Asset name */
  name: string;
  
  /** Asset URL */
  href: string;
  
  /** Asset description */
  description?: string;
}

/**
 * Canonical invoice
 */
export interface CanonicalInvoice {
  /** Internal invoice identifier */
  invoiceId: string;
  
  /** Invoice number (human-readable) */
  invoiceNumber: string;
  
  /** Parent subscription */
  subscriptionId: string;
  
  /** Invoice status */
  status: InvoiceStatus;
  
  /** Status explanation */
  statusNote?: string;
  
  /** Issue timestamp (ISO 8601) */
  issuedAt: string;
  
  /** Due date (ISO 8601) */
  dueAt: string;
  
  /** Paid timestamp (ISO 8601, if paid) */
  paidAt?: string;
  
  /** Total amount (minor units) */
  totalMinor: number;
  
  /** Outstanding balance (minor units) */
  balanceMinor: number;
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Payment terms */
  paymentTerms: string;
  
  /** Billing contact */
  billingContact?: {
    name?: string;
    email?: string;
    title?: string;
  };
  
  /** Tax amount (minor units) */
  taxMinor: number;
  
  /** Discount amount (minor units) */
  discountMinor: number;
  
  /** Subtotal (minor units) */
  subtotalMinor: number;
  
  /** Line items */
  lineItems: InvoiceLineItem[];

  /** Aggregated usage summaries attached to the invoice */
  usageSummaries?: UsageSummary[];

  /** Metered usage line items derived from summaries */
  usageLineItems?: UsageLineItem[];
  
  /** Attachments */
  attachments: AssetReference[];
  
  /** Customer portal URL */
  portalUrl?: string;
  
  /** Dunning/collections step */
  dunningStep?: string;
  
  /** Payment source */
  paymentSource?: 'card' | 'ach' | 'wire' | 'invoice';
  
  /** Collection state */
  collectionState?: 'pending' | 'retrying' | 'failed' | 'cleared';
  
  /** Last reminder sent (ISO 8601) */
  lastReminderAt?: string;
  
  /** Aging bucket (days overdue) */
  agingBucketDays?: number;
  
  /** Internal memo */
  memo?: string;
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Business time: invoice due date in tenant timezone */
  business_time: DateTime;
  
  /** System time: immutable UTC record timestamp */
  system_time: DateTime;
  
  /** @deprecated Use business_time for due date */
  createdAt: string;
  
  /** @deprecated Use system_time for audit trail */
  updatedAt: string;
}

/**
 * Canonical payment intent
 */
export interface CanonicalPaymentIntent {
  /** Internal payment intent ID */
  paymentIntentId: string;
  
  /** Associated invoice */
  invoiceId?: string;
  
  /** Associated subscription */
  subscriptionId?: string;
  
  /** Payment status */
  status: PaymentIntentStatus;
  
  /** Amount to charge (minor units) */
  amountMinor: number;
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Payment method type */
  paymentMethod?: 'card' | 'ach' | 'wire';
  
  /** Confirmation URL (if action required) */
  confirmationUrl?: string;
  
  /** Last payment error */
  lastError?: {
    code: string;
    message: string;
    declineCode?: string;
  };
  
  /** Retry attempt count */
  retryAttempt?: number;
  
  /** Next retry scheduled at (ISO 8601) */
  nextRetryAt?: string;
  
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Business time: payment attempt time in tenant timezone */
  business_time: DateTime;
  
  /** System time: immutable UTC record timestamp */
  system_time: DateTime;
  
  /** @deprecated Use business_time instead */
  createdAt: string;
  
  /** @deprecated Use system_time instead */
  updatedAt: string;
}

/**
 * Provider metadata (for audit trails)
 */
export interface ProviderMetadata {
  /** Provider identifier emitted by ACL adapters */
  provider: ProviderName | 'manual';
  
  /** Provider-specific ID (retained for audit) */
  providerResourceId?: string;
  
  /** Provider status (raw) */
  providerStatus?: string;
  
  /** Provider region */
  providerRegion?: string;
  
  /** Translation timestamp (ISO 8601) */
  translatedAt: string;
  
  /** Translation version */
  translationVersion: string;
}

/**
 * Extended subscription with provider metadata
 */
export interface CanonicalSubscriptionWithProvider extends CanonicalSubscription {
  /** Provider metadata for audit trails */
  provider: ProviderMetadata;
}

/**
 * Extended invoice with provider metadata
 */
export interface CanonicalInvoiceWithProvider extends CanonicalInvoice {
  /** Provider metadata for audit trails */
  provider: ProviderMetadata;
}

/**
 * Extended payment intent with provider metadata
 */
export interface CanonicalPaymentIntentWithProvider extends CanonicalPaymentIntent {
  /** Provider metadata for audit trails */
  provider: ProviderMetadata;
}

/**
 * Type guard: check if subscription is active
 */
export function isActiveSubscription(subscription: CanonicalSubscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Type guard: check if invoice is overdue
 */
export function isOverdueInvoice(invoice: CanonicalInvoice): boolean {
  return invoice.status === 'past_due';
}

/**
 * Type guard: check if payment requires action
 */
export function requiresPaymentAction(payment: CanonicalPaymentIntent): boolean {
  return payment.status === 'requires_action' || payment.status === 'requires_confirmation';
}

/**
 * Calculate invoice total from components
 */
export function calculateInvoiceTotal(
  subtotal: number,
  tax: number,
  discount: number
): number {
  return subtotal + tax - discount;
}

/**
 * Format amount from minor units to major units
 */
export function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(major);
}
