import { performance } from 'node:perf_hooks';

import type { PermissionDocument } from '@/schemas/authz/permission.schema.js';
import TimeService from '@/services/time/index.js';

export interface PermissionCacheLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface PermissionCacheTransport {
  read(key: string): Promise<string | null>;
  write(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteMatching?(pattern: string): Promise<number>;
}

export interface PermissionCacheOptions {
  readonly ttlSeconds?: number;
  readonly prefix?: string;
  readonly metrics?: PermissionCacheMetrics;
  readonly logger?: PermissionCacheLogger;
}

export interface PermissionCacheGetOptions {
  readonly loader?: () => Promise<readonly PermissionDocument[] | null>;
  readonly ttlSeconds?: number;
  readonly forceRefresh?: boolean;
  readonly skipCache?: boolean;
  readonly context?: 'query' | 'warm';
}

export interface PermissionCacheWriteOptions {
  readonly ttlSeconds?: number;
}

export interface PermissionCacheResult {
  readonly permissions: readonly PermissionDocument[] | null;
  readonly cacheKey: string;
  readonly source: 'cache' | 'loader' | 'miss';
  readonly latencyMs: number;
  readonly cachedAt?: string;
}

interface PermissionCacheEntry {
  readonly permissions: readonly PermissionDocument[];
  readonly cachedAt: string;
}

interface PermissionCacheKeyRecord {
  readonly userId: string;
  readonly organizationId: string;
}

const DEFAULT_TTL_SECONDS = 300; // 5 minutes as mandated in B28.5
const KEY_TRACKER_LIMIT = 5000;
const MAX_LATENCY_OBSERVATIONS = 512;

export class PermissionCacheError extends Error {}

export interface PermissionCacheMetricsSnapshot {
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
  readonly writes: number;
  readonly invalidations: number;
  readonly warmOperations: number;
  readonly p95: number;
  readonly p99: number;
}

export class PermissionCacheMetrics {
  private readonly durations: number[] = [];
  private hits = 0;
  private misses = 0;
  private writes = 0;
  private invalidations = 0;
  private warms = 0;

  recordHit(durationMs: number): void {
    this.hits += 1;
    this.trackDuration(durationMs);
  }

  recordMiss(durationMs: number): void {
    this.misses += 1;
    this.trackDuration(durationMs);
  }

  recordWrite(): void {
    this.writes += 1;
  }

  recordInvalidation(): void {
    this.invalidations += 1;
  }

  recordWarmOperation(): void {
    this.warms += 1;
  }

  snapshot(): PermissionCacheMetricsSnapshot {
    const attempts = this.hits + this.misses;
    const hitRate = attempts === 0 ? 0 : this.hits / attempts;
    const sorted = [...this.durations].sort((a, b) => a - b);
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      writes: this.writes,
      invalidations: this.invalidations,
      warmOperations: this.warms,
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    } satisfies PermissionCacheMetricsSnapshot;
  }

  private trackDuration(durationMs: number): void {
    if (!Number.isFinite(durationMs)) {
      return;
    }
    this.durations.push(Number(durationMs.toFixed(3)));
    if (this.durations.length > MAX_LATENCY_OBSERVATIONS) {
      this.durations.splice(0, this.durations.length - MAX_LATENCY_OBSERVATIONS);
    }
  }

  private percentile(sortedDurations: readonly number[], percentile: number): number {
    if (sortedDurations.length === 0) {
      return 0;
    }
    const index = Math.min(sortedDurations.length - 1, Math.floor(percentile * (sortedDurations.length - 1)));
    return Number(sortedDurations[index]!.toFixed(3));
  }
}

export class PermissionCache {
  private readonly ttlSeconds: number;
  private readonly prefix: string;
  private readonly metrics: PermissionCacheMetrics;
  private readonly logger?: PermissionCacheLogger;
  private readonly keyLookup = new Map<string, PermissionCacheKeyRecord>();
  private readonly keysByUser = new Map<string, Set<string>>();
  private readonly keysByOrg = new Map<string, Set<string>>();

