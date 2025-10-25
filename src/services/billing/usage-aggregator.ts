/**
 * Usage Aggregator Service
 * 
 * Aggregates raw usage events into daily/weekly/monthly summaries
 * for invoice generation and reporting.
 * 
 * @module services/billing/usage-aggregator
 */

import { DateTime } from 'luxon';
import type { UsageEvent, UsageEventInput, UsageSummary, AggregationPeriod } from '../../domain/billing/usage.js';
import {
  validateUsageEvent,
  generateUsageEventId,
  generateUsageSummaryId,
} from '../../domain/billing/usage.js';
import {
  InMemoryUsageEventRepository,
  InMemoryUsageSummaryRepository,
  type UsageEventRepository,
  type UsageSummaryRepository,
} from './usage-repositories.js';
import TimeService, { type Tenant } from '../time';

type UsageEventGroup = {
  events: UsageEvent[];
  timezone?: string;
  periodStart: DateTime;
  periodEnd: DateTime;
};

/**
 * Date range for aggregation
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  period?: AggregationPeriod;
  tenantId?: string;
  subscriptionId?: string;
}

/**
 * Usage aggregation result
 */
export interface AggregationResult {
  summaries: UsageSummary[];
  eventCount: number;
  processedAt: string;
}

/**
 * Usage Aggregator Service
 */
export class UsageAggregator {
  private readonly eventRepository: UsageEventRepository;
  private readonly summaryRepository: UsageSummaryRepository;
  private readonly now: () => DateTime;

  constructor(options: {
    eventRepository?: UsageEventRepository;
    summaryRepository?: UsageSummaryRepository;
    clock?: () => Date;
  } = {}) {
    this.eventRepository = options.eventRepository ?? new InMemoryUsageEventRepository();
    this.summaryRepository = options.summaryRepository ?? new InMemoryUsageSummaryRepository();
    const clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
    this.now = () => TimeService.fromDatabase(clock());
  }
  
  /**
   * Record a usage event
   */
  async recordEvent(input: UsageEventInput): Promise<UsageEvent> {
    // Validate input
    const validation = validateUsageEvent(input);
    if (!validation.valid) {
      throw new Error(`Invalid usage event: ${validation.errors.join(', ')}`);
    }
    
    const systemNow = this.now();
    const recordedAt = input.recordedAt ?? TimeService.toIsoString(systemNow);
    
    // Create event
    const event: UsageEvent = {
      eventId: generateUsageEventId(input),
      subscriptionId: input.subscriptionId,
      tenantId: input.tenantId,
      meterName: input.meterName,
      unit: input.unit,
      quantity: input.quantity,
      recordedAt,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
      createdAt: TimeService.toIsoString(systemNow),
    };
    
    await this.eventRepository.add(event);
    return event;
  }
  
  /**
   * Record multiple usage events
   */
  async recordEvents(inputs: UsageEventInput[]): Promise<UsageEvent[]> {
    const events: UsageEvent[] = [];
    for (const input of inputs) {
      const event = await this.recordEvent(input);
      events.push(event);
    }
    return events;
  }
  
  /**
   * Run aggregation for a date range
   */
  async aggregate(
    dateRange: DateRange,
    options: AggregationOptions = {}
  ): Promise<AggregationResult> {
    const { period = 'daily', tenantId, subscriptionId } = options;
    
    // Fetch events in range
    let events: UsageEvent[];
    if (subscriptionId) {
      events = await this.eventRepository.getBySubscription(
        subscriptionId,
        dateRange.start,
        dateRange.end
      );
    } else if (tenantId) {
      events = await this.eventRepository.getByDateRange(
        tenantId,
        dateRange.start,
        dateRange.end
      );
    } else {
      throw new Error('Either tenantId or subscriptionId must be provided');
    }
    
    // Group events by subscription + meter + period
    const groups = this.groupEvents(events, period);
    
    // Generate summaries
    const summaries: UsageSummary[] = [];
    for (const groupEvents of Object.values(groups)) {
      const summary = this.createSummary(groupEvents, period);
      await this.summaryRepository.add(summary);
      summaries.push(summary);
    }
    
    return {
      summaries,
      eventCount: events.length,
      processedAt: TimeService.toIsoString(this.now()),
    };
  }
  
