import { DateTime } from 'luxon';

import type { MessageState } from '@/schemas/communication/common.js';
import type { RuntimeLogger, SqlExecutor } from '@/traits/authz/runtime-types.js';

export type DeliveryStatus = MessageState | 'retry_exhausted';

export interface SLAMetrics {
  readonly value: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly count: number;
  readonly windowStart: Date;
  readonly windowEnd: Date;
}

export interface SLAMonitorOptions {
  readonly clock?: () => Date;
  readonly logger?: RuntimeLogger;
  readonly channelType?: string;
}

interface DeliveryRecord {
  readonly messageId: string;
  readonly queuedAt: Date;
  readonly sentAt: Date;
  readonly status: DeliveryStatus;
}

type MetricType = 'time_to_send' | 'success_rate' | 'retry_exhaustion_rate';

export class SLAMonitor {
  private readonly executor: SqlExecutor;
  private readonly clock: () => Date;
  private readonly logger?: RuntimeLogger;
  private readonly channelType: string;
  private readonly deliveries: DeliveryRecord[] = [];

  constructor(executor: SqlExecutor, options: SLAMonitorOptions = {}) {
    this.executor = executor;
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
    this.logger = options.logger;
    this.channelType = options.channelType ?? 'all';
  }

  async trackDelivery(messageId: string, queuedAt: Date, sentAt: Date, status: DeliveryStatus): Promise<void> {
    const record: DeliveryRecord = {
      messageId,
      queuedAt,
      sentAt,
      status,
    } satisfies DeliveryRecord;
    this.deliveries.push(record);

    const durationMs = Math.max(0, sentAt.getTime() - queuedAt.getTime());
    await this.persistMetric('time_to_send', {
      value: durationMs,
      p50: durationMs,
      p95: durationMs,
      p99: durationMs,
      count: 1,
      windowStart: queuedAt,
      windowEnd: sentAt,
    });
  }

  async getTimeToSendMetrics(windowHours: number): Promise<SLAMetrics> {
    const { windowStart, windowEnd } = this.resolveWindow(windowHours);
    const durations = this.deliveries
      .filter((record) => record.sentAt >= windowStart && record.sentAt <= windowEnd)
      .map((record) => Math.max(0, record.sentAt.getTime() - record.queuedAt.getTime()));

    const metrics = this.buildMetrics(durations, windowStart, windowEnd);
    await this.persistMetric('time_to_send', metrics);
    return metrics;
  }

  async getSuccessRateMetrics(windowHours: number): Promise<SLAMetrics> {
    const { windowStart, windowEnd } = this.resolveWindow(windowHours);
    const windowed = this.deliveries.filter((record) => record.sentAt >= windowStart && record.sentAt <= windowEnd);
    const total = windowed.length;
    if (total === 0) {
      const metrics = this.buildMetrics([], windowStart, windowEnd);
      await this.persistMetric('success_rate', metrics);
      return metrics;
    }
    const successes = windowed.filter((record) => record.status === 'delivered' || record.status === 'read').length;
    const successRate = (successes / total) * 100;
    const metrics: SLAMetrics = {
      value: round(successRate),
      p50: round(successRate),
      p95: round(successRate),
      p99: round(successRate),
      count: total,
      windowStart,
      windowEnd,
    } satisfies SLAMetrics;
    await this.persistMetric('success_rate', metrics);
    return metrics;
  }

  async getRetryExhaustionRate(windowHours: number): Promise<number> {
    const { windowStart, windowEnd } = this.resolveWindow(windowHours);
    const windowed = this.deliveries.filter((record) => record.sentAt >= windowStart && record.sentAt <= windowEnd);
    if (windowed.length === 0) {
      await this.persistMetric('retry_exhaustion_rate', {
        value: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        windowStart,
        windowEnd,
      });
      return 0;
    }
    const exhausted = windowed.filter((record) => record.status === 'retry_exhausted').length;
    const rate = round((exhausted / windowed.length) * 100);
    await this.persistMetric('retry_exhaustion_rate', {
      value: rate,
      p50: rate,
      p95: rate,
      p99: rate,
      count: windowed.length,
      windowStart,
      windowEnd,
    });
    return rate;
  }

  private resolveWindow(windowHours: number): { windowStart: Date; windowEnd: Date } {
    const end = this.clock();
    const start = DateTime.fromJSDate(end).minus({ hours: Math.max(0, windowHours) }).toJSDate();
    return { windowStart: start, windowEnd: end };
  }

  private buildMetrics(values: readonly number[], windowStart: Date, windowEnd: Date): SLAMetrics {
    if (values.length === 0) {
      return {
        value: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        windowStart,
        windowEnd,
      } satisfies SLAMetrics;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    return {
      value: round(avg),
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      count: sorted.length,
      windowStart,
      windowEnd,
    } satisfies SLAMetrics;
  }

  private async persistMetric(metricType: MetricType, metrics: SLAMetrics): Promise<void> {
    try {
      await this.executor.query(
        `INSERT INTO communication.sla_metrics (metric_type, channel_type, value, p50, p95, p99, window_start, window_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          metricType,
          this.channelType,
          metrics.value,
          metrics.p50,
          metrics.p95,
          metrics.p99,
          metrics.windowStart.toISOString(),
          metrics.windowEnd.toISOString(),
        ]
      );
    } catch (error) {
      this.logger?.warn?.('sla_metrics_persist_failed', { metricType, error });
    }
  }
}

function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.floor(percentileRank * (values.length - 1)));
  return round(values[index] ?? 0);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
import TimeService from '@/services/time/index.js';
