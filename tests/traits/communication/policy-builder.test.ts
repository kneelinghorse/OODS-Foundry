import { describe, expect, it } from 'vitest';

import {
  DeliveryPolicyValidationError,
  createDeliveryPolicy,
  lowPriorityPolicy,
  standardPolicy,
  urgentPolicy,
} from '@/traits/communication/policy-builder.js';

describe('DeliveryPolicyBuilder', () => {
  it('builds a valid delivery policy via chained builder steps', () => {
    const policy = createDeliveryPolicy({ id: 'policy-1', name: 'Chained Policy' })
      .setRetry({ max_attempts: 4, initial_delay_seconds: 45 })
      .setThrottling({ max_per_minute: 5, max_per_hour: 50, max_per_day: 500 })
      .setQuietHours({ start_time: '21:00', end_time: '07:00', timezone: 'America/New_York', days_of_week: ['monday'] })
      .setPriority('high')
      .setMetadata({ burst_limit: 10 })
      .build();

    expect(policy.id).toBe('policy-1');
    expect(policy.retry.max_attempts).toBe(4);
    expect(policy.throttling.max_per_minute).toBe(5);
    expect(policy.quiet_hours?.timezone).toBe('America/New_York');
    expect(policy.priority).toBe('high');
  });

  it('rejects invalid retry configuration', () => {
    expect(() =>
      createDeliveryPolicy({ id: 'invalid-retry' })
        .setRetry({ max_attempts: 0 })
        .build()
    ).toThrow(DeliveryPolicyValidationError);
  });

  it('provides presets for standard, urgent, and low priority policies', () => {
    const standard = standardPolicy();
    const urgent = urgentPolicy();
    const low = lowPriorityPolicy();

    expect(standard.priority).toBe('normal');
    expect(urgent.priority).toBe('urgent');
    expect(Number(urgent.metadata?.burst_limit)).toBeGreaterThan(0);
    expect(low.priority).toBe('low');
    expect(low.throttling.max_per_minute).toBeLessThan(standard.throttling.max_per_minute);
  });
});
