import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InMemoryPreferenceCacheTransport,
  PreferenceCache,
} from '@/traits/preferenceable/cache/preference-cache.ts';
import {
  PreferenceCacheWarmer,
  StaticWarmSource,
} from '@/traits/preferenceable/cache/cache-warmer.ts';
import type {
  PreferenceDocumentLocator,
  PreferenceDocumentRecord,
  PreferenceDocumentRepository,
} from '@/traits/preferenceable/query/optimized-queries.ts';
import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';

const locator = { tenantId: 'tenant-a', userId: 'user-a' } as const;

class RecordingRepository implements PreferenceDocumentRepository {
  fetches = 0;

  constructor(private readonly record: PreferenceDocumentRecord | null) {}

  async fetchDocument(_locator: PreferenceDocumentLocator): Promise<PreferenceDocumentRecord | null> {
    this.fetches += 1;
    return this.record ? { ...this.record } : null;
  }
}

describe('PreferenceCache', () => {
  let repository: RecordingRepository;
  let cache: PreferenceCache;

  beforeEach(() => {
    repository = new RecordingRepository(buildRecord());
    cache = new PreferenceCache(repository, new InMemoryPreferenceCacheTransport(), {
      ttlSeconds: 60,
    });
  });

  it('caches documents and records hits/misses', async () => {
    const first = await cache.getDocument(locator);
    expect(first.source).toBe('database');
    expect(repository.fetches).toBe(1);

    const second = await cache.getDocument(locator);
    expect(second.source).toBe('cache');
    expect(repository.fetches).toBe(1);

    const metrics = cache.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hitRate).toBeGreaterThan(0.4);
  });

  it('invalidates cache entries when preferences change', async () => {
    await cache.getDocument(locator);
    await cache.invalidate(locator);
    await cache.getDocument(locator);
    expect(repository.fetches).toBe(2);
  });

  it('expires in-memory entries according to TTL', async () => {
    vi.useFakeTimers();
    const transport = new InMemoryPreferenceCacheTransport();
    await transport.write('key', JSON.stringify({}), 1);

    await vi.advanceTimersByTimeAsync(500);
    await expect(transport.read('key')).resolves.not.toBeNull();

    await vi.advanceTimersByTimeAsync(600);
    await expect(transport.read('key')).resolves.toBeNull();
    vi.useRealTimers();
  });
});

describe('PreferenceCacheWarmer', () => {
  it('warms high priority recipients and reports status', async () => {
    const repository = new RecordingRepository(buildRecord());
    const cache = new PreferenceCache(repository, new InMemoryPreferenceCacheTransport());
    const warmer = new PreferenceCacheWarmer(
      cache,
      new StaticWarmSource([
        { ...locator, score: 50 },
        { ...locator, userId: 'user-b', score: 0 },
      ])
    );

    const result = await warmer.warm({ minScore: 10 });
    expect(result.warmed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(repository.fetches).toBe(1);
  });
});

function buildRecord(): PreferenceDocumentRecord {
  return {
    document: buildDocument(),
    preferenceMutations: 7,
    updatedAt: '2025-11-19T00:00:00Z',
  } satisfies PreferenceDocumentRecord;
}

function buildDocument(): PreferenceDocument {
  return {
    version: '1.1.0',
    preferences: {
      theme: { mode: 'system' },
      notifications: {
        mention: { email: true, push: true },
      },
    },
    metadata: {
      schemaVersion: '1.1.0',
      lastUpdated: '2025-11-19T00:00:00Z',
      source: 'user',
      migrationApplied: [],
    },
  } satisfies PreferenceDocument;
}