  /**
   * Get usage summaries for a subscription
   */
  async getSummaries(
    subscriptionId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<UsageSummary[]> {
    return this.summaryRepository.getBySubscription(subscriptionId, periodStart, periodEnd);
  }
  
  /**
   * Get usage events for a subscription
   */
  async getEvents(
    subscriptionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<UsageEvent[]> {
    return this.eventRepository.getBySubscription(subscriptionId, startDate, endDate);
  }
  
  /**
   * Clear all data (for testing)
   */
  async clearAll(): Promise<void> {
    await this.eventRepository.clear();
    await this.summaryRepository.clear();
  }
  
  /**
   * Get event count
   */
  async getEventCount(): Promise<number> {
    return this.eventRepository.count();
  }
  
  /**
   * Group events by subscription + meter + period
   */
  private groupEvents(events: UsageEvent[], period: AggregationPeriod): Record<string, UsageEventGroup> {
    const groups: Record<string, UsageEventGroup> = {};

    for (const event of events) {
      const timezone = this.extractTimezone(event);
      const periodStart = this.getPeriodStart(event.recordedAt, period, timezone);
      const periodEnd = this.getPeriodEnd(periodStart, period);
      const key = `${event.subscriptionId}:${event.meterName}:${TimeService.toIsoString(periodStart)}::${timezone ?? 'UTC'}`;

      if (!groups[key]) {
        groups[key] = {
          events: [],
          timezone,
          periodStart,
          periodEnd,
        };
      }
      groups[key].events.push(event);
    }
    
    return groups;
  }
  
  /**
   * Create usage summary from events
   */
  private createSummary(
    group: UsageEventGroup,
    period: AggregationPeriod
  ): UsageSummary {
    const { events, timezone, periodStart, periodEnd } = group;

    if (events.length === 0) {
      throw new Error('Cannot create summary from empty events array');
    }

    const first = events[0];
    const totalQuantity = events.reduce((sum, e) => sum + e.quantity, 0);
    const quantities = events.map((e) => e.quantity);
    const tenant = this.toTenant(first.tenantId, timezone);
    const dualTimestamp = TimeService.createDualTimestamp(tenant);
    const periodStartIso = TimeService.toIsoString(periodStart);
    const periodEndIso = TimeService.toIsoString(periodEnd);
    const businessBoundary = periodEnd;
    const aggregatedBusinessIso = TimeService.toIsoString(businessBoundary, { preserveZone: true });
    const systemIso = TimeService.toIsoString(dualTimestamp.system_time);
    
    return {
      summaryId: generateUsageSummaryId(first.subscriptionId, first.meterName, periodStartIso),
      subscriptionId: first.subscriptionId,
      tenantId: first.tenantId,
      meterName: first.meterName,
      unit: first.unit,
      period,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      totalQuantity,
      eventCount: events.length,
      minQuantity: Math.min(...quantities),
      maxQuantity: Math.max(...quantities),
      avgQuantity: totalQuantity / events.length,
      aggregatedAt: aggregatedBusinessIso,
      createdAt: systemIso,
      business_time: businessBoundary,
      system_time: dualTimestamp.system_time,
    };
  }
  
  /**
   * Get period start for a date
   */
  private getPeriodStart(date: string, period: AggregationPeriod, timezone?: string): DateTime {
    const zone = this.resolveZone(timezone);
    let dt = TimeService.normalizeToUtc(date).setZone(zone);

    if (period === 'weekly') {
      const weekdayIndex = dt.weekday % 7; // Convert Sunday to 0
      dt = dt.minus({ days: weekdayIndex }).startOf('day');
    } else if (period === 'monthly') {
      dt = dt.startOf('month');
    } else {
      dt = dt.startOf('day');
    }

    return dt;
  }

  /**
   * Get period end for a period start
   */
  private getPeriodEnd(periodStart: DateTime, period: AggregationPeriod): DateTime {
    if (period === 'weekly') {
      return periodStart.plus({ weeks: 1 });
    }
    if (period === 'monthly') {
      return periodStart.plus({ months: 1 });
    }
    return periodStart.plus({ days: 1 });
  }

  private extractTimezone(event: UsageEvent): string | undefined {
    const candidate = event.metadata?.timezone;
    if (typeof candidate === 'string' && TimeService.isValidTimezone(candidate)) {
      return candidate;
    }
    return undefined;
  }

  private resolveZone(timezone?: string): string {
    return timezone && TimeService.isValidTimezone(timezone) ? timezone : 'UTC';
  }

  private toTenant(tenantId: string, timezone?: string): Tenant | undefined {
    if (!timezone || !TimeService.isValidTimezone(timezone)) {
      return undefined;
    }
    return {
      id: tenantId,
      timezone,
    };
  }
}

/**
 * Singleton instance
 */
export const usageAggregator = new UsageAggregator();
