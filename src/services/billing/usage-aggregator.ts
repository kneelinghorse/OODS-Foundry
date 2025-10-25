/**
 * Usage Aggregator Service
 * 
 * Aggregates raw usage events into daily/weekly/monthly summaries
 * for invoice generation and reporting.
 * 
 * @module services/billing/usage-aggregator
 */

import type {
  UsageEvent,
  UsageEventInput,
  UsageSummary,
  AggregationPeriod,
  MeterUnit,
} from '../../domain/billing/usage.js';
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
  private readonly now: () => Date;

  constructor(options: {
    eventRepository?: UsageEventRepository;
    summaryRepository?: UsageSummaryRepository;
    clock?: () => Date;
  } = {}) {
    this.eventRepository = options.eventRepository ?? new InMemoryUsageEventRepository();
    this.summaryRepository = options.summaryRepository ?? new InMemoryUsageSummaryRepository();
    this.now = options.clock ?? (() => new Date());
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
    
    // Create event
    const event: UsageEvent = {
      eventId: generateUsageEventId(input),
      subscriptionId: input.subscriptionId,
      tenantId: input.tenantId,
      meterName: input.meterName,
      unit: input.unit,
      quantity: input.quantity,
      recordedAt: input.recordedAt || this.now().toISOString(),
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
      createdAt: this.now().toISOString(),
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
    for (const [key, groupEvents] of Object.entries(groups)) {
      const summary = this.createSummary(groupEvents, period);
      await this.summaryRepository.add(summary);
      summaries.push(summary);
    }
    
    return {
      summaries,
      eventCount: events.length,
      processedAt: new Date().toISOString(),
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
  private groupEvents(events: UsageEvent[], period: AggregationPeriod): Record<string, UsageEvent[]> {
    const groups: Record<string, UsageEvent[]> = {};
    
    for (const event of events) {
      const periodStart = this.getPeriodStart(event.recordedAt, period);
      const key = `${event.subscriptionId}:${event.meterName}:${periodStart}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    }
    
    return groups;
  }
  
  /**
   * Create usage summary from events
   */
  private createSummary(
    events: UsageEvent[],
    period: AggregationPeriod
  ): UsageSummary {
    if (events.length === 0) {
      throw new Error('Cannot create summary from empty events array');
    }
    
    const first = events[0];
    const periodStart = this.getPeriodStart(first.recordedAt, period);
    const periodEnd = this.getPeriodEnd(periodStart, period);
    
    const totalQuantity = events.reduce((sum, e) => sum + e.quantity, 0);
    const quantities = events.map((e) => e.quantity);
    const timestamp = this.now().toISOString();
    
    return {
      summaryId: generateUsageSummaryId(first.subscriptionId, first.meterName, periodStart),
      subscriptionId: first.subscriptionId,
      tenantId: first.tenantId,
      meterName: first.meterName,
      unit: first.unit,
      period,
      periodStart,
      periodEnd,
      totalQuantity,
      eventCount: events.length,
      minQuantity: Math.min(...quantities),
      maxQuantity: Math.max(...quantities),
      avgQuantity: totalQuantity / events.length,
      aggregatedAt: timestamp,
      createdAt: timestamp,
    };
  }
  
  /**
   * Get period start for a date
   */
  private getPeriodStart(date: string, period: AggregationPeriod): string {
    const d = new Date(date);
    
    if (period === 'daily') {
      d.setUTCHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day); // Start on Sunday
      d.setUTCHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
    }
    
    return d.toISOString();
  }
  
  /**
   * Get period end for a period start
   */
  private getPeriodEnd(periodStart: string, period: AggregationPeriod): string {
    const d = new Date(periodStart);
    
    if (period === 'daily') {
      d.setUTCDate(d.getUTCDate() + 1);
    } else if (period === 'weekly') {
      d.setUTCDate(d.getUTCDate() + 7);
    } else if (period === 'monthly') {
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    
    return d.toISOString();
  }
}

/**
 * Singleton instance
 */
export const usageAggregator = new UsageAggregator();
