import { randomUUID } from 'node:crypto';
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

interface InFlightRecord<TPayload> {
  readonly token: QueueAckToken;
  readonly message: QueueMessage<TPayload>;
}

const DEFAULT_NAME = 'delivery:in-memory';

export interface InMemoryQueueOptions extends QueueAdapterOptions {
  readonly clock?: () => Date;
}

export class InMemoryQueueAdapter<TPayload> implements QueueAdapter<TPayload> {
  private readonly name: string;
  private readonly clock: () => Date;
  private readonly queued: QueueMessage<TPayload>[] = [];
  private readonly inFlight = new Map<string, InFlightRecord<TPayload>>();
  private acknowledged = 0;
  private deadLettered = 0;

  constructor(options: InMemoryQueueOptions = {}) {
    this.name = options.name ?? DEFAULT_NAME;
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  async enqueue(message: QueueMessage<TPayload>): Promise<void> {
    const normalized = normalizeMessage(message);
    this.queued.push(normalized);
    this.sortQueue();
  }

  async dequeue(options?: QueueDequeueOptions): Promise<QueueEntry<TPayload> | null> {
    const now = (options?.now ?? this.clock()).getTime();
    const index = this.queued.findIndex((entry) => entry.scheduledAt.getTime() <= now);
    if (index === -1) {
      return null;
    }
    const [message] = this.queued.splice(index, 1);
    const token: QueueAckToken = {
      id: message.id,
      receipt: randomUUID(),
      issuedAt: DateTime.fromMillis(now).toJSDate(),
      attempt: message.attempt,
    };
    this.inFlight.set(token.receipt, { token, message: cloneMessage(message) });
    return {
      message: cloneMessage(message),
      ackToken: token,
    } satisfies QueueEntry<TPayload>;
  }

  async ack(token: QueueAckToken): Promise<void> {
    const entry = this.inFlight.get(token.receipt);
    if (!entry) {
      return;
    }
    this.inFlight.delete(token.receipt);
    this.acknowledged += 1;
  }

  async nack(token: QueueAckToken, options?: QueueNackOptions): Promise<void> {
    const entry = this.inFlight.get(token.receipt);
    if (!entry) {
      return;
    }
    this.inFlight.delete(token.receipt);
    const delayMs = Math.max(0, options?.delayMs ?? 0);
    const scheduledAt = options?.scheduledAt ?? DateTime.fromMillis(this.clock().getTime() + delayMs).toJSDate();
    const message: QueueMessage<TPayload> = {
      ...entry.message,
      scheduledAt,
      availableAt: cloneDate(scheduledAt),
      attempt: options?.incrementAttempt === false ? entry.message.attempt : entry.message.attempt + 1,
    };
    this.queued.push(message);
    this.sortQueue();
  }

  async peek(options?: QueuePeekOptions): Promise<readonly QueueMessage<TPayload>[]> {
    const limit = options?.limit ?? this.queued.length;
    return this.queued.slice(0, limit).map((entry) => cloneMessage(entry));
  }

  async stats(): Promise<QueueStats> {
    const oldest = this.queued[0];
    const nextAvailable = this.queued.reduce<Date | undefined>((candidate, message) => {
      const available = message.availableAt ?? message.scheduledAt;
      if (!candidate) {
        return cloneDate(available);
      }
      return available.getTime() < candidate.getTime() ? cloneDate(available) : candidate;
    }, undefined);
    return {
      name: this.name,
      queued: this.queued.length,
      inFlight: this.inFlight.size,
      acknowledged: this.acknowledged,
      deadLettered: this.deadLettered,
      oldestScheduledAt: oldest ? oldest.scheduledAt.toISOString() : undefined,
      nextAvailableAt: nextAvailable?.toISOString(),
    } satisfies QueueStats;
  }

  async purge(): Promise<void> {
    this.queued.splice(0, this.queued.length);
    this.inFlight.clear();
    this.deadLettered = 0;
    this.acknowledged = 0;
  }

  private sortQueue(): void {
    this.queued.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }
}

function normalizeMessage<TPayload>(message: QueueMessage<TPayload>): QueueMessage<TPayload> {
  const scheduledAt = cloneDate(message.scheduledAt);
  const availableAt = message.availableAt ? cloneDate(message.availableAt) : cloneDate(scheduledAt);
  return {
    ...message,
    scheduledAt,
    availableAt,
    attempt: Math.max(0, message.attempt),
  } satisfies QueueMessage<TPayload>;
}

function cloneMessage<TPayload>(message: QueueMessage<TPayload>): QueueMessage<TPayload> {
  return {
    ...message,
    scheduledAt: cloneDate(message.scheduledAt),
    availableAt: message.availableAt ? cloneDate(message.availableAt) : cloneDate(message.scheduledAt),
  } satisfies QueueMessage<TPayload>;
}

function cloneDate(source: Date): Date {
  return DateTime.fromMillis(source.getTime()).toJSDate();
}
