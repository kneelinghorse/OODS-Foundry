import { DateTime } from 'luxon';

import TimeService from '@/services/time/index.js';
import type { RetryPolicy } from '@/traits/communication/runtime-types.js';

export interface RetrySchedulerOptions {
  readonly clock?: () => Date;
}

export class RetryScheduler {
  private readonly clock: () => Date;

  constructor(options: RetrySchedulerOptions = {}) {
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  scheduleRetry(attemptNumber: number, policy: RetryPolicy): Date | null {
    if (attemptNumber >= policy.maxAttempts) {
      return null;
    }
    const delayMs = Math.max(0, this.computeDelay(attemptNumber, policy));
    return DateTime.fromMillis(this.clock().getTime() + delayMs).toJSDate();
  }

  private computeDelay(attemptNumber: number, policy: RetryPolicy): number {
    switch (policy.strategy) {
      case 'linear':
        return policy.initialDelayMs + (attemptNumber > 0 ? (attemptNumber - 1) * (policy.linearIncrementMs ?? policy.initialDelayMs) : 0);
      case 'exponential':
        return clampBackoff(policy.initialDelayMs * Math.pow(2, Math.max(0, attemptNumber - 1)), policy.maxBackoffMs);
      case 'custom':
        return clampBackoff(policy.customSchedule?.(attemptNumber) ?? policy.initialDelayMs, policy.maxBackoffMs);
      case 'none':
      default:
        return policy.initialDelayMs;
    }
  }
}

function clampBackoff(value: number, ceiling?: number): number {
  if (typeof ceiling === 'number' && Number.isFinite(ceiling) && ceiling > 0) {
    return Math.min(value, ceiling);
  }
  return value;
}
