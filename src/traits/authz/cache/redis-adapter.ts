import { PermissionCacheError, type PermissionCacheLogger, type PermissionCacheTransport } from './permission-cache.js';

export interface RedisCommandClient {
  get(key: string): Promise<string | null>;
  setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  set?(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  unlink?(...keys: string[]): Promise<number>;
  scan?(cursor: number | string, ...args: (string | number)[]): Promise<[string, string[]]>;
}

export interface RedisPermissionCacheAdapterOptions {
  readonly ttlArgument?: 'EX' | 'PX';
  readonly scanCount?: number;
  readonly logger?: PermissionCacheLogger;
  readonly fallback?: PermissionCacheTransport;
}

const MIN_SCAN_COUNT = 25;

export class RedisPermissionCacheAdapter implements PermissionCacheTransport {
  private readonly ttlArgument: 'EX' | 'PX';
  private readonly scanCount: number;
  private readonly logger?: PermissionCacheLogger;
  private readonly fallback?: PermissionCacheTransport;

  constructor(private readonly client: RedisCommandClient, options: RedisPermissionCacheAdapterOptions = {}) {
    this.ttlArgument = options.ttlArgument ?? 'EX';
    this.scanCount = Math.max(MIN_SCAN_COUNT, Math.trunc(options.scanCount ?? 250));
    this.logger = options.logger;
    this.fallback = options.fallback;
  }

  async read(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger?.warn?.('permission_cache_redis_read_failed', { key, error });
      return this.fallback ? this.fallback.read(key) : null;
    }
  }

  async write(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      if (typeof this.client.setEx === 'function') {
        await this.client.setEx(key, Math.max(1, Math.trunc(ttlSeconds)), value);
        return;
      }

      if (typeof this.client.set === 'function') {
        const ttl = Math.max(1, Math.trunc(ttlSeconds));
        try {
          await this.client.set(key, value, { [this.ttlArgument]: ttl });
        } catch {
          await this.client.set(key, value, this.ttlArgument, ttl);
        }
        return;
      }

      throw new PermissionCacheError('Redis client must expose setEx or set with TTL support.');
    } catch (error) {
      this.logger?.warn?.('permission_cache_redis_write_failed', { key, error });
      if (this.fallback) {
        await this.fallback.write(key, value, ttlSeconds);
      }
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (typeof this.client.unlink === 'function') {
        await this.client.unlink(key);
        return;
      }
      await this.client.del(key);
    } catch (error) {
      this.logger?.warn?.('permission_cache_redis_delete_failed', { key, error });
      if (this.fallback) {
        await this.fallback.delete(key);
      }
    }
  }

  async deleteMatching(pattern: string): Promise<number> {
    if (typeof this.client.scan !== 'function') {
      return this.fallback?.deleteMatching ? this.fallback.deleteMatching(pattern) : 0;
    }
    let cursor = '0';
    let removed = 0;
    try {
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', this.scanCount);
        cursor = nextCursor;
        if (keys.length === 0) {
          continue;
        }
        removed += await this.deleteKeys(keys);
      } while (cursor !== '0');
      return removed;
    } catch (error) {
      this.logger?.warn?.('permission_cache_redis_scan_failed', { pattern, error });
      if (this.fallback?.deleteMatching) {
        return this.fallback.deleteMatching(pattern);
      }
      return 0;
    }
  }

  private async deleteKeys(keys: readonly string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    try {
      if (typeof this.client.unlink === 'function') {
        const count = await this.client.unlink(...keys);
        return count;
      }
      const count = await this.client.del(...keys);
      return count;
    } catch (error) {
      this.logger?.warn?.('permission_cache_redis_bulk_delete_failed', { count: keys.length, error });
      if (this.fallback) {
        await Promise.all(keys.map((key) => this.fallback!.delete(key)));
      }
      return 0;
    }
  }
}
