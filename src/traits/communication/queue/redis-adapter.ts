import { DateTime } from 'luxon';

import TimeService from '@/services/time/index.js';
import type {
  QueueAckToken,
  QueueDequeueOptions,
  QueueEntry,
  QueueMessage,
  QueueNackOptions,
  QueuePeekOptions,
  QueueStats,
} from '@/traits/communication/runtime-types.js';

import type { QueueAdapter, QueueAdapterOptions } from './queue-adapter.js';

export interface RedisCommandClient {
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string, ...args: unknown[]): Promise<string[]>;
  zpopmin(key: string, count?: number): Promise<string[]>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hlen?(key: string): Promise<number>;
  zcard?(key: string): Promise<number>;
  del?(...keys: string[]): Promise<number>;
}

export interface RedisQueueAdapterOptions extends QueueAdapterOptions {
  readonly client: RedisCommandClient;
  readonly keyPrefix?: string;
  readonly clock?: () => Date;
}

const DEFAULT_PREFIX = 'delivery:queue';

export class RedisQueueAdapter<TPayload> implements QueueAdapter<TPayload> {
  private readonly client: RedisCommandClient;
  private readonly name: string;
  private readonly scheduledKey: string;
  private readonly payloadKey: string;
  private readonly inflightKey: string;
  private readonly clock: () => Date;
  private acknowledged = 0;
  private deadLettered = 0;