  constructor(private readonly transport: PermissionCacheTransport, options: PermissionCacheOptions = {}) {
    this.ttlSeconds = Math.max(1, Math.trunc(options.ttlSeconds ?? DEFAULT_TTL_SECONDS));
    this.prefix = options.prefix ?? 'permissions';
    this.metrics = options.metrics ?? new PermissionCacheMetrics();
    this.logger = options.logger;
  }

  getMetrics(): PermissionCacheMetricsSnapshot {
    return this.metrics.snapshot();
  }

  async getPermissions(
    userId: string,
    organizationId: string,
    options: PermissionCacheGetOptions = {}
  ): Promise<PermissionCacheResult> {
    this.assertIdentifier('userId', userId);
    this.assertIdentifier('organizationId', organizationId);

    const cacheKey = this.buildCacheKey(userId, organizationId);
    const started = performance.now();
    const skipRead = options.skipCache === true;
    const forceRefresh = options.forceRefresh === true;
    const context = options.context ?? 'query';

    if (!skipRead && !forceRefresh) {
      const cached = await this.safeRead(cacheKey);
      if (cached) {
        const latency = performance.now() - started;
        this.metrics.recordHit(latency);
        return {
          permissions: cached.permissions,
          cacheKey,
          source: 'cache',
          latencyMs: latency,
          cachedAt: cached.cachedAt,
        } satisfies PermissionCacheResult;
      }
    }

    if (!options.loader) {
      const latency = performance.now() - started;
      this.metrics.recordMiss(latency);
      return {
        permissions: null,
        cacheKey,
        source: 'miss',
        latencyMs: latency,
      } satisfies PermissionCacheResult;
    }

    const permissions = await this.safeLoad(options.loader, userId, organizationId);
    const latency = performance.now() - started;

    if (!permissions) {
      this.metrics.recordMiss(latency);
      return {
        permissions: null,
        cacheKey,
        source: 'miss',
        latencyMs: latency,
      } satisfies PermissionCacheResult;
    }

    const ttlSeconds = Math.max(1, Math.trunc(options.ttlSeconds ?? this.ttlSeconds));
    await this.setPermissions(userId, organizationId, permissions, { ttlSeconds });
    this.metrics.recordMiss(latency);
    if (context === 'warm') {
      this.metrics.recordWarmOperation();
    }

    return {
      permissions,
      cacheKey,
      source: 'loader',
      latencyMs: latency,
      cachedAt: TimeService.toIsoString(TimeService.nowSystem()),
    } satisfies PermissionCacheResult;
  }

  async setPermissions(
    userId: string,
    organizationId: string,
    permissions: readonly PermissionDocument[],
    options: PermissionCacheWriteOptions = {}
  ): Promise<void> {
    this.assertIdentifier('userId', userId);
    this.assertIdentifier('organizationId', organizationId);
    const cacheKey = this.buildCacheKey(userId, organizationId);

    const entry: PermissionCacheEntry = {
      permissions: [...permissions],
      cachedAt: TimeService.toIsoString(TimeService.nowSystem()),
    };
    const ttlSeconds = Math.max(1, Math.trunc(options.ttlSeconds ?? this.ttlSeconds));
    await this.safeWrite(cacheKey, entry, ttlSeconds);
    this.metrics.recordWrite();
    this.trackKey(cacheKey, userId, organizationId);
  }

  async invalidateUser(userId: string): Promise<void> {
    this.assertIdentifier('userId', userId);
    const pattern = this.buildUserPattern(userId);
    const deletedViaPattern = await this.tryPatternEviction(pattern);
    if (deletedViaPattern !== null) {
      return;
    }
    const keys = this.keysByUser.get(userId);
    if (!keys || keys.size === 0) {
      return;
    }
    await Promise.all([...keys].map((key) => this.safeDelete(key)));
  }

  async invalidateOrg(organizationId: string): Promise<void> {
    this.assertIdentifier('organizationId', organizationId);
    const pattern = this.buildOrgPattern(organizationId);
    const deletedViaPattern = await this.tryPatternEviction(pattern);
    if (deletedViaPattern !== null) {
      return;
    }
    const keys = this.keysByOrg.get(organizationId);
    if (!keys || keys.size === 0) {
      return;
    }
    await Promise.all([...keys].map((key) => this.safeDelete(key)));
  }

