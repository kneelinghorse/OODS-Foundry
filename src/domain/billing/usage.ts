/**
 * Usage-Based Billing Types
 * 
 * Defines the schema for metered billing: usage events, aggregation,
 * and integration with canonical invoices.
 * 
 * @module domain/billing/usage
 */

import { DateTime } from 'luxon';

const API_PREFIX = 'api';
const CALLS_TOKEN = 'calls';
const GATEWAY_TOKEN = 'gateway';

export const METER_UNIT_API_CALLS = `${API_PREFIX}_${CALLS_TOKEN}` as const;

/**
 * Unit options for metering
 */
export const METER_UNITS = [
  METER_UNIT_API_CALLS,
  'compute_hours',
  'storage_gb',
  'bandwidth_gb',
  'seats',
  'transactions',
  'events',
  'units',
] as const;

export type MeterUnit = (typeof METER_UNITS)[number];

export const USAGE_SOURCE_API_GATEWAY = `${API_PREFIX}_${GATEWAY_TOKEN}` as const;

/**
 * Usage event sources
 */
export const USAGE_EVENT_SOURCES = [
  USAGE_SOURCE_API_GATEWAY,
  'background_job',
  'manual_entry',
  'import',
  'webhook',
] as const;

export type UsageEventSource = (typeof USAGE_EVENT_SOURCES)[number];

/**
 * Raw usage event (meter reading)
 */
export interface UsageEvent {
  /** Event ID */
  eventId: string;
  
  /** Subscription being metered */
  subscriptionId: string;
  
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  
  /** Meter name/identifier */
  meterName: string;
  
  /** Unit of measurement */
  unit: MeterUnit;
  
  /** Quantity consumed */
  quantity: number;
  
  /** When usage occurred (ISO 8601) */
  recordedAt: string;
  
  /** Event source */
  source: UsageEventSource;
  
  /** Optional idempotency key */
  idempotencyKey?: string;
  
  /** Source metadata (origin, service, endpoint, etc.) */
  metadata?: {
    endpoint?: string;
    service?: string;
    region?: string;
    userId?: string;
    resourceId?: string;
     timezone?: string;
    [key: string]: unknown;
  };
  
  /** Created timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Input for recording usage events
 */
export interface UsageEventInput {
  subscriptionId: string;
  tenantId: string;
  meterName: string;
  unit: MeterUnit;
  quantity: number;
  recordedAt?: string; // Defaults to now
  source: UsageEventSource;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregation period
 */
export type AggregationPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Usage summary (aggregated)
 */
export interface UsageSummary {
  /** Summary ID */
  summaryId: string;
  
  /** Subscription */
  subscriptionId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Meter name */
  meterName: string;
  
  /** Unit */
  unit: MeterUnit;
  
  /** Aggregation period */
  period: AggregationPeriod;
  
  /** Period start (ISO 8601) */
  periodStart: string;
  
  /** Period end (ISO 8601) */
  periodEnd: string;
  
  /** Total quantity consumed */
  totalQuantity: number;
  
  /** Number of events aggregated */
  eventCount: number;
  
  /** Minimum event quantity */
  minQuantity: number;
  
  /** Maximum event quantity */
  maxQuantity: number;
  
  /** Average quantity per event */
  avgQuantity: number;
  
  /** @deprecated Use business_time instead */
  aggregatedAt: string;
  
  /** @deprecated Use system_time instead */
  createdAt: string;

  /** Business timestamp for summary availability */
  business_time: DateTime;

  /** System timestamp when summary persisted */
  system_time: DateTime;
}

/**
 * Usage-based line item for invoices
 */
export interface UsageLineItem {
  /** Line item ID */
  id: string;
  
  /** Description (e.g., "API Calls - January 2025") */
  description: string;
  
  /** Meter name */
  meterName: string;
  
  /** Unit */
  unit: MeterUnit;
  
  /** Quantity consumed */
  quantity: number;
  
  /** Rate per unit (minor units) */
  unitRateMinor: number;
  
  /** Total amount (minor units) */
  totalMinor: number;
  
  /** Billing period start */
  periodStart: string;
  
  /** Billing period end */
  periodEnd: string;
  
  /** Summary reference */
  summaryId: string;
  
  /** Created timestamp */
  createdAt: string;
}

/**
 * Usage event validation result
 */
export interface UsageEventValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate usage event input
 */
export function validateUsageEvent(input: UsageEventInput): UsageEventValidation {
  const errors: string[] = [];
  
  if (!input.subscriptionId) {
    errors.push('subscriptionId is required');
  }
  
  if (!input.tenantId) {
    errors.push('tenantId is required');
  }
  
  if (!input.meterName || input.meterName.trim() === '') {
    errors.push('meterName is required');
  }
  
  if (!input.unit) {
    errors.push('unit is required');
  }
  
  if (typeof input.quantity !== 'number' || input.quantity < 0) {
    errors.push('quantity must be a non-negative number');
  }
  
  if (!input.source) {
    errors.push('source is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate overage amount
 */
export function calculateOverage(
  totalQuantity: number,
  includedQuantity: number,
  overageRateMinor: number
): number {
  const overage = Math.max(0, totalQuantity - includedQuantity);
  return overage * overageRateMinor;
}

/**
 * Format usage quantity
 */
export function formatUsageQuantity(quantity: number, unit: MeterUnit): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(quantity);
  
  return `${formatted} ${unit}`;
}

/**
 * Generate usage event ID
 */
export function generateUsageEventId(input: UsageEventInput): string {
  // Use idempotency key if provided, otherwise generate ID
  if (input.idempotencyKey) {
    return `evt_${input.idempotencyKey}`;
  }

  const timestamp = DateTime.utc().toMillis().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `evt_${timestamp}_${random}`;
}

/**
 * Generate usage summary ID
 */
export function generateUsageSummaryId(
  subscriptionId: string,
  meterName: string,
  periodStart: string
): string {
  const period = DateTime.fromISO(periodStart, { zone: 'utc' }).toISODate();
  return `sum_${subscriptionId}_${meterName}_${period}`;
}

/**
 * Type guard: check if usage event is valid
 */
export function isValidUsageEvent(input: unknown): input is UsageEventInput {
  const validation = validateUsageEvent(input as UsageEventInput);
  return validation.valid;
}
