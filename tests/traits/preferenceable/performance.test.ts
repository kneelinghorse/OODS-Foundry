import { describe, expect, it } from 'vitest';

import type {
  PreferenceDocumentLocator,
  PreferenceDocumentRow,
  PreferenceQueryClient,
  QueryResult,
  QueryResultRow,
} from '@/traits/preferenceable/query/optimized-queries.ts';
import { PreferenceQueryService, buildContainmentPayload } from '@/traits/preferenceable/query/optimized-queries.ts';
import { TrendingNotificationWarmSource } from '@/traits/preferenceable/cache/cache-warmer.ts';

class MockQueryClient implements PreferenceQueryClient {
  public readonly queries: { sql: string; params: readonly unknown[] }[] = [];
  constructor(private readonly payload: QueryResultRow[] = []) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<T>> {
    this.queries.push({ sql, params });
    return {
      rows: this.payload as T[],
      rowCount: this.payload.length,
    } satisfies QueryResult<T>;
  }
}

describe('PreferenceQueryService', () => {
  it('normalizes preference rows from the database', async () => {
    const row: PreferenceDocumentRow = {
      tenant_id: 'tenant-a',
      user_id: 'user-a',
      data: {
        version: '1.1.0',
        preferences: { notifications: { project_comment: { email: true } } },
        metadata: {
          schemaVersion: '1.1.0',
          lastUpdated: '2025-11-19T00:00:00Z',
          source: 'system',
          migrationApplied: [],
        },
      },
      preference_mutations: 11,
      version: '1.1.0',
      updated_at: '2025-11-19T00:00:00Z',
    } satisfies PreferenceDocumentRow;

    const client = new MockQueryClient([row]);
    const service = new PreferenceQueryService(client);
    const record = await service.fetchDocument({ tenantId: 'tenant-a', userId: 'user-a' });

    expect(record?.document.preferences.notifications?.project_comment?.email).toBe(true);
    expect(record?.preferenceMutations).toBe(11);
    expect(client.queries[0]?.sql).toContain('data');
  });

  it('builds containment queries using @> operator so GIN index is utilized', () => {
    const service = new PreferenceQueryService(new MockQueryClient());
    const query = service.buildContainmentQuery({
      tenantId: 'tenant-a',
      userId: 'user-a',
      path: ['notifications', 'project_comment', 'email'],
      expected: true,
    });

    expect(query.sql).toContain('data @>');
    expect(query.sql).not.toContain('->>');
    const payload = JSON.parse(query.params.at(-1) as string);
    expect(payload.notifications.project_comment.email).toBe(true);
  });
});

describe('TrendingNotificationWarmSource', () => {
  it('fetches candidates ordered by cache pressure score', async () => {
    const rows = [
      {
        tenant_id: 'tenant-a',
        user_id: 'user-a',
        read_volume_1h: 1000,
        cache_pressure_score: 42,
      },
    ];
    const client = new MockQueryClient(rows);
    const source = new TrendingNotificationWarmSource(client, 'preferences.notification_activity_hourly');
    const result = await source.loadCandidates(5);

    expect(client.queries[0]?.sql).toContain('ORDER BY cache_pressure_score DESC');
    expect(client.queries[0]?.params[0]).toBe(5);
    expect(result[0]?.score).toBe(42);
  });
});

describe('buildContainmentPayload', () => {
  it('nests expected values across arbitrary paths', () => {
    const payload = buildContainmentPayload(['notifications', 'digest', 'email'], false);
    expect(payload).toEqual({ notifications: { digest: { email: false } } });
  });
});
