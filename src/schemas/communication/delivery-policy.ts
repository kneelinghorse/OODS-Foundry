import { z } from 'zod';

import { metadataSchema, prioritySchema, timeOfDaySchema, type PriorityLevel } from './common.js';

const BACKOFF_STRATEGIES = ['linear', 'exponential', 'none'] as const;
export type BackoffStrategy = (typeof BACKOFF_STRATEGIES)[number];
const backoffStrategySchema = z.enum(BACKOFF_STRATEGIES);

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type QuietHourDay = (typeof DAYS_OF_WEEK)[number];
const daysSchema = z.array(z.enum(DAYS_OF_WEEK)).default([]);

const retryPolicySchema = z.object({
  max_attempts: z.number().int().min(0).max(10).default(3),
  backoff_strategy: backoffStrategySchema.default('exponential'),
  initial_delay_seconds: z.number().int().min(0).max(3600).default(0),
});

const throttlingSchema = z.object({
  max_per_minute: z.number().int().min(0).max(1000).default(60),
  max_per_hour: z.number().int().min(0).max(10000).default(500),
  max_per_day: z.number().int().min(0).max(100000).default(1000),
});

const quietHoursSchema = z.object({
  start_time: timeOfDaySchema,
  end_time: timeOfDaySchema,
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/u, 'Expected IANA timezone id.'),
  days_of_week: daysSchema,
});

export const deliveryPolicySchema = z.object({
  id: z.string().min(2).max(64).regex(/^[a-z0-9._-]+$/u),
  name: z.string().min(2).max(120),
  retry: retryPolicySchema,
  throttling: throttlingSchema,
  quiet_hours: quietHoursSchema.optional(),
  priority: prioritySchema.default('normal'),
  metadata: metadataSchema,
});

export type DeliveryPolicy = z.infer<typeof deliveryPolicySchema>;
export type RetryPolicy = z.infer<typeof retryPolicySchema>;
export type ThrottlingPolicy = z.infer<typeof throttlingSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;

export function parseDeliveryPolicy(data: unknown): DeliveryPolicy {
  return deliveryPolicySchema.parse(data);
}

export function ensurePriority(value: PriorityLevel): PriorityLevel {
  return prioritySchema.parse(value);
}
