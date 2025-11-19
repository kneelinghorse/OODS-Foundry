import { PreferenceCacheError, type PreferenceCacheTransport } from './preference-cache.js';

export interface RedisCommandClient {
  get(key: string): Promise<string | null>;
  setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  set?(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

export interface RedisCacheAdapterOptions {
  readonly ttlArgument?: 'EX' | 'PX';
}

export class RedisCacheAdapter implements PreferenceCacheTransport {
  private readonly ttlArgument: 'EX' | 'PX';

  constructor(private readonly client: RedisCommandClient, options: RedisCacheAdapterOptions = {}) {
    this.ttlArgument = options.ttlArgument ?? 'EX';
  }

  async read(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async write(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (typeof this.client.setEx === 'function') {
      await this.client.setEx(key, Math.max(1, Math.trunc(ttlSeconds)), value);
      return;
    }

    if (typeof this.client.set === 'function') {
      const ttl = Math.max(1, Math.trunc(ttlSeconds));
      try {
        await this.client.set(key, value, { [this.ttlArgument]: ttl });
        return;
      } catch {
        // Fall back to argument list (ioredis style)
        await this.client.set(key, value, this.ttlArgument, ttl);
        return;
      }
    }

    throw new PreferenceCacheError('Redis client must provide setEx or set command');
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
