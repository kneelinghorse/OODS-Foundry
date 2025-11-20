import type { Channel } from '@/schemas/communication/channel.js';
import type { ChannelType, JsonValue } from '@/schemas/communication/common.js';
import type { DeliveryPolicy, QuietHours as PolicyQuietHours } from '@/schemas/communication/delivery-policy.js';
import type { Message } from '@/schemas/communication/message.js';

export type QuietHours = PolicyQuietHours;

export type ChannelPreferenceMatrix = Record<string, Partial<Record<ChannelType, boolean>>>;

export interface ChannelPreferences {
  readonly userId: string;
  readonly eventType: string;
  readonly matrix: ChannelPreferenceMatrix;
  readonly optedInChannels: readonly ChannelType[];
  readonly explicitlyBlockedChannels: readonly ChannelType[];
  readonly organizationDefaults: readonly ChannelType[];
  readonly systemDefaults: readonly ChannelType[];
  readonly quietHours?: QuietHours | null;
}

export interface DeliveryRecipientResult {
  readonly recipientId: string;
  readonly channelType: ChannelType;
  readonly channelId?: string;
  readonly scheduledAt: string;
}

export interface BlockedRecipient {
  readonly recipientId: string;
  readonly reason: string;
}

export interface MessageDeliveryResult {
  readonly messageId: string;
  readonly queuedRecipients: readonly DeliveryRecipientResult[];
  readonly blockedRecipients: readonly BlockedRecipient[];
  readonly metadata?: Record<string, JsonValue>;
}

export interface DeliveryStats {
  readonly messageId: string;
  readonly queued: number;
  readonly blocked: number;
  readonly blockedReasons: Readonly<Record<string, number>>;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface DeliveryQueuePayload {
  readonly message: Message;
  readonly recipientId: string;
  readonly channel: Channel;
  readonly organizationId?: string;
  readonly attempt: number;
  readonly policy?: DeliveryPolicy;
  readonly retryPolicy: RetryPolicy;
  readonly scheduledAt: string;
  readonly metadata?: Record<string, JsonValue>;
  readonly eventType?: string;
}

export interface QueueMessage<TPayload> {
  readonly id: string;
  readonly payload: TPayload;
  readonly scheduledAt: Date;
  readonly availableAt?: Date;
  readonly attempt: number;
  readonly priority?: number;
  readonly dedupeKey?: string;
}

export interface QueueEntry<TPayload> {
  readonly message: QueueMessage<TPayload>;
  readonly ackToken: QueueAckToken;
}

export interface QueueAckToken {
  readonly id: string;
  readonly receipt: string;
  readonly issuedAt: Date;
  readonly attempt: number;
}

export interface QueueStats {
  readonly name: string;
  readonly queued: number;
  readonly inFlight: number;
  readonly acknowledged: number;
  readonly deadLettered: number;
  readonly oldestScheduledAt?: string;
  readonly nextAvailableAt?: string;
}

export interface QueueDequeueOptions {
  readonly now?: Date;
}

export interface QueuePeekOptions {
  readonly limit?: number;
}

export interface QueueNackOptions {
  readonly delayMs?: number;
  readonly scheduledAt?: Date;
  readonly incrementAttempt?: boolean;
}

export interface QueuePurgeOptions {
  readonly includeInFlight?: boolean;
}

export type RetryStrategy = 'linear' | 'exponential' | 'none' | 'custom';

export interface RetryPolicy {
  readonly strategy: RetryStrategy;
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly linearIncrementMs?: number;
  readonly maxBackoffMs?: number;
  readonly customSchedule?: (attemptNumber: number) => number;
}

export interface DeriveRetryPolicyOptions {
  readonly defaultStrategy?: RetryStrategy;
  readonly defaultInitialDelayMs?: number;
  readonly defaultMaxAttempts?: number;
  readonly defaultLinearIncrementMs?: number;
  readonly defaultMaxBackoffMs?: number;
}

const MINUTE_IN_MS = 60_000;

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  strategy: 'exponential',
  maxAttempts: 3,
  initialDelayMs: MINUTE_IN_MS,
  linearIncrementMs: MINUTE_IN_MS,
  maxBackoffMs: 30 * MINUTE_IN_MS,
});

export function deriveRetryPolicyFromDeliveryPolicy(
  policy: DeliveryPolicy | null | undefined,
  options: DeriveRetryPolicyOptions = {}
): RetryPolicy {
  const retry = policy?.retry;
  const strategy = retry?.backoff_strategy ?? options.defaultStrategy ?? DEFAULT_RETRY_POLICY.strategy;
  const maxAttempts = Math.max(0, retry?.max_attempts ?? options.defaultMaxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts);
  const initialDelayMs = Math.max(0, (retry?.initial_delay_seconds ?? 0) * 1000);
  const effectiveInitialDelay = initialDelayMs || options.defaultInitialDelayMs || DEFAULT_RETRY_POLICY.initialDelayMs;
  const metadata = policy?.metadata ?? {};
  const linearIncrementMs = coerceNumber(metadata.linear_increment_seconds) * 1000
    || options.defaultLinearIncrementMs
    || DEFAULT_RETRY_POLICY.linearIncrementMs;
  const maxBackoffMs = coerceNumber(metadata.max_backoff_seconds) * 1000
    || options.defaultMaxBackoffMs
    || DEFAULT_RETRY_POLICY.maxBackoffMs;

  return {
    strategy,
    maxAttempts,
    initialDelayMs: effectiveInitialDelay,
    linearIncrementMs,
    maxBackoffMs,
  } satisfies RetryPolicy;
}

function coerceNumber(candidate: unknown): number {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const parsed = Number.parseFloat(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}
