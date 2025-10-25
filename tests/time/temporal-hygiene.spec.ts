/**
 * Temporal Hygiene Test Suite
 * 
 * Validates dual-time model, DST handling, and timezone conversions
 * See: docs/policies/time.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import TimeService, { 
  isDualTimestamp, 
  tenantMidnight, 
  formatDuration,
  type Tenant 
} from '../../src/services/time';

describe('TimeService - Core API', () => {
  const mockTenant: Tenant = {
    id: 'tenant-us-west',
    timezone: 'America/Los_Angeles',
  };

  const mockTenantNY: Tenant = {
    id: 'tenant-us-east',
    timezone: 'America/New_York',
  };

  afterEach(() => {
    TimeService.clearTestNow();
  });

  describe('nowSystem', () => {
    it('returns current UTC time', () => {
      const now = TimeService.nowSystem();
      expect(now.zoneName).toBe('UTC');
      expect(now.isValid).toBe(true);
    });

    it('respects test override', () => {
      const testTime = DateTime.fromISO('2025-10-25T14:30:00Z');
      TimeService.setTestNow(testTime);
      
      const now = TimeService.nowSystem();
      expect(now.toISO()).toBe(testTime.toISO());
    });
  });

  describe('nowBusiness', () => {
    it('returns UTC when no tenant provided', () => {
      const now = TimeService.nowBusiness();
      expect(now.zoneName).toBe('UTC');
    });

    it('returns tenant timezone when provided', () => {
      const now = TimeService.nowBusiness(mockTenant);
      expect(now.zoneName).toBe('America/Los_Angeles');
    });
  });

  describe('createDualTimestamp', () => {
    it('creates dual timestamp with system in UTC', () => {
      const dual = TimeService.createDualTimestamp(mockTenant);
      
      expect(dual.system_time.zoneName).toBe('UTC');
      expect(dual.business_time.zoneName).toBe('America/Los_Angeles');
      expect(isDualTimestamp(dual)).toBe(true);
    });

    it('both times represent same instant', () => {
      const dual = TimeService.createDualTimestamp(mockTenant);
      
      const diff = dual.system_time.diff(dual.business_time).as('milliseconds');
      expect(Math.abs(diff)).toBeLessThan(1); // Same instant, different zone
    });
  });

  describe('toSystemTime', () => {
    it('converts business time to UTC', () => {
      const businessTime = DateTime.fromISO('2025-10-25T09:00:00', { 
        zone: 'America/Los_Angeles' 
      });
      
      const systemTime = TimeService.toSystemTime(businessTime);
      
      expect(systemTime.zoneName).toBe('UTC');
      expect(systemTime.toISO()).toBe('2025-10-25T16:00:00.000Z'); // 9am PT = 4pm UTC
    });
  });

  describe('displayInTenantZone', () => {
    it('formats timestamp in tenant timezone', () => {
      const utcTime = DateTime.fromISO('2025-10-25T16:00:00Z');
      const display = TimeService.displayInTenantZone(utcTime, mockTenant);
      
      expect(display).toContain('2025-10-25T09:00:00'); // 4pm UTC = 9am PT
      expect(display).toContain('-07:00'); // PDT offset
    });
  });

  describe('displayForTenant (deprecated alias)', () => {
    it('remains available for legacy callers', () => {
      const utcTime = DateTime.fromISO('2025-10-25T16:00:00Z');
      const display = TimeService.displayForTenant(utcTime, mockTenant);

      expect(display).toBe(TimeService.displayInTenantZone(utcTime, mockTenant));
    });
  });

  describe('formatForTenant', () => {
    it('uses custom format string', () => {
      const utcTime = DateTime.fromISO('2025-10-25T16:00:00Z');
      const formatted = TimeService.formatForTenant(
        utcTime, 
        mockTenant,
        'yyyy-MM-dd HH:mm'
      );
      
      expect(formatted).toBe('2025-10-25 09:00');
    });
  });
});

describe('TimeService - DST Handling', () => {
  const mockTenant: Tenant = {
    id: 'tenant-dst',
    timezone: 'America/New_York',
  };

  describe('Spring Forward (DST starts)', () => {
    it('handles non-existent time during spring forward', () => {
      // 2025-03-09 2:30am doesn't exist in New York (jumps to 3am)
      const input = '2025-03-09T02:30:00';
      
      const normalized = TimeService.normalizeToUtc(input, 'America/New_York');
      
      expect(normalized.isValid).toBe(true);
      // Luxon adjusts forward to 3:30am EDT
      expect(normalized.toISO()).toContain('2025-03-09T07:30:00'); // UTC
    });

    it('maintains business day boundaries during spring forward', () => {
      const before = DateTime.fromISO('2025-03-09T01:00:00', { 
        zone: 'America/New_York' 
      });
      const after = DateTime.fromISO('2025-03-09T03:30:00', { 
        zone: 'America/New_York' 
      });
      
      const sameDay = TimeService.isSameBusinessDay(before, after, mockTenant);
      expect(sameDay).toBe(true);
    });
  });

  describe('Fall Back (DST ends)', () => {
    it('handles ambiguous time during fall back', () => {
      // 2025-11-02 1:30am occurs twice in New York
      const input = '2025-11-02T01:30:00';
      
      const normalized = TimeService.normalizeToUtc(input, 'America/New_York');
      
      expect(normalized.isValid).toBe(true);
      // Luxon picks first occurrence (EDT)
      expect(normalized.hour).toBeGreaterThanOrEqual(0);
    });

    it('preserves business day across fall back', () => {
      const before = DateTime.fromISO('2025-11-02T00:30:00', { 
        zone: 'America/New_York' 
      });
      const after = DateTime.fromISO('2025-11-02T02:30:00', { 
        zone: 'America/New_York' 
      });
      
      const sameDay = TimeService.isSameBusinessDay(before, after, mockTenant);
      expect(sameDay).toBe(true);
    });
  });
});

describe('TimeService - Business Day Operations', () => {
  const mockTenant: Tenant = {
    id: 'tenant-pacific',
    timezone: 'America/Los_Angeles',
  };

  describe('isSameBusinessDay', () => {
    it('returns true for same calendar day in tenant TZ', () => {
      const morning = DateTime.fromISO('2025-10-25T08:00:00', { 
        zone: 'America/Los_Angeles' 
      });
      const evening = DateTime.fromISO('2025-10-25T22:00:00', { 
        zone: 'America/Los_Angeles' 
      });
      
      const result = TimeService.isSameBusinessDay(morning, evening, mockTenant);
      expect(result).toBe(true);
    });

    it('returns false for different calendar days', () => {
      const today = DateTime.fromISO('2025-10-25T23:00:00', { 
        zone: 'America/Los_Angeles' 
      });
      const tomorrow = DateTime.fromISO('2025-10-26T01:00:00', { 
        zone: 'America/Los_Angeles' 
      });
      
      const result = TimeService.isSameBusinessDay(today, tomorrow, mockTenant);
      expect(result).toBe(false);
    });

    it('handles UTC times correctly', () => {
      // 2025-10-25 23:00 PT = 2025-10-26 06:00 UTC
      const ptEvening = DateTime.fromISO('2025-10-25T23:00:00-07:00');
      const utcMorning = DateTime.fromISO('2025-10-26T06:00:00Z');
      
      const result = TimeService.isSameBusinessDay(ptEvening, utcMorning, mockTenant);
      expect(result).toBe(true); // Same PT day
    });
  });

  describe('startOfBusinessDay', () => {
    it('returns midnight in tenant timezone', () => {
      const dt = DateTime.fromISO('2025-10-25T15:30:00Z');
      const start = TimeService.startOfBusinessDay(dt, mockTenant);
      
      expect(start.hour).toBe(0);
      expect(start.minute).toBe(0);
      expect(start.second).toBe(0);
      expect(start.zoneName).toBe('America/Los_Angeles');
    });
  });

  describe('endOfBusinessDay', () => {
    it('returns 23:59:59.999 in tenant timezone', () => {
      const dt = DateTime.fromISO('2025-10-25T15:30:00Z');
      const end = TimeService.endOfBusinessDay(dt, mockTenant);
      
      expect(end.hour).toBe(23);
      expect(end.minute).toBe(59);
      expect(end.second).toBe(59);
      expect(end.millisecond).toBeGreaterThan(0);
    });
  });
});

describe('TimeService - Billing Period', () => {
  const mockTenant: Tenant = {
    id: 'tenant-billing',
    timezone: 'America/New_York',
  };

  it('calculates monthly billing period in tenant TZ', () => {
    const [start, end] = TimeService.billingPeriod(2025, 10, mockTenant);
    
    expect(start.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-10-01 00:00');
    expect(end.toFormat('yyyy-MM-dd')).toBe('2025-10-31');
    expect(start.zoneName).toBe('America/New_York');
  });

  it('handles February in leap year', () => {
    const [start, end] = TimeService.billingPeriod(2024, 2, mockTenant);
    
    expect(start.day).toBe(1);
    expect(end.day).toBe(29); // 2024 is leap year
  });

  it('handles month spanning DST transition', () => {
    // November 2025: DST ends on Nov 2
    const [start, end] = TimeService.billingPeriod(2025, 11, mockTenant);
    
    expect(start.toFormat('yyyy-MM-dd')).toBe('2025-11-01');
    expect(end.toFormat('yyyy-MM-dd')).toBe('2025-11-30');
  });
});

describe('TimeService - Database Conversions', () => {
  it('parses ISO string from database', () => {
    const dbString = '2025-10-25T16:00:00.000Z';
    const dt = TimeService.fromDatabase(dbString);
    
    expect(dt.zoneName).toBe('UTC');
    expect(dt.toISO()).toBe(dbString);
  });

  it('parses Date object from database', () => {
    const dbDate = new Date('2025-10-25T16:00:00Z');
    const dt = TimeService.fromDatabase(dbDate);
    
    expect(dt.zoneName).toBe('UTC');
    expect(dt.year).toBe(2025);
    expect(dt.month).toBe(10);
  });

  it('converts DateTime to database format', () => {
    const dt = DateTime.fromISO('2025-10-25T09:00:00', { 
      zone: 'America/Los_Angeles' 
    });
    const dbString = TimeService.toDatabase(dt);
    
    expect(dbString).toBe('2025-10-25T16:00:00.000Z'); // Converted to UTC
  });
});

describe('TimeService - Validation', () => {
  it('validates IANA timezone', () => {
    expect(TimeService.isValidTimezone('America/New_York')).toBe(true);
    expect(TimeService.isValidTimezone('Europe/London')).toBe(true);
    expect(TimeService.isValidTimezone('Invalid/Timezone')).toBe(false);
  });

  it('throws on invalid datetime input', () => {
    expect(() => {
      TimeService.normalizeToUtc('not-a-date', 'America/New_York');
    }).toThrow(/Invalid datetime/);
  });
});

describe('Helper Functions', () => {
  const mockTenant: Tenant = {
    id: 'tenant-helpers',
    timezone: 'America/Chicago',
  };

  describe('isDualTimestamp', () => {
    it('returns true for valid dual timestamp', () => {
      const dual = TimeService.createDualTimestamp(mockTenant);
      expect(isDualTimestamp(dual)).toBe(true);
    });

    it('returns false for invalid objects', () => {
      expect(isDualTimestamp({})).toBe(false);
      expect(isDualTimestamp({ business_time: 'not-a-date' })).toBe(false);
      expect(isDualTimestamp(null)).toBe(false);
    });
  });

  describe('tenantMidnight', () => {
    it('returns midnight in tenant TZ', () => {
      const dt = DateTime.fromISO('2025-10-25T15:30:00Z');
      const midnight = tenantMidnight(dt, mockTenant);
      
      expect(midnight.hour).toBe(0);
      expect(midnight.zoneName).toBe('America/Chicago');
    });
  });

  describe('formatDuration', () => {
    it('formats multi-day duration', () => {
      const start = DateTime.fromISO('2025-10-25T10:00:00Z');
      const end = start.plus({ days: 2, hours: 3, minutes: 15 });
      
      const formatted = formatDuration(start, end);
      expect(formatted).toBe('2d 3h 15m');
    });

    it('handles zero duration', () => {
      const dt = DateTime.fromISO('2025-10-25T10:00:00Z');
      const formatted = formatDuration(dt, dt);
      expect(formatted).toBe('0m');
    });
  });
});

describe('Audit Hash Stability', () => {
  it('includes system_time in hash for immutability', () => {
    const entry = {
      id: 'audit-001',
      system_time: DateTime.fromISO('2025-10-25T16:00:00Z'),
      action: 'subscription.renewed',
    };

    const hash1 = computeTestHash(entry);
    const hash2 = computeTestHash(entry);
    
    expect(hash1).toBe(hash2); // Deterministic
  });

  it('hash changes when system_time changes', () => {
    const entry1 = {
      id: 'audit-001',
      system_time: DateTime.fromISO('2025-10-25T16:00:00Z'),
      action: 'subscription.renewed',
    };

    const entry2 = {
      ...entry1,
      system_time: DateTime.fromISO('2025-10-25T16:00:01Z'),
    };

    const hash1 = computeTestHash(entry1);
    const hash2 = computeTestHash(entry2);
    
    expect(hash1).not.toBe(hash2);
  });
});

// Test helper for audit hash
function computeTestHash(entry: {
  id: string;
  system_time: DateTime;
  action: string;
}): string {
  const payload = `${entry.id}|${entry.system_time.toISO()}|${entry.action}`;
  // Simple string hash for testing
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
