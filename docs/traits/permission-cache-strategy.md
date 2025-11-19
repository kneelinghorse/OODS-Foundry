# Permission Cache Strategy

Mission B28.5 introduces a dedicated permission cache so `EntitlementService`
lookups no longer hit Postgres for every `hasPermission` check. The cache mirrors
the Preferenceable pattern and layers Redis in front of the recursive role tree
resolver.

## Cache Key Structure

- Format: ``permissions:user:{userId}:org:{orgId}:permissions`` (prefix is
  configurable but defaults to `permissions`).
- Keys are deterministic, so callers can reconstruct cache entries for metrics,
invalidation, and warm-up operations.
- Values are serialized JSON documents that contain the sorted list of
  `PermissionDocument` objects plus a `cachedAt` timestamp so consumers can audit
  freshness.

## TTL & Invalidation Rules

- Default TTL: **300 seconds (5 minutes)** per mission requirements. Override via
  `PermissionCacheOptions.ttlSeconds` when short-lived sessions require lower
  values.
- User-level invalidation: call `PermissionCache.invalidateUser(userId)` after
  membership or role assignments change for a specific user. This flushes every
  `org` entry for that user by pattern (`permissions:user:{userId}:org:*`).
- Org-level invalidation: `PermissionCache.invalidateOrg(orgId)` clears all users
  within the organization. Trigger after bulk role migrations.
- Events that MUST trigger invalidation:
  1. Any call to `MembershipService.assignRole` or `removeRole`.
  2. Role hierarchy/SoD policy updates that mutate inherited permissions.
  3. Backfills or reconciliation jobs that rewrite memberships in bulk.
- Role changes emit invalidations before new permissions propagate, ensuring
  stale cache entries never exceed the 5-minute TTL window.

## Redis Adapter & Fallback

- Use `RedisPermissionCacheAdapter` with a pooled Redis client (ioredis or
  node-redis). The adapter prefers `SETEX` for single round-trip writes, and
  falls back to `SET key value EX ttl` when only `set` is available.
- Configure with:

  ```ts
  const redisClient = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2 });
  const transport = new RedisPermissionCacheAdapter(redisClient, {
    ttlArgument: 'EX',
    scanCount: 500,
    fallback: new InMemoryPermissionCacheTransport(), // optional safety net
    logger,
  });
  const cache = new PermissionCache(transport, { prefix: 'permissions' });
  ```

- **Graceful degradation**: When Redis is unavailable, adapter swallows command
  failures, logs warnings, and optionally mirrors writes into the fallback
  transport so permission checks still benefit from in-memory caching.
- Pattern invalidation uses `SCAN MATCH permissions:user:{userId}:org:*` in
  batches (`COUNT 500`) to avoid blocking Redis.

## Monitoring & Metrics

- Metrics snapshot: `PermissionCache.getMetrics()` exposes hits, misses,
  invalidations, warm operations, and `p95/p99` latency observations (rolling
  buffer of the last 512 lookups).
- Persist metrics by inserting into
  `authz.permission_cache_metrics` (provisioned by
  `database/migrations/20251119_009_permission_cache_metrics.sql`). Columns:
  - `ts`: timestamp of observation (defaults to `NOW()`)
  - `cache_key`: exact key impacted
  - `hit`: boolean flag (true for cache hit)
  - `latency_ms`: numeric latency for lookup
  - `source`: `cache`, `loader`, or `miss`
  - `notes`: JSON blob for contextual data (user/org IDs, service name, etc.)
- Recommended ingestion loop:
  1. Every 60 seconds, fetch `cache.getMetrics()` snapshot.
  2. Insert aggregated rows grouped by key prefix (per organization or cluster).
  3. Build Grafana dashboards tracking hit rate (target ≥80%), `p99 < 5ms`, and
     invalidation spikes.

## Warmers & Guardrails

- `PermissionCacheWarmer` batches warm-up operations from background jobs (e.g.,
  preloading the top 1,000 most active users per org).
- Warmers use `context: 'warm'` so metrics distinguish proactive warming from
  synchronous lookups.
- Always validate that cache hit rate stays ≥80% by running
  `tests/performance/permission-cache-benchmarks.test.ts` locally (`pnpm test
  tests/performance/permission-cache-benchmarks.test.ts`).

Following this strategy keeps recursive role graph evaluations under the <5ms p99
budget, provides observability via the metrics table, and ensures guardrails for
Redis outages through transport fallbacks.
