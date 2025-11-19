import { performance } from 'node:perf_hooks';

import { PreferenceDocumentSchema, type PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import TimeService from '@/services/time/index.js';

import type {
  PreferenceDocumentLocator,
  PreferenceDocumentRecord,
  PreferenceDocumentRepository,
} from '../query/optimized-queries.js';

export interface PreferenceCacheKey extends PreferenceDocumentLocator {}

export interface PreferenceCacheBehavior {
  readonly forceRefresh?: boolean;
  readonly skipCache?: boolean;
}

export interface PreferenceCacheOptions {
  readonly ttlSeconds?: number;
  readonly prefix?: string;
  readonly metrics?: PreferenceCacheMetrics;
  readonly logger?: PreferenceCacheLogger;
}

export interface PreferenceCacheLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface PreferenceCacheTransport {
  read(key: string): Promise<string | null>;
  write(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PreferenceCacheResult {
  readonly document: PreferenceDocument | null;
  readonly source: 'cache' | 'database' | 'miss';
  readonly preferenceMutations: number;
  readonly cacheKey: string;
  readonly cachedAt?: string;
}

interface PreferenceCacheEntry {
  readonly document: PreferenceDocument;
  readonly preferenceMutations: number;
  readonly cachedAt: string;
  readonly version: string;
}

const DEFAULT_TTL_SECONDS = 3600; // 1 hour as mandated by R21.5
const MAX_LATENCY_OBSERVATIONS = 512;

export class PreferenceCacheError extends Error {}

export class PreferenceCacheMetrics {
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

  snapshot(): PreferenceCacheMetricsSnapshot {
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
    };
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

export interface PreferenceCacheMetricsSnapshot {
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
  readonly writes: number;
  readonly invalidations: number;
  readonly warmOperations: number;
  readonly p95: number;
  readonly p99: number;
}

export class PreferenceCache {
  private readonly ttlSeconds: number;
  private readonly prefix: string;
  private readonly metrics: PreferenceCacheMetrics;
  private readonly logger?: PreferenceCacheLogger;

  constructor(
    private readonly repository: PreferenceDocumentRepository,
    private readonly transport: PreferenceCacheTransport,
    options: PreferenceCacheOptions = {}
  ) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.prefix = options.prefix ?? 'preferences';
    this.metrics = options.metrics ?? new PreferenceCacheMetrics();
    this.logger = options.logger;
  }

  getMetrics(): PreferenceCacheMetricsSnapshot {
    return this.metrics.snapshot();
  }

  async getDocument(
    locator: PreferenceCacheKey,
    behavior: PreferenceCacheBehavior = {}
  ): Promise<PreferenceCacheResult> {
    if (!locator.userId) {
      throw new PreferenceCacheError('userId is required to fetch preferences.');
    }
    const cacheKey = this.buildCacheKey(locator);
    const startedAt = performance.now();
    const skipRead = behavior.skipCache || behavior.forceRefresh;

    if (!skipRead) {
      const cached = await this.safeRead(cacheKey);
      if (cached) {
        const duration = performance.now() - startedAt;
        this.metrics.recordHit(duration);
        return {
          document: cached.document,
          preferenceMutations: cached.preferenceMutations,
          cacheKey,
          source: 'cache',
          cachedAt: cached.cachedAt,
        } satisfies PreferenceCacheResult;
      }
    }

    const record = await this.repository.fetchDocument(locator);
    const duration = performance.now() - startedAt;
    if (!record) {
      this.metrics.recordMiss(duration);
      return {
        document: null,
        preferenceMutations: 0,
        cacheKey,
        source: 'miss',
      } satisfies PreferenceCacheResult;
    }

    if (!behavior.skipCache) {
      await this.safeWrite(cacheKey, record, this.ttlSeconds);
    }

    this.metrics.recordMiss(duration);
    return {
      document: record.document,
      preferenceMutations: record.preferenceMutations,
      cacheKey,
      cachedAt: record.updatedAt,
      source: 'database',
    } satisfies PreferenceCacheResult;
  }

  async primeDocument(locator: PreferenceCacheKey, document: PreferenceDocumentRecord, ttlSeconds?: number): Promise<void> {
    const cacheKey = this.buildCacheKey(locator);
    await this.safeWrite(cacheKey, document, ttlSeconds ?? this.ttlSeconds);
    this.metrics.recordWarmOperation();
  }

  async invalidate(locator: PreferenceCacheKey): Promise<void> {
    const cacheKey = this.buildCacheKey(locator);
    await this.transport.delete(cacheKey);
    this.metrics.recordInvalidation();
  }

  private buildCacheKey(locator: PreferenceCacheKey): string {
    const tenant = locator.tenantId ? `tenant:${locator.tenantId}` : 'tenant:global';
    return `${this.prefix}:${tenant}:user:${locator.userId}`;
  }

  private async safeRead(cacheKey: string): Promise<PreferenceCacheEntry | null> {
    try {
      const payload = await this.transport.read(cacheKey);
      if (!payload) {
        return null;
      }
      const parsed = this.deserialize(payload);
      return parsed;
    } catch (error) {
      this.logger?.warn?.('preference-cache-read-failed', { cacheKey, error });
      return null;
    }
  }

  private async safeWrite(cacheKey: string, record: PreferenceDocumentRecord, ttlSeconds: number): Promise<void> {
    const entry: PreferenceCacheEntry = {
      document: PreferenceDocumentSchema.parse(record.document),
      preferenceMutations: record.preferenceMutations,
      cachedAt: TimeService.toIsoString(TimeService.nowSystem(), { preserveZone: false }),
      version: record.document.version,
    } satisfies PreferenceCacheEntry;

    try {
      await this.transport.write(cacheKey, JSON.stringify(entry), ttlSeconds);
      this.metrics.recordWrite();
    } catch (error) {
      this.logger?.warn?.('preference-cache-write-failed', { cacheKey, error });
    }
  }

  private deserialize(payload: string): PreferenceCacheEntry {
    let parsed: PreferenceCacheEntry;
    try {
      parsed = JSON.parse(payload) as PreferenceCacheEntry;
    } catch (error) {
      throw new PreferenceCacheError('Failed to parse cache payload');
    }
    if (!parsed.document || typeof parsed.preferenceMutations !== 'number') {
      throw new PreferenceCacheError('Cache payload missing preference document metadata');
    }
    return {
      ...parsed,
      document: PreferenceDocumentSchema.parse(parsed.document),
    } satisfies PreferenceCacheEntry;
  }
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

export class InMemoryPreferenceCacheTransport implements PreferenceCacheTransport {
  private readonly entries = new Map<string, MemoryEntry>();

  private now(): number {
    return TimeService.nowSystem().toMillis();
  }

  async read(key: string): Promise<string | null> {
    this.purgeExpired(key);
    const entry = this.entries.get(key);
    return entry ? entry.value : null;
  }

  async write(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = this.now() + Math.max(ttlSeconds, 1) * 1000;
    this.entries.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  private purgeExpired(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
    }
  }
}
