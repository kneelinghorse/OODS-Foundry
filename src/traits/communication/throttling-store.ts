import type { ChannelType } from '@/schemas/communication/common.js';
import type { RuntimeLogger } from '@/traits/authz/runtime-types.js';

export interface RedisSortedSetClient {
  zAdd(key: string, entries: readonly { score: number; value: string }[]): Promise<number>;
  zCount(key: string, min: number | string, max: number | string): Promise<number>;
  zRemRangeByScore(key: string, min: number | string, max: number | string): Promise<number>;
  zRangeByScore?(
    key: string,
    min: number | string,
    max: number | string,
    options?: { LIMIT?: { offset: number; count: number } }
  ): Promise<string[]>;
}

export interface ThrottlingStore {
  recordSend(userId: string, channelType: ChannelType, timestamp?: Date): Promise<void>;
  getSendCount(userId: string, channelType: ChannelType, windowSeconds: number, now?: Date): Promise<number>;
  getOldestTimestamp(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now?: Date
  ): Promise<Date | null>;
  cleanupOldEntries(windowSeconds: number, now?: Date): Promise<void>;
}

export interface ThrottlingStoreOptions {
  readonly prefix?: string;
  readonly logger?: RuntimeLogger;
  readonly clock?: () => Date;
}

export class RedisThrottlingStore implements ThrottlingStore {
  private readonly prefix: string;
  private readonly logger?: RuntimeLogger;
  private readonly clock: () => Date;
  private readonly knownKeys = new Set<string>();
  private uniqueCounter = 0;

  constructor(private readonly client: RedisSortedSetClient, options: ThrottlingStoreOptions = {}) {
    this.prefix = options.prefix ?? 'throttle';
    this.logger = options.logger;
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  async recordSend(userId: string, channelType: ChannelType, timestamp: Date = this.clock()): Promise<void> {
    const key = this.buildKey(userId, channelType);
    const score = this.toScore(timestamp);
    this.knownKeys.add(key);
    try {
      await this.client.zAdd(key, [{ score, value: `${score}-${this.nextId()}` }]);
    } catch (error) {
      this.logger?.warn?.('throttling_store_record_failed', { key, error });
    }
  }

  async getSendCount(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now: Date = this.clock()
  ): Promise<number> {
    const key = this.buildKey(userId, channelType);
    const cutoff = this.toScore(now) - windowSeconds * 1000;
    try {
      return await this.client.zCount(key, cutoff, this.toScore(now));
    } catch (error) {
      this.logger?.warn?.('throttling_store_get_count_failed', { key, windowSeconds, error });
      return 0;
    }
  }

  async getOldestTimestamp(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now: Date = this.clock()
  ): Promise<Date | null> {
    const key = this.buildKey(userId, channelType);
    const cutoff = this.toScore(now) - windowSeconds * 1000;
    if (typeof this.client.zRangeByScore !== 'function') {
      return null;
    }
    try {
      const entries = await this.client.zRangeByScore(key, cutoff, this.toScore(now), { LIMIT: { offset: 0, count: 1 } });
      if (!entries || entries.length === 0) {
        return null;
      }
      const [entry] = entries;
      const timestamp = Number.parseInt(entry.split('-')[0] ?? '', 10);
      return Number.isFinite(timestamp) ? DateTime.fromMillis(timestamp, { zone: 'utc' }).toJSDate() : null;
    } catch (error) {
      this.logger?.warn?.('throttling_store_get_oldest_failed', { key, windowSeconds, error });
      return null;
    }
  }

  async cleanupOldEntries(windowSeconds: number, now: Date = this.clock()): Promise<void> {
    const cutoff = this.toScore(now) - windowSeconds * 1000;
    const tasks: Promise<number>[] = [];
    for (const key of this.knownKeys) {
      tasks.push(
        this.client
          .zRemRangeByScore(key, '-inf', cutoff)
          .catch((error) => {
            this.logger?.warn?.('throttling_store_cleanup_failed', { key, error });
            return 0;
          })
      );
    }
    await Promise.all(tasks);
  }

  private buildKey(userId: string, channelType: ChannelType): string {
    return `${this.prefix}:${channelType}:${userId}`;
  }

  private toScore(timestamp: Date): number {
    return timestamp.getTime();
  }

  private nextId(): number {
    this.uniqueCounter = (this.uniqueCounter + 1) % Number.MAX_SAFE_INTEGER;
    return this.uniqueCounter;
  }
}

export class InMemoryThrottlingStore implements ThrottlingStore {
  private readonly clock: () => Date;
  private readonly entries = new Map<string, number[]>();

  constructor(options: ThrottlingStoreOptions = {}) {
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  async recordSend(userId: string, channelType: ChannelType, timestamp: Date = this.clock()): Promise<void> {
    const key = this.buildKey(userId, channelType);
    const list = this.entries.get(key) ?? [];
    list.push(timestamp.getTime());
    list.sort((a, b) => a - b);
    this.entries.set(key, list);
  }

  async getSendCount(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now: Date = this.clock()
  ): Promise<number> {
    const key = this.buildKey(userId, channelType);
    const list = this.entries.get(key) ?? [];
    if (list.length === 0) {
      return 0;
    }
    const cutoff = now.getTime() - windowSeconds * 1000;
    return list.filter((value) => value >= cutoff && value <= now.getTime()).length;
  }

  async getOldestTimestamp(
    userId: string,
    channelType: ChannelType,
    windowSeconds: number,
    now: Date = this.clock()
  ): Promise<Date | null> {
    const key = this.buildKey(userId, channelType);
    const list = this.entries.get(key) ?? [];
    if (list.length === 0) {
      return null;
    }
    const cutoff = now.getTime() - windowSeconds * 1000;
    const oldest = list.find((value) => value >= cutoff);
    return typeof oldest === 'number' ? DateTime.fromMillis(oldest, { zone: 'utc' }).toJSDate() : null;
  }

  async cleanupOldEntries(windowSeconds: number, now: Date = this.clock()): Promise<void> {
    const cutoff = now.getTime() - windowSeconds * 1000;
    for (const [key, list] of this.entries.entries()) {
      const filtered = list.filter((value) => value >= cutoff);
      if (filtered.length === 0) {
        this.entries.delete(key);
      } else {
        this.entries.set(key, filtered);
      }
    }
  }

  private buildKey(userId: string, channelType: ChannelType): string {
    return `${channelType}:${userId}`;
  }
}
import { DateTime } from 'luxon';

import TimeService from '@/services/time/index.js';
