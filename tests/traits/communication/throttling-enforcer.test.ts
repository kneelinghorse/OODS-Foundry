import { beforeEach, describe, expect, it } from 'vitest';

import { createDeliveryPolicy } from '@/traits/communication/policy-builder.js';
import { ThrottlingEnforcer } from '@/traits/communication/throttling-enforcer.js';
import { InMemoryThrottlingStore } from '@/traits/communication/throttling-store.js';

describe('ThrottlingEnforcer', () => {
  let now: Date;
  let clock: () => Date;

  beforeEach(() => {
    now = new Date('2025-11-20T10:00:00Z');
    clock = () => now;
  });

  it('allows sends within the sliding window limits', async () => {
    const store = new InMemoryThrottlingStore({ clock });
    const enforcer = new ThrottlingEnforcer({ store, clock });
    const policy = createDeliveryPolicy({ id: 'limits', name: 'Limits' }).setThrottling({ max_per_minute: 2 }).build();

    const first = await enforcer.checkThrottle('user-1', 'email', policy);
    const second = await enforcer.checkThrottle('user-1', 'email', policy);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.currentRate).toBeGreaterThanOrEqual(2);
  });

  it('blocks when the sliding window limit is exceeded and provides retryAfter', async () => {
    const store = new InMemoryThrottlingStore({ clock });
    const enforcer = new ThrottlingEnforcer({ store, clock });
    const policy = createDeliveryPolicy({ id: 'minute-cap', name: 'Minute Cap' })
      .setThrottling({ max_per_minute: 1 })
      .build();

    await enforcer.checkThrottle('user-2', 'sms', policy);
    const blocked = await enforcer.checkThrottle('user-2', 'sms', policy);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter?.toISOString()).toBe('2025-11-20T10:01:00.000Z');
  });

  it('bypasses throttling for urgent priority until burst limit is reached', async () => {
    const store = new InMemoryThrottlingStore({ clock });
    const enforcer = new ThrottlingEnforcer({ store, clock });
    const policy = createDeliveryPolicy({ id: 'urgent', name: 'Urgent', priority: 'urgent' })
      .setThrottling({ max_per_minute: 1 })
      .setMetadata({ burst_limit: 2 })
      .build();

    const first = await enforcer.checkThrottle('user-3', 'email', policy);
    const second = await enforcer.checkThrottle('user-3', 'email', policy);
    const third = await enforcer.checkThrottle('user-3', 'email', policy);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
