# Preference Query Optimization Guide

> Companion to Mission B27.6. Documents the canonical SQL emitted by `PreferenceQueryService` so every service stays compatible with the jsonb_path_ops GIN index.

## Principles

1. **Containment-only queries** – Use `data @> $payload::jsonb` for feature flags, notification routing, and preference diffs. The `jsonb_path_ops` index only accelerates containment and jsonpath operators.
2. **Known paths** – Build payloads with deterministic paths (e.g., `notifications.project_comment.email`). Ad-hoc key lookups prevent index reuse.
3. **No projection operators** – Avoid `->`, `->>`, `json_extract_path_text`, etc. They force sequential scans because PostgreSQL cannot leverage the path_ops hash when values are accessed piecemeal.
4. **Parameterised JSON** – Always pass payloads as bind params and cast to `::jsonb`. This prevents SQL injection and keeps query plans reusable.

## Helper API

`src/traits/preferenceable/query/optimized-queries.ts` exports a single service to generate these statements.

```ts
const service = new PreferenceQueryService(postgresClient);

await service.containsPreference({
  tenantId: 'tenant-123',
  userId: 'user-789',
  path: ['notifications', 'system_announcement', 'email'],
  expected: true,
});
```

Under the hood it executes:

```sql
SELECT 1
  FROM preferences.user_preferences
 WHERE tenant_id = $1
   AND user_id = $2
   AND data @> $3::jsonb
 LIMIT 1;
```

The payload for the above example becomes:

```json
{
  "notifications": {
    "system_announcement": {
      "email": true
    }
  }
}
```

### Fetching Full Documents

`fetchDocument({ tenantId, userId })` returns a fully validated `PreferenceDocument` plus the `preference_mutations` counter. When cache misses happen, this method is what populates Redis.

### Building Payloads Manually

Use `buildContainmentPayload()` when you need the JSON object without running the query:

```ts
const payload = buildContainmentPayload(['notifications', 'mentions', 'push'], true);
// => { notifications: { mentions: { push: true } } }
```

## Example Queries

| Use Case | SQL Snippet |
| --- | --- |
| Check if email channel is enabled | `SELECT 1 FROM ... WHERE data @> '{
