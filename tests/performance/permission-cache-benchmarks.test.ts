import { describe, expect, it } from 'vitest';

import type { PermissionCacheTransport } from '@/traits/authz/cache/permission-cache.ts';
import { PermissionCache } from '@/traits/authz/cache/permission-cache.ts';
import { EntitlementService } from '@/traits/authz/entitlement-service.ts';

import { createAuthzTestContext } from '../traits/authz/test-helpers.ts';

const ITERATIONS = 1000;
const COLD_ITERATIONS = 25;

describe('PermissionCache benchmarks', () => {
  it('maintains <5ms p99 and ≥80% hit rate once warm', async () => {
    const context = createAuthzTestContext();
    const transport = new InMemoryPermissionCacheTransport();
    const cache = new PermissionCache(transport, { ttlSeconds: 300 });
    const service = new EntitlementService(context.executor);

    const userId = context.users.alpha;
    const orgId = context.organizations.northwind;

    // Single warm-up pass ensures local cache contains snapshot before measurement.
    await cache.getPermissions(userId, orgId, {
      loader: () => service.getUserPermissions(userId, orgId),
      forceRefresh: true,
    });

    const { durations, hits } = await measureQueries(cache, service, userId, orgId, ITERATIONS);
    const stats = summarizeDurations(durations);

    expect(stats.p99).toBeLessThan(5);
    expect(stats.p50).toBeLessThan(1);
    expect(hits / ITERATIONS).toBeGreaterThanOrEqual(0.8);

    await context.dispose();
  });

  it('shows cold lookups remain slower than warmed cache accesses', async () => {
    const context = createAuthzTestContext();
    const transport = new InMemoryPermissionCacheTransport();
    const cache = new PermissionCache(transport, { ttlSeconds: 300 });
    const service = new EntitlementService(context.executor);
    const userId = context.users.beta;
    const orgId = context.organizations.globex;

    const coldDurations = await measureCold(cache, service, userId, orgId, COLD_ITERATIONS);
    await cache.getPermissions(userId, orgId, {
      loader: () => service.getUserPermissions(userId, orgId),
      forceRefresh: true,
    });
    const warmDurations = await measureWarm(cache, service, userId, orgId, COLD_ITERATIONS);

    expect(average(warmDurations)).toBeLessThan(average(coldDurations));

    await context.dispose();
  });
});

async function measureQueries(
  cache: PermissionCache,
  service: EntitlementService,
  userId: string,
  organizationId: string,
  iterations: number
): Promise<{ durations: number[]; hits: number }> {
  const durations: number[] = [];
  let hits = 0;
  for (let index = 0; index < iterations; index += 1) {
    const result = await cache.getPermissions(userId, organizationId, {
      loader: () => service.getUserPermissions(userId, organizationId),
    });
    durations.push(result.latencyMs);
    if (result.source === 'cache') {
      hits += 1;
    }
  }
  return { durations, hits };
}

async function measureCold(
  cache: PermissionCache,
  service: EntitlementService,
  userId: string,
  organizationId: string,
  iterations: number
): Promise<number[]> {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const result = await cache.getPermissions(userId, organizationId, {
      loader: () => service.getUserPermissions(userId, organizationId),
      forceRefresh: true,
    });
    durations.push(result.latencyMs);
  }
  return durations;
}

async function measureWarm(
  cache: PermissionCache,
  service: EntitlementService,
  userId: string,
  organizationId: string,
  iterations: number
): Promise<number[]> {
  const { durations } = await measureQueries(cache, service, userId, organizationId, iterations);
  return durations;
}

function summarizeDurations(samples: readonly number[]): { readonly p50: number; readonly p99: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(sorted: readonly number[], threshold: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * threshold));
  return Number(sorted[index]?.toFixed(3));
}

function average(samples: readonly number[]): number {
  if (samples.length === 0) {
    return 0;
  }
  const sum = samples.reduce((total, value) => total + value, 0);
  return Number((sum / samples.length).toFixed(3));
}

class InMemoryPermissionCacheTransport implements PermissionCacheTransport {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async read(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async write(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteMatching(pattern: string): Promise<number> {
    const regex = patternToRegex(pattern);
    let removed = 0;
    for (const key of [...this.store.keys()]) {
      if (regex.test(key)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
