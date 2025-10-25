/**
 * TimeService: Temporal hygiene utilities for dual-time model
 * 
 * Provides timezone-aware helpers for business_time vs system_time semantics.
 * See docs/policies/time.md for usage guidelines.
 * 
 * @module services/time
 */

import { DateTime, IANAZone } from 'luxon';

export interface Tenant {
  id: string;
  timezone: string; // IANA timezone name
}

export interface DualTimestamp {
  business_time: DateTime;
  system_time: DateTime;
}

/**
 * Core temporal utilities enforcing dual-time convention
 */
export class TimeService {
  /**
   * Current system time (always UTC)
   * Use for audit logs, replication ordering, debugging
   */
  static nowSystem(): DateTime {
    return this._testNow ?? DateTime.utc();
  }

  /**
   * Current business time in tenant's timezone
   * Use for SLAs, billing cycles, user-facing deadlines
   */
  static nowBusiness(tenant?: Tenant): DateTime {
    const now = this._testNow ?? DateTime.now();
    if (!tenant?.timezone) {
      return now.toUTC();
    }
    return now.setZone(tenant.timezone);
  }

  /**
   * Create dual timestamp for a business event
   */
  static createDualTimestamp(tenant?: Tenant): DualTimestamp {
    const system_time = this.nowSystem();
    const business_time = tenant 
      ? system_time.setZone(tenant.timezone)
      : system_time;

    return { business_time, system_time };
  }

  /**
   * Convert business time to system time (UTC)
   */
  static toSystemTime(businessDate: DateTime): DateTime {
    return businessDate.toUTC();
  }

  /**
   * Display timestamp in tenant's timezone (ISO8601 with offset)
   */
  static displayInTenantZone(date: DateTime, tenant: Tenant): string {
    const zonedDate = date.setZone(tenant.timezone);
    return zonedDate.toISO({ suppressMilliseconds: false }) ?? this.toIsoString(zonedDate, { preserveZone: true });
  }

  /**
   * @deprecated Use displayInTenantZone for clarity
   */
  static displayForTenant(date: DateTime, tenant: Tenant): string {
    return this.displayInTenantZone(date, tenant);
  }

  /**
   * Display timestamp in tenant's timezone with custom format
   */
  static formatForTenant(
    date: DateTime,
    tenant: Tenant,
    format: string = 'yyyy-MM-dd HH:mm:ss ZZZZ'
  ): string {
    const zonedDate = date.setZone(tenant.timezone);
    return zonedDate.toFormat(format);
  }

  /**
   * Normalize user input to UTC
   * Handles DST boundaries and invalid times
   */
  static normalizeToUtc(input: DateTime | string, tenantTz?: string): DateTime {
    let dt: DateTime;

    if (typeof input === 'string') {
      dt = tenantTz 
        ? DateTime.fromISO(input, { zone: tenantTz })
        : DateTime.fromISO(input);
    } else {
      dt = input;
    }

    // Handle invalid times (e.g., DST spring forward)
    if (!dt.isValid) {
      if (tenantTz) {
        // Retry in UTC and convert
        dt = DateTime.fromISO(input as string, { zone: 'UTC' });
      }
      if (!dt.isValid) {
        throw new Error(`Invalid datetime: ${input} (${dt.invalidReason})`);
      }
    }

    return dt.toUTC();
  }

  /**
   * Compare two business times
   * Returns difference in milliseconds (positive if a > b)
   */
  static compareBusinessTime(a: DateTime, b: DateTime): number {
    return a.diff(b).as('milliseconds');
  }

  /**
   * Check if two timestamps are on the same business day in tenant TZ
   */
  static isSameBusinessDay(
    a: DateTime,
    b: DateTime,
    tenant: Tenant
  ): boolean {
    const dateA = a.setZone(tenant.timezone).startOf('day');
    const dateB = b.setZone(tenant.timezone).startOf('day');
    return dateA.equals(dateB);
  }

