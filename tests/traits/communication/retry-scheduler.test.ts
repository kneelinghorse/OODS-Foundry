import { describe, expect, it } from 'vitest';

import { RetryScheduler } from '@/traits/communication/retry-scheduler.js';
import type { RetryPolicy } from '@/traits/communication/runtime-types.js';

const BASE_DATE = new Date('2025-11-20T12:00:00Z');

function scheduler() {
  return new RetryScheduler({ clock: () => BASE_DATE });
}

describe('RetryScheduler', () => {
  it('applies exponential backoff with cap', () => {
    const policy: RetryPolicy = {
      strategy: 'exponential',
      initialDelayMs: 60_000,
      maxAttempts: 5,
      maxBackoffMs: 15 * 60_000,
    };
    const service = scheduler();
    const first = service.scheduleRetry(1, policy);
    const second = service.scheduleRetry(2, policy);
    expect(first?.toISOString()).toBe('2025-11-20T12:01:00.000Z');
    expect(second?.toISOString()).toBe('2025-11-20T12:02:00.000Z');
  });

  it('returns null when max attempts exceeded', () => {
    const policy: RetryPolicy = {
      strategy: 'linear',
      initialDelayMs: 30_000,
      linearIncrementMs: 30_000,
      maxAttempts: 1,
    };
    const service = scheduler();
    expect(service.scheduleRetry(1, policy)).toBeNull();
  });

  it('supports linear increments', () => {
    const policy: RetryPolicy = {
      strategy: 'linear',
      initialDelayMs: 15_000,
      linearIncrementMs: 15_000,
      maxAttempts: 4,
    };
    const service = scheduler();
    const third = service.scheduleRetry(3, policy);
    expect(third?.toISOString()).toBe('2025-11-20T12:00:45.000Z');
  });
});
