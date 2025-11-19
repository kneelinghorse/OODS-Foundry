# Preference Performance Playbook

> Mission B27.6 consolidates the cache + index blueprint from research mission R21.5 and codifies it into production-ready helpers. This document explains the two-layer runtime architecture plus the operational guardrails that keep preference reads under the <10ms p95 target.

## Architecture Overview

```
Preference Fan-Out ➝ PreferenceCache (Redis) ➝ PostgreSQL (GIN @> containment)
                             │                         │
                             ├─ metrics ➝ preferences.preference_cache_metrics
                             └─ warming ➝ TrendingNotificationWarmSource
```

- **Layer 1 – Cache Aside (Redis)**
  - Primary read path using `PreferenceCache` + `RedisCacheAdapter`.
  - TTL = **3600 seconds** (1 hour). Mirrors research guidance to balance freshness vs. hit rate.
  - Cache keys follow `preferences:tenant:<tenant>|global:user:<user>`.
  - Cache entry contains the full `PreferenceDocument`, `preference_mutations`, and `cachedAt` ISO timestamp.
  - `PreferenceCache.invalidate()` must run whenever `preference_mutations` increments (writes + deletes).

- **Layer 2 – PostgreSQL GIN**
  - `database/migrations/20251119_preference_gin_index.sql` installs `jsonb_path_ops` index plus a telemetry table for cache diagnostics.
  - All notification filters **must** use `data @> '<payload>'::jsonb`. Operators `->` or `->>` will bypass the index and fail latency budgets.
  - The SQL helper in `src/traits/preferenceable/query/optimized-queries.ts` enforces this operator so services do not regress.

## Layer 1: Redis Cache Aside

`src/traits/preferenceable/cache/preference-cache.ts` implements the reusable cache facade.

```ts
const cache = new PreferenceCache(
  new PreferenceQueryService(postgresClient),
  new RedisCacheAdapter(redisClient),
  {
    ttlSeconds: 3600,
    prefix: 'preferences',
  }
);

const result = await cache.getDocument({ tenantId: tenant.id, userId });
if (!result.document) throw new Error('preferences not found');
```

Key behaviors:

- **TTL Enforcement** – Defaults to 3600s, configurable per instance.
- **Metrics** – `cache.getMetrics()` returns hit/miss counts plus p95/p99 latency. Values persist in-memory and can be exported to `preferences.preference_cache_metrics` for dashboards.
- **Cache Busting** – Writers should increment the `preference_mutations` counter and call `cache.invalidate()` (preferably in the same transaction as the write) to keep the next read consistent.
- **Prime/Warm** – `cache.primeDocument()` accepts an explicit record (used by warmers or background rebuilds).

### Redis Adapter

`src/traits/preferenceable/cache/redis-adapter.ts` wraps any Redis client that exposes `get`, `setEx` **or** `set`. Usage example with `@redis/client`:

```ts
import { createClient } from 'redis';
import { RedisCacheAdapter } from '@/traits/preferenceable/cache/redis-adapter.js';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

const transport = new RedisCacheAdapter(redisClient);
```

The adapter attempts `SETEX` first, then falls back to `SET key value EX ttl` to support ioredis-style clients.

### Cache Warmer

`src/traits/preferenceable/cache/cache-warmer.ts` exposes a deterministic warmer used by fan-out services before batched sends:

```ts
const warmer = new PreferenceCacheWarmer(
  cache,
  new TrendingNotificationWarmSource(postgresClient)
);
await warmer.warm({ limit: 200, minScore: 10 });
```

- `TrendingNotificationWarmSource` pulls candidates from `preferences.notification_activity_hourly` (view populated by notification telemetry).
- Scores combine read volume + miss spikes. Candidates under `minScore` are skipped.
- The static source makes it easy to inject scripted recipients (e.g., enterprise admins before a maintenance blast).

## Layer 2: PostgreSQL GIN (jsonb_path_ops)

`20251119_preference_gin_index.sql` installs the tuned index:

```sql
CREATE INDEX user_preferences_data_path_ops_idx
  ON preferences.user_preferences
  USING GIN (data jsonb_path_ops);
```

It also provisions `preferences.preference_cache_metrics` to capture cache hit rate, latency, and callers. Populate it by streaming `PreferenceCache.getMetrics()` results during ingestion windows.

### Query Helper

`src/traits/preferenceable/query/optimized-queries.ts` centralizes SQL so every service uses the same containment operator:

```ts
const queries = new PreferenceQueryService(postgresClient);
const document = await queries.fetchDocument({ tenantId, userId });

const containsEmail = await queries.containsPreference({
  tenantId,
  userId,
  path: ['notifications', 'project_comment', 'email'],
  expected: true,
});
```

- `buildContainmentPayload` transforms `['notifications','digest','email']` into `{"notifications":{"digest":{"email":true}}}`.
- `containsPreference()` always emits `data @> $payload::jsonb`, guaranteeing the GIN index is used.

## Monitoring & Benchmarks

### Cache Telemetry

- Pull `PreferenceCache.getMetrics()` snapshot every 60 seconds and insert it into `preferences.preference_cache_metrics`.
- Alert when `hitRate < 0.90`, `p95 > 5ms`, or `invalidations == 0` for >15 minutes (indicates stuck writers).

### Synthetic Benchmark Script

`scripts/perf/benchmark-preferences.ts` simulates cache hits/misses and writes the results to `diagnostics/preference-cache-benchmarks.json`.

```bash
pnpm tsx scripts/perf/benchmark-preferences.ts
```

Outputs include:

```json
{
  "targets": { "cacheHitMs95": "<=5", "cacheMissMs95": "<=10" },
  "results": {
    "hit": { "p95": 1.2 },
    "miss": { "p95": 8.0 },
    "cache": { "hitRate": 0.83 }
  }
}
```

Use this script in CI to guard against regressions when cache logic changes.

## Operational Checklist

1. **Writes**: Increment `preference_mutations`, persist `PreferenceDocument`, call `PreferenceCache.invalidate()`.
2. **Reads**: Always go through `PreferenceCache.getDocument()`.
3. **Fan-Out Start**: Run `PreferenceCacheWarmer` for hot recipients.
4. **DB Safety**: Avoid `->` or `->>` in SQL; stick to `@>` so the jsonb_path_ops index is used.
5. **Monitoring**: Pipe metrics to `preferences.preference_cache_metrics` and Grafana dashboards.

Following this checklist keeps notification fan-out reads under the <10ms p95 budget while providing observability for cache pressure.
