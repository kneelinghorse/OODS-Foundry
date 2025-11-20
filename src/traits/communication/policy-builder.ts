import { randomUUID } from 'node:crypto';

import type { JsonValue, PriorityLevel } from '@/schemas/communication/common.js';
import {
  deliveryPolicySchema,
  ensurePriority,
  type DeliveryPolicy,
  type QuietHours,
  type RetryPolicy,
  type ThrottlingPolicy,
} from '@/schemas/communication/delivery-policy.js';

export interface DeliveryPolicyBuilderOptions {
  readonly id?: string;
  readonly name?: string;
  readonly priority?: PriorityLevel;
  readonly metadata?: Record<string, JsonValue>;
}

export interface DeliveryPolicyBuilder {
  setId(id: string): DeliveryPolicyBuilder;
  setName(name: string): DeliveryPolicyBuilder;
  setPriority(priority: PriorityLevel): DeliveryPolicyBuilder;
  setRetry(policy: Partial<RetryPolicy>): DeliveryPolicyBuilder;
  setThrottling(policy: Partial<ThrottlingPolicy>): DeliveryPolicyBuilder;
  setQuietHours(quietHours: QuietHours | null): DeliveryPolicyBuilder;
  setMetadata(metadata: Record<string, JsonValue>): DeliveryPolicyBuilder;
  build(): DeliveryPolicy;
}

export class DeliveryPolicyValidationError extends Error {}

const DEFAULT_RETRY: RetryPolicy = {
  max_attempts: 3,
  backoff_strategy: 'exponential',
  initial_delay_seconds: 0,
};

const DEFAULT_THROTTLING: ThrottlingPolicy = {
  max_per_minute: 60,
  max_per_hour: 500,
  max_per_day: 1000,
};

class DefaultDeliveryPolicyBuilder implements DeliveryPolicyBuilder {
  private state: Partial<DeliveryPolicy>;

  constructor(options: DeliveryPolicyBuilderOptions = {}) {
    this.state = {
      id: options.id,
      name: options.name,
      priority: options.priority,
      metadata: options.metadata,
    } satisfies Partial<DeliveryPolicy>;
  }

  setId(id: string): DeliveryPolicyBuilder {
    this.state.id = id.trim();
    return this;
  }

  setName(name: string): DeliveryPolicyBuilder {
    this.state.name = name.trim();
    return this;
  }

  setPriority(priority: PriorityLevel): DeliveryPolicyBuilder {
    this.state.priority = ensurePriority(priority);
    return this;
  }

  setRetry(policy: Partial<RetryPolicy>): DeliveryPolicyBuilder {
    this.state.retry = { ...this.state.retry, ...sanitizeRetry(policy) } as RetryPolicy;
    return this;
  }

  setThrottling(policy: Partial<ThrottlingPolicy>): DeliveryPolicyBuilder {
    this.state.throttling = { ...this.state.throttling, ...sanitizeThrottling(policy) } as ThrottlingPolicy;
    return this;
  }

  setQuietHours(quietHours: QuietHours | null): DeliveryPolicyBuilder {
    this.state.quiet_hours = quietHours ?? undefined;
    return this;
  }

  setMetadata(metadata: Record<string, JsonValue>): DeliveryPolicyBuilder {
    this.state.metadata = { ...(this.state.metadata ?? {}), ...metadata };
    return this;
  }

  build(): DeliveryPolicy {
    const policy: DeliveryPolicy = deliveryPolicySchema.parse({
      id: this.state.id ?? defaultId(),
      name: this.state.name ?? 'Delivery Policy',
      retry: { ...DEFAULT_RETRY, ...(this.state.retry ?? {}) },
      throttling: { ...DEFAULT_THROTTLING, ...(this.state.throttling ?? {}) },
      quiet_hours: this.state.quiet_hours,
      priority: ensurePriority(this.state.priority ?? 'normal'),
      metadata: this.state.metadata ?? {},
    });

    validateRetry(policy.retry);
    validateThrottling(policy.throttling);

    return policy;
  }
}

export function createDeliveryPolicy(options: DeliveryPolicyBuilderOptions = {}): DeliveryPolicyBuilder {
  return new DefaultDeliveryPolicyBuilder(options);
}

export function standardPolicy(): DeliveryPolicy {
  return createDeliveryPolicy({ id: 'standard', name: 'Standard Delivery Policy', priority: 'normal' })
    .setRetry({ max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 })
    .setThrottling({ max_per_minute: 10, max_per_hour: 120, max_per_day: 1000 })
    .build();
}

export function urgentPolicy(): DeliveryPolicy {
  return createDeliveryPolicy({ id: 'urgent', name: 'Urgent Bypass Policy', priority: 'urgent' })
    .setRetry({ max_attempts: 5, backoff_strategy: 'linear', initial_delay_seconds: 10 })
    .setThrottling({ max_per_minute: 100, max_per_hour: 500, max_per_day: 2000 })
    .setMetadata({ burst_limit: 50 })
    .build();
}

export function lowPriorityPolicy(): DeliveryPolicy {
  return createDeliveryPolicy({ id: 'low-priority', name: 'Low Priority Delivery Policy', priority: 'low' })
    .setRetry({ max_attempts: 2, backoff_strategy: 'linear', initial_delay_seconds: 120 })
    .setThrottling({ max_per_minute: 3, max_per_hour: 30, max_per_day: 300 })
    .build();
}

function validateRetry(retry: RetryPolicy): void {
  if (retry.max_attempts <= 0) {
    throw new DeliveryPolicyValidationError('retry.max_attempts must be at least 1.');
  }
}

function sanitizeRetry(policy: Partial<RetryPolicy>): Partial<RetryPolicy> {
  const sanitized: Partial<RetryPolicy> = {};
  if (policy.max_attempts !== undefined) {
    sanitized.max_attempts = Math.max(0, Math.trunc(policy.max_attempts));
  }
  if (policy.backoff_strategy) {
    sanitized.backoff_strategy = policy.backoff_strategy;
  }
  if (policy.initial_delay_seconds !== undefined) {
    sanitized.initial_delay_seconds = Math.max(0, Math.trunc(policy.initial_delay_seconds));
  }
  return sanitized;
}

function validateThrottling(throttling: ThrottlingPolicy): void {
  const { max_per_minute: perMinute, max_per_hour: perHour, max_per_day: perDay } = throttling;
  if (perMinute < 0 || perHour < 0 || perDay < 0) {
    throw new DeliveryPolicyValidationError('Throttling limits cannot be negative.');
  }
  if (perMinute === 0 && perHour === 0 && perDay === 0) {
    throw new DeliveryPolicyValidationError('At least one throttling limit must be greater than zero.');
  }
  if (perMinute > perHour || perHour > perDay) {
    throw new DeliveryPolicyValidationError('Throttling limits must be non-decreasing (minute <= hour <= day).');
  }
}

function sanitizeThrottling(policy: Partial<ThrottlingPolicy>): Partial<ThrottlingPolicy> {
  const sanitized: Partial<ThrottlingPolicy> = {};
  if (policy.max_per_minute !== undefined) {
    sanitized.max_per_minute = Math.max(0, Math.trunc(policy.max_per_minute));
  }
  if (policy.max_per_hour !== undefined) {
    sanitized.max_per_hour = Math.max(0, Math.trunc(policy.max_per_hour));
  }
  if (policy.max_per_day !== undefined) {
    sanitized.max_per_day = Math.max(0, Math.trunc(policy.max_per_day));
  }
  return sanitized;
}

function defaultId(): string {
  return `policy-${randomUUID()}`;
}