  /**
   * Get start of business day in tenant timezone
   */
  static startOfBusinessDay(date: DateTime, tenant: Tenant): DateTime {
    return date.setZone(tenant.timezone).startOf('day');
  }

  /**
   * Get end of business day in tenant timezone
   */
  static endOfBusinessDay(date: DateTime, tenant: Tenant): DateTime {
    return date.setZone(tenant.timezone).endOf('day');
  }

  /**
   * Calculate billing period boundaries in tenant timezone
   * Returns [start, end] inclusive
   */
  static billingPeriod(
    year: number,
    month: number,
    tenant: Tenant
  ): [DateTime, DateTime] {
    const tz = tenant.timezone;
    const start = DateTime.fromObject(
      { year, month, day: 1, hour: 0, minute: 0, second: 0 },
      { zone: tz }
    );
    const end = start.endOf('month');
    return [start, end];
  }

  /**
   * Validate IANA timezone
   */
  static isValidTimezone(tz: string): boolean {
    return IANAZone.isValidZone(tz);
  }

  /**
   * Parse database timestamptz to DateTime
   * PostgreSQL returns ISO8601 strings
   */
  static fromDatabase(dbTimestamp: string | Date): DateTime {
    if (dbTimestamp instanceof Date) {
      return DateTime.fromJSDate(dbTimestamp, { zone: 'UTC' });
    }
    return DateTime.fromISO(dbTimestamp, { zone: 'UTC' });
  }

  /**
   * Convert DateTime to database-safe format
   */
  static toDatabase(dt: DateTime): string {
    return this.toIsoString(dt);
  }

  /**
   * Safe ISO string conversion that never returns null for valid DateTimes
   */
  static toIsoString(dt: DateTime, options: { preserveZone?: boolean } = {}): string {
    if (!dt.isValid) {
      throw new Error(`Invalid DateTime: ${dt.invalidExplanation ?? dt.invalidReason ?? 'unknown reason'}`);
    }
    const target = options.preserveZone ? dt : dt.toUTC();
    return target.toISO({ suppressMilliseconds: false }) ?? target.toFormat("yyyy-LL-dd'T'HH:mm:ss.SSSZZ");
  }

  /**
   * Safe ISO date (YYYY-MM-DD) conversion that never returns null for valid DateTimes
   */
  static toIsoDateString(dt: DateTime): string {
    if (!dt.isValid) {
      throw new Error(`Invalid DateTime: ${dt.invalidExplanation ?? dt.invalidReason ?? 'unknown reason'}`);
    }
    const target = dt.toUTC();
    return target.toISODate() ?? target.toFormat('yyyy-LL-dd');
  }

  /**
   * Test helper: freeze time for deterministic tests
   */
  static _testNow?: DateTime;

  static setTestNow(dt: DateTime): void {
    this._testNow = dt;
  }

  static clearTestNow(): void {
    this._testNow = undefined;
  }
}

/**
 * Type guard for dual timestamp objects
 */
export function isDualTimestamp(obj: unknown): obj is DualTimestamp {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'business_time' in obj &&
    'system_time' in obj &&
    DateTime.isDateTime((obj as DualTimestamp).business_time) &&
    DateTime.isDateTime((obj as DualTimestamp).system_time)
  );
}

/**
 * Helper: Create business midnight in tenant timezone
 */
export function tenantMidnight(date: DateTime, tenant: Tenant): DateTime {
  return date.setZone(tenant.timezone).startOf('day');
}

/**
 * Helper: Format duration for display
 */
export function formatDuration(start: DateTime, end: DateTime): string {
  const diff = end.diff(start, ['days', 'hours', 'minutes']);
  const parts: string[] = [];
  
  if (diff.days > 0) parts.push(`${Math.floor(diff.days)}d`);
  if (diff.hours > 0) parts.push(`${Math.floor(diff.hours)}h`);
  if (diff.minutes > 0) parts.push(`${Math.floor(diff.minutes)}m`);
  
  return parts.join(' ') || '0m';
}

export default TimeService;
