import { describe, expect, it } from 'vitest';

import { createDeliveryPolicy } from '@/traits/communication/policy-builder.js';
import { ThrottlingEnforcer } from '@/traits/communication/throttling-enforcer.js';
import { InMemoryThrottlingStore } from '@/traits/communication/throttling-store.js';

describe('communication throttling integration', () => {
  it('enforces limits across sends and cleans up old entries', async () => {
    let now = new Date('2025-11-20T10:00:00Z');
    const clock = () => now;
    const store = new InMemoryThrottlingStore({ clock });
    const enforcer = new ThrottlingEnforcer({ store, clock });
    const policy = createDeliveryPolicy({ id: 'integration', name: 'Integration Limits' })
      .setThrottling({ max_per_minute: 2 })
      .build();

    await enforcer.checkThrottle('user-5', 'email', policy);
    await enforcer.checkThrottle('user-5', 'email', policy);
    const blocked = await enforcer.checkThrottle('user-5', 'email', policy);
    expect(blocked.allowed).toBe(false);

    now = new Date(now.getTime() + 61_000);
    await store.cleanupOldEntries(3_600, clock());

    const allowedAfterWindow = await enforcer.checkThrottle('user-5', 'email', policy);
    expect(allowedAfterWindow.allowed).toBe(true);
  });
});