  private buildCacheKey(userId: string, organizationId: string): string {
    return `${this.prefix}:user:${userId}:org:${organizationId}:permissions`;
  }

  private buildUserPattern(userId: string): string {
    return `${this.prefix}:user:${userId}:org:*:permissions`;
  }

  private buildOrgPattern(organizationId: string): string {
    return `${this.prefix}:user:*:org:${organizationId}:permissions`;
  }

  private async safeRead(key: string): Promise<PermissionCacheEntry | null> {
    try {
      const payload = await this.transport.read(key);
      if (!payload) {
        return null;
      }
      const parsed = JSON.parse(payload) as PermissionCacheEntry;
      if (!Array.isArray(parsed.permissions) || typeof parsed.cachedAt !== 'string') {
        throw new PermissionCacheError('Malformed payload');
      }
      return parsed;
    } catch (error) {
      this.logger?.warn?.('permission_cache_read_failed', { key, error });
      return null;
    }
  }

  private async safeWrite(key: string, entry: PermissionCacheEntry, ttlSeconds: number): Promise<void> {
    try {
      await this.transport.write(key, JSON.stringify(entry), ttlSeconds);
    } catch (error) {
      this.logger?.warn?.('permission_cache_write_failed', { key, error });
    }
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.transport.delete(key);
      this.metrics.recordInvalidation();
    } catch (error) {
      this.logger?.warn?.('permission_cache_delete_failed', { key, error });
    } finally {
      this.releaseKey(key);
    }
  }

  private async tryPatternEviction(pattern: string): Promise<number | null> {
    if (typeof this.transport.deleteMatching !== 'function') {
      return null;
    }
    try {
      const removed = await this.transport.deleteMatching(pattern);
      if (removed > 0) {
        for (const [key, record] of this.keyLookup.entries()) {
          if (this.patternMatchesKey(pattern, key)) {
            this.releaseKey(key, record);
          }
        }
        this.metrics.recordInvalidation();
      }
      return removed;
    } catch (error) {
      this.logger?.warn?.('permission_cache_pattern_delete_failed', { pattern, error });
      return null;
    }
  }

  private patternMatchesKey(pattern: string, key: string): boolean {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
    const expression = new RegExp(`^${escaped}$`);
    return expression.test(key);
  }

  private async safeLoad(
    loader: () => Promise<readonly PermissionDocument[] | null>,
    userId: string,
    organizationId: string
  ): Promise<readonly PermissionDocument[] | null> {
    try {
      return await loader();
    } catch (error) {
      this.logger?.warn?.('permission_cache_loader_failed', { userId, organizationId, error });
      return null;
    }
  }

  private trackKey(key: string, userId: string, organizationId: string): void {
    this.keyLookup.set(key, { userId, organizationId });
    if (!this.keysByUser.has(userId)) {
      this.keysByUser.set(userId, new Set());
    }
    if (!this.keysByOrg.has(organizationId)) {
      this.keysByOrg.set(organizationId, new Set());
    }
    this.keysByUser.get(userId)!.add(key);
    this.keysByOrg.get(organizationId)!.add(key);
    this.trimTrackedKeys();
  }

  private releaseKey(key: string, record?: PermissionCacheKeyRecord): void {
    const metadata = record ?? this.keyLookup.get(key);
    if (!metadata) {
      return;
    }
    this.keyLookup.delete(key);
    this.keysByUser.get(metadata.userId)?.delete(key);
    this.keysByOrg.get(metadata.organizationId)?.delete(key);
  }

  private trimTrackedKeys(): void {
    if (this.keyLookup.size <= KEY_TRACKER_LIMIT) {
      return;
    }
    const excess = this.keyLookup.size - KEY_TRACKER_LIMIT;
    const keys = [...this.keyLookup.keys()].slice(0, excess);
    for (const key of keys) {
      this.releaseKey(key);
    }
  }

  private assertIdentifier(field: string, value: string): void {
    if (!value || typeof value !== 'string') {
      throw new PermissionCacheError(`${field} is required`);
    }
  }
}
