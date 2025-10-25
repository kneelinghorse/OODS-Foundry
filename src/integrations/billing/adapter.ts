/**
 * Billing Provider Adapter Interface
 * 
 * Anti-Corruption Layer (ACL) contract for translating
 * provider-specific billing data into canonical domain types.
 * 
 * @module integrations/billing/adapter
 */

import { DateTime } from 'luxon';
import type {
  CanonicalSubscriptionWithProvider,
  CanonicalInvoiceWithProvider,
  CanonicalPaymentIntentWithProvider,
} from '../../domain/billing/core.js';
import type { BillingEvent } from '../../domain/billing/events.js';
import TimeService from '../../services/time';

/**
 * Provider name type
 */
export type ProviderName = 'stripe' | 'chargebee' | 'zuora';

/**
 * Billing adapter interface
 * 
 * All provider adapters must implement this interface to ensure
 * consistent translation to canonical types.
 */
export interface BillingAdapter {
  /**
   * Provider name
   */
  readonly providerName: ProviderName;

  /**
   * Translate provider subscription to canonical format
   */
  translateSubscription(
    rawSubscription: unknown,
    tenantId?: string
  ): CanonicalSubscriptionWithProvider;

  /**
   * Translate provider invoice to canonical format
   */
  translateInvoice(
    rawInvoice: unknown,
    tenantId?: string
  ): CanonicalInvoiceWithProvider;

  /**
   * Translate provider payment intent to canonical format
   */
  translatePaymentIntent?(
    rawPaymentIntent: unknown,
    tenantId?: string
  ): CanonicalPaymentIntentWithProvider;

  /**
   * Translate provider event to canonical billing event
   */
  translateEvent(
    rawEvent: unknown,
    tenantId?: string
  ): BillingEvent;
}

/**
 * Translation error
 */
export class TranslationError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly resourceType: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`${provider} ${resourceType} translation failed: ${message}`);
    this.name = 'TranslationError';
  }
}

/**
 * Validate required field
 */
export function requireField<T>(
  obj: unknown,
  field: string,
  provider: ProviderName,
  resourceType: string
): T {
  if (!obj || typeof obj !== 'object') {
    throw new TranslationError(
      provider,
      resourceType,
      `Invalid object: expected object, got ${typeof obj}`
    );
  }

  const value = (obj as Record<string, unknown>)[field];
  
  if (value === undefined || value === null) {
    throw new TranslationError(
      provider,
      resourceType,
      `Missing required field: ${field}`
    );
  }

  return value as T;
}

/**
 * Get optional field
 */
export function getField<T>(obj: unknown, field: string): T | undefined;
export function getField<T>(obj: unknown, field: string, defaultValue: T): T;
export function getField<T>(
  obj: unknown,
  field: string,
  defaultValue?: T
): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const value = (obj as Record<string, unknown>)[field];
  return value !== undefined && value !== null ? (value as T) : defaultValue;
}

/**
 * Convert currency amount to minor units
 */
export function toMinorUnits(amount: number, currency: string): number {
  // Most currencies use 2 decimal places (cents)
  // Special cases like JPY use 0 decimal places
  const decimalPlaces = ['jpy', 'krw'].includes(currency.toLowerCase()) ? 0 : 2;
  return Math.round(amount * Math.pow(10, decimalPlaces));
}

/**
 * Convert minor units to major currency amount
 */
export function toMajorUnits(amountMinor: number, currency: string): number {
  const decimalPlaces = ['jpy', 'krw'].includes(currency.toLowerCase()) ? 0 : 2;
  return amountMinor / Math.pow(10, decimalPlaces);
}

/**
 * Normalize timestamp to ISO 8601
 */
export function normalizeTimestamp(timestamp: unknown, timezone?: string): string {
  if (typeof timestamp === 'string') {
    return TimeService.toIsoString(TimeService.normalizeToUtc(timestamp, timezone));
  }

  if (typeof timestamp === 'number') {
    // Unix timestamp (seconds)
    const dt = DateTime.fromSeconds(timestamp, { zone: timezone ?? 'UTC' });
    return TimeService.toIsoString(dt);
  }

  if (timestamp instanceof Date) {
    return TimeService.toIsoString(TimeService.fromDatabase(timestamp));
  }

  throw new Error(`Invalid timestamp format: ${typeof timestamp}`);
}
