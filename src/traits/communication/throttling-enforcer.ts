import { DateTime } from 'luxon';

import TimeService from '@/services/time/index.js';
import type { ChannelType, PriorityLevel } from '@/schemas/communication/common.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import type { RuntimeLogger } from '@/traits/authz/runtime-types.js';

import { InMemoryThrottlingStore, type ThrottlingStore } from './throttling-store.js';

export interface ThrottleResult {
  readonly allowed: boolean;
  readonly retryAfter?: Date;
  readonly currentRate: number;
}

export interface ThrottlingEnforcerOptions {
  readonly store?: ThrottlingStore;
  readonly clock?: () => Date;
  readonly logger?: RuntimeLogger;
}

export interface ThrottlingDiagnostics {
  readonly allowed: number;
  readonly blocked: number;
  readonly lastMinuteRate: number;
  readonly lastHourRate: number;
  readonly lastDayRate: number;
}

const WINDOW_MINUTE = 60;
const WINDOW_HOUR = 60 * 60;
const WINDOW_DAY = 60 * 60 * 24;
const CLEANUP_WINDOW = WINDOW_DAY * 2;

export class ThrottlingEnforcer {
  private readonly store: ThrottlingStore;
  private readonly clock: () => Date;
  private readonly logger?: RuntimeLogger;
  private metrics = { allowed: 0, blocked: 0, minute: 0, hour: 0, day: 0 };

  constructor(options: ThrottlingEnforcerOptions = {}) {
    this.store = options.store ?? new InMemoryThrottlingStore({ clock: options.clock });
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
    this.logger = options.logger;
  }

  async checkThrottle(userId: string, channelType: ChannelType, policy?: DeliveryPolicy | null): Promise<ThrottleResult> {
    const now = this.clock();
    const throttling = policy?.throttling;

    if (!throttling) {
      await this.store.recordSend(userId, channelType, now);
      this.recordMetrics(true, 0, 0, 0);
      return { allowed: true, currentRate: 0 } satisfies ThrottleResult;
    }

    await this.store.cleanupOldEntries(CLEANUP_WINDOW, now);

    const minuteCount = await this.store.getSendCount(userId, channelType, WINDOW_MINUTE, now);
    const hourCount = await this.store.getSendCount(userId, channelType, WINDOW_HOUR, now);
    const dayCount = await this.store.getSendCount(userId, channelType, WINDOW_DAY, now);

    const isUrgentBypass = isUrgent(policy?.priority) && minuteCount < resolveBurstLimit(policy);
    if (isUrgentBypass) {
      await this.store.recordSend(userId, channelType, now);
      this.recordMetrics(true, minuteCount + 1, hourCount + 1, dayCount + 1);
      return { allowed: true, currentRate: minuteCount + 1 } satisfies ThrottleResult;
    }

    const windowExceeded = this.selectExceededWindow(throttling, minuteCount, hourCount, dayCount);
    if (!windowExceeded) {
      await this.store.recordSend(userId, channelType, now);
      const rate = minuteCount + 1;
      this.recordMetrics(true, rate, hourCount + 1, dayCount + 1);
      return { allowed: true, currentRate: rate } satisfies ThrottleResult;
    }

    const retryAfter = await this.computeRetryAfter(userId, channelType, windowExceeded.windowSeconds, now);
    this.recordMetrics(false, minuteCount, hourCount, dayCount);
    this.logger?.warn?.('delivery_throttled', {
      userId,
      channelType,
      window: windowExceeded.windowSeconds,
      limit: windowExceeded.limit,
    });
    return {
      allowed: false,
      retryAfter,
      currentRate: minuteCount,
    } satisfies ThrottleResult;
  }

  getDiagnostics(): ThrottlingDiagnostics {
    return {
      allowed: this.metrics.allowed,
      blocked: this.metrics.blocked,
      lastMinuteRate: this.metrics.minute,
      lastHourRate: this.metrics.hour,
      lastDayRate: this.metrics.day,
    } satisfies ThrottlingDiagnostics;
  }

  private selectExceededWindow(
    throttling: DeliveryPolicy['throttling'],
    minuteCount: number,
    hourCount: number,
    dayCount: number
  ): { readonly windowSeconds: number; readonly limit: number } | null {
    if (throttling.max_per_minute > 0 && minuteCount >= throttling.max_per_minute) {
      return { windowSeconds: WINDOW_MINUTE, limit: throttling.max_per_minute } as const;
    }
    if (throttling.max_per_hour > 0 && hourCount >= throttling.max_per_hour) {
      return { windowSeconds: WINDOW_HOUR, limit: throttling.max_per_hour } as const;
    }
    if (throttling.max_per_day > 0 && dayCount >= throttling.max_per_day) {
      return { windowSeconds: WINDOW_DAY, limit: throttling.max_per_day } as const;
    }
    return null;
  }

  private async computeRetryAfter(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now: Date
  ): Promise<Date> {
    const oldest = await this.store.getOldestTimestamp(userId, channelType, windowSeconds, now);
    const fallback = now.getTime() + windowSeconds * 1000;
    const millis = oldest ? oldest.getTime() + windowSeconds * 1000 : fallback;
    return DateTime.fromMillis(millis, { zone: 'utc' }).toJSDate();
  }

  private recordMetrics(allowed: boolean, minuteRate: number, hourRate: number, dayRate: number): void {
    if (allowed) {
      this.metrics.allowed += 1;
    } else {
      this.metrics.blocked += 1;
    }
    this.metrics.minute = minuteRate;
    this.metrics.hour = hourRate;
    this.metrics.day = dayRate;
  }
}

function isUrgent(priority: PriorityLevel | undefined): boolean {
  return priority === 'urgent';
}

function resolveBurstLimit(policy: DeliveryPolicy | null | undefined): number {
  const raw = policy?.metadata?.burst_limit;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.trunc(raw));
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return Number.MAX_SAFE_INTEGER;
}
