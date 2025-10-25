/**
 * Usage Aggregator Tests
 * 
 * Test suite for usage event recording and aggregation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UsageAggregator } from '../../src/services/billing/usage-aggregator.js';
import type { UsageEventInput } from '../../src/domain/billing/usage.js';
import {
  validateUsageEvent,
  calculateOverage,
  formatUsageQuantity,
  generateUsageEventId,
  generateUsageSummaryId,
} from '../../src/domain/billing/usage.js';

describe('Usage Aggregator', () => {
  let aggregator: UsageAggregator;
  
  beforeEach(async () => {
    aggregator = new UsageAggregator();
    await aggregator.clearAll();
  });
  
  describe('Event Recording', () => {
    it('should record a valid usage event', async () => {
      const input: UsageEventInput = {
        subscriptionId: 'sub_001',
        tenantId: 'tenant_001',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 100,
        source: 'api_gateway',
      };
      
      const event = await aggregator.recordEvent(input);
      
      expect(event.eventId).toBeDefined();
      expect(event.subscriptionId).toBe('sub_001');
      expect(event.meterName).toBe('api_calls');
      expect(event.quantity).toBe(100);
      expect(event.createdAt).toBeDefined();
    });
    
    it('should reject invalid usage event', async () => {
      const input: UsageEventInput = {
        subscriptionId: '',
        tenantId: 'tenant_001',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: -10, // Invalid negative quantity
        source: 'api_gateway',
      };
      
      await expect(aggregator.recordEvent(input)).rejects.toThrow('Invalid usage event');
    });
    
    it('should handle idempotency keys', async () => {
      const input: UsageEventInput = {
        subscriptionId: 'sub_001',
        tenantId: 'tenant_001',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 100,
        source: 'api_gateway',
        idempotencyKey: 'unique_key_001',
      };
      
      // Record same event twice
      const event1 = await aggregator.recordEvent(input);
      const event2 = await aggregator.recordEvent(input);
      
      // Should only record once
      const count = await aggregator.getEventCount();
      expect(count).toBe(1);
    });
    
    it('should record multiple events', async () => {
      const inputs: UsageEventInput[] = [
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'compute_hours',
          unit: 'compute_hours',
          quantity: 2.5,
          source: 'background_job',
        },
      ];
      
      const events = await aggregator.recordEvents(inputs);
      
      expect(events).toHaveLength(2);
      expect(events[0].meterName).toBe('api_calls');
      expect(events[1].meterName).toBe('compute_hours');
    });
  });
  
  describe('Event Retrieval', () => {
    beforeEach(async () => {
      // Seed with test events
      await aggregator.recordEvents([
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-01T10:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 200,
          recordedAt: '2025-01-01T14:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_002',
          tenantId: 'tenant_001',
          meterName: 'storage_gb',
          unit: 'storage_gb',
          quantity: 50,
          recordedAt: '2025-01-01T12:00:00Z',
          source: 'background_job',
        },
      ]);
    });
    
    it('should retrieve events by subscription', async () => {
      const events = await aggregator.getEvents('sub_001');
      
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.subscriptionId === 'sub_001')).toBe(true);
    });
    
    it('should filter events by date range', async () => {
      const events = await aggregator.getEvents(
        'sub_001',
        '2025-01-01T00:00:00Z',
        '2025-01-01T12:00:00Z'
      );
      
      expect(events).toHaveLength(1);
      expect(events[0].quantity).toBe(100);
    });
  });
  
  describe('Aggregation', () => {
    beforeEach(async () => {
      // Seed with events across multiple days
      const events: UsageEventInput[] = [];
      
      // Day 1: 2025-01-01
      events.push(
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-01T06:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-01T12:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-01T18:00:00Z',
          source: 'api_gateway',
        }
      );
      
      // Day 2: 2025-01-02
      events.push(
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-02T06:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-02T12:00:00Z',
          source: 'api_gateway',
        }
      );
      
      // Day 3: 2025-01-03
      events.push(
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-03T06:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-03T12:00:00Z',
          source: 'api_gateway',
        },
        {
          subscriptionId: 'sub_001',
          tenantId: 'tenant_001',
          meterName: 'api_calls',
          unit: 'api_calls',
          quantity: 100,
          recordedAt: '2025-01-03T18:00:00Z',
          source: 'api_gateway',
        }
      );
      
      await aggregator.recordEvents(events);
    });
    
    it('should aggregate events by day', async () => {
      const result = await aggregator.aggregate(
        {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-04T00:00:00Z',
        },
        {
          period: 'daily',
          tenantId: 'tenant_001',
        }
      );
      
      expect(result.summaries).toHaveLength(3); // 3 days
      expect(result.eventCount).toBe(8); // 3 + 2 + 3 events
      
      // Check first day summary
      const day1 = result.summaries.find((s) => s.periodStart.startsWith('2025-01-01'));
      expect(day1).toBeDefined();
      expect(day1?.totalQuantity).toBe(300); // 3 events × 100
      expect(day1?.eventCount).toBe(3);
      expect(day1?.avgQuantity).toBe(100);
      expect(day1?.business_time.toUTC().toISO()).toBe(day1?.periodEnd);
      expect(day1?.system_time.zoneName).toBe('UTC');
    });
    
    it('should calculate summary statistics', async () => {
      const result = await aggregator.aggregate(
        {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-02T00:00:00Z',
        },
        {
          period: 'daily',
          subscriptionId: 'sub_001',
        }
      );
      
      const summary = result.summaries[0];
      
      expect(summary.minQuantity).toBe(100);
      expect(summary.maxQuantity).toBe(100);
      expect(summary.avgQuantity).toBe(100);
      expect(summary.totalQuantity).toBe(300); // 3 events on day 1
    });
    
    it('should retrieve summaries by subscription', async () => {
      // Aggregate first
      await aggregator.aggregate(
        {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-04T00:00:00Z',
        },
        {
          period: 'daily',
          subscriptionId: 'sub_001',
        }
      );
      
      // Retrieve summaries
      const summaries = await aggregator.getSummaries('sub_001');
      
      expect(summaries).toHaveLength(3);
      expect(summaries.every((s) => s.subscriptionId === 'sub_001')).toBe(true);
    });
  });
  
  describe('Validation', () => {
    it('should validate correct event input', () => {
      const input: UsageEventInput = {
        subscriptionId: 'sub_001',
        tenantId: 'tenant_001',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 100,
        source: 'api_gateway',
      };
      
      const result = validateUsageEvent(input);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing required fields', () => {
      const input = {
        subscriptionId: '',
        tenantId: '',
        meterName: '',
        unit: 'api_calls',
        quantity: -10,
        source: '',
      } as UsageEventInput;
      
      const result = validateUsageEvent(input);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('subscriptionId is required');
      expect(result.errors).toContain('quantity must be a non-negative number');
    });
  });
  
  describe('Utility Functions', () => {
    it('should calculate overage correctly', () => {
      const overage = calculateOverage(1500, 1000, 10);
      
      expect(overage).toBe(5000); // 500 overage × $0.10
    });
    
    it('should handle no overage', () => {
      const overage = calculateOverage(800, 1000, 10);
      
      expect(overage).toBe(0);
    });
    
    it('should format usage quantity', () => {
      const formatted = formatUsageQuantity(1234.56, 'api_calls');
      
      expect(formatted).toBe('1,234.56 api_calls');
    });
    
    it('should generate event ID with idempotency key', () => {
      const input: UsageEventInput = {
        subscriptionId: 'sub_001',
        tenantId: 'tenant_001',
        meterName: 'api_calls',
        unit: 'api_calls',
        quantity: 100,
        source: 'api_gateway',
        idempotencyKey: 'unique_key',
      };
      
      const id = generateUsageEventId(input);
      
      expect(id).toBe('evt_unique_key');
    });
    
    it('should generate summary ID', () => {
      const id = generateUsageSummaryId('sub_001', 'api_calls', '2025-01-01T00:00:00Z');
      
      expect(id).toBe('sum_sub_001_api_calls_2025-01-01');
    });
  });
});