  constructor(options: RedisQueueAdapterOptions) {
    this.client = options.client;
    this.name = options.name ?? 'delivery:redis';
    const prefix = options.keyPrefix ?? DEFAULT_PREFIX;
    this.scheduledKey = `${prefix}:scheduled`;
    this.payloadKey = `${prefix}:payload`;
    this.inflightKey = `${prefix}:inflight`;
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  async enqueue(message: QueueMessage<TPayload>): Promise<void> {
    const normalized = serializeMessage(message);
    await this.client.hset(this.payloadKey, normalized.id, JSON.stringify(normalized));
    await this.client.zadd(this.scheduledKey, normalized.scheduledAtMs, normalized.id);
  }

  async dequeue(options?: QueueDequeueOptions): Promise<QueueEntry<TPayload> | null> {
    const nowMs = (options?.now ?? this.clock()).getTime();
    const candidates = await this.client.zrangebyscore(this.scheduledKey, '-inf', nowMs, 'LIMIT', 0, 1);
    if (candidates.length === 0) {
      return null;
    }
    const candidateId = candidates[0]!;
    const popped = await this.client.zpopmin(this.scheduledKey, 1);
    if (popped.length === 0) {
      return null;
    }
    const [member, score] = popped;
    if (member !== candidateId) {
      // Another worker consumed the due message; return entry to the queue.
      await this.client.zadd(this.scheduledKey, Number(score), member);
      return null;
    }
    const serialized = await this.client.hget(this.payloadKey, member);
    if (!serialized) {
      return null;
    }
    const message = deserializeMessage<TPayload>(serialized);
    const token: QueueAckToken = {
      id: message.id,
      receipt: `${member}:${nowMs}`,
      issuedAt: DateTime.fromMillis(nowMs).toJSDate(),
      attempt: message.attempt,
    };
    await this.client.hset(this.inflightKey, token.receipt, serialized);
    return {
      message,
      ackToken: token,
    } satisfies QueueEntry<TPayload>;
  }

  async ack(token: QueueAckToken): Promise<void> {
    const serialized = await this.client.hget(this.inflightKey, token.receipt);
    if (!serialized) {
      return;
    }
    await this.client.hdel(this.inflightKey, token.receipt);
    await this.client.hdel(this.payloadKey, token.id);
    this.acknowledged += 1;
  }

  async nack(token: QueueAckToken, options?: QueueNackOptions): Promise<void> {
    const serialized = await this.client.hget(this.inflightKey, token.receipt);
    if (!serialized) {
      return;
    }
    const message = deserializeMessage<TPayload>(serialized);
    await this.client.hdel(this.inflightKey, token.receipt);
    const delayMs = Math.max(0, options?.delayMs ?? 0);
    const scheduledAt = options?.scheduledAt ?? DateTime.fromMillis(this.clock().getTime() + delayMs).toJSDate();
    const nextMessage: QueueMessage<TPayload> = {
      ...message,
      attempt: options?.incrementAttempt === false ? message.attempt : message.attempt + 1,
      scheduledAt,
      availableAt: cloneDate(scheduledAt),
    };
    const payload = serializeMessage(nextMessage);
    await this.client.hset(this.payloadKey, payload.id, JSON.stringify(payload));
    await this.client.zadd(this.scheduledKey, payload.scheduledAtMs, payload.id);
  }

  async peek(options?: QueuePeekOptions): Promise<readonly QueueMessage<TPayload>[]> {
    const limit = options?.limit ?? 10;
    const ids = await this.client.zrangebyscore(this.scheduledKey, '-inf', '+inf', 'LIMIT', 0, limit);
    if (ids.length === 0) {
      return [];
    }
    const messages: QueueMessage<TPayload>[] = [];
    for (const id of ids) {
      const serialized = await this.client.hget(this.payloadKey, id);
      if (!serialized) {
        continue;
      }
      messages.push(deserializeMessage<TPayload>(serialized));
    }
    return messages;
  }

  async stats(): Promise<QueueStats> {
    const queued = await this.countQueued();
    const inFlight = await this.countInFlight();
    const oldestIds = await this.client.zrangebyscore(this.scheduledKey, '-inf', '+inf', 'LIMIT', 0, 1);
    let oldestScheduledAt: string | undefined;
    if (oldestIds.length > 0) {
      const serialized = await this.client.hget(this.payloadKey, oldestIds[0]!);
      if (serialized) {
        const parsed = JSON.parse(serialized) as SerializedQueueMessage;
        oldestScheduledAt = parsed.scheduledAt;
      }
    }
    return {
      name: this.name,
      queued,
      inFlight,
      acknowledged: this.acknowledged,
      deadLettered: this.deadLettered,
      oldestScheduledAt,
      nextAvailableAt: undefined,
    } satisfies QueueStats;
  }

  async purge(): Promise<void> {
    await this.client.del?.(this.scheduledKey, this.payloadKey, this.inflightKey);
    this.acknowledged = 0;
    this.deadLettered = 0;
  }

  private async countQueued(): Promise<number> {
    if (typeof this.client.zcard === 'function') {
      return this.client.zcard(this.scheduledKey);
    }
    return fallbackCount(this.client, this.scheduledKey);
  }

  private async countInFlight(): Promise<number> {
    if (typeof this.client.hlen === 'function') {
      return this.client.hlen(this.inflightKey);
    }
    return 0;
  }
}

interface SerializedQueueMessage {
  readonly id: string;
  readonly payload: unknown;
  readonly attempt: number;
  readonly scheduledAt: string;
  readonly availableAt: string;
  readonly priority?: number;
  readonly dedupeKey?: string;
}

interface PersistedMessage extends SerializedQueueMessage {
  readonly scheduledAtMs: number;
}

function serializeMessage<TPayload>(message: QueueMessage<TPayload>): PersistedMessage {
  const scheduledAtMs = message.scheduledAt.getTime();
  const availableAt = message.availableAt ?? message.scheduledAt;
  return {
    id: message.id,
    payload: message.payload,
    attempt: message.attempt,
    scheduledAt: message.scheduledAt.toISOString(),
    availableAt: availableAt.toISOString(),
    scheduledAtMs,
    priority: message.priority,
    dedupeKey: message.dedupeKey,
  } satisfies PersistedMessage;
}

function deserializeMessage<TPayload>(raw: string): QueueMessage<TPayload> {
  const data = JSON.parse(raw) as SerializedQueueMessage;
  return {
    id: data.id,
    payload: data.payload as TPayload,
    attempt: data.attempt,
    scheduledAt: TimeService.fromDatabase(data.scheduledAt).toJSDate(),
    availableAt: TimeService.fromDatabase(data.availableAt).toJSDate(),
    priority: data.priority,
    dedupeKey: data.dedupeKey,
  } satisfies QueueMessage<TPayload>;
}

async function fallbackCount(client: RedisCommandClient, key: string): Promise<number> {
  const entries = await client.zrangebyscore(key, '-inf', '+inf');
  return entries.length;
}

function cloneDate(source: Date): Date {
  return DateTime.fromMillis(source.getTime()).toJSDate();
}
