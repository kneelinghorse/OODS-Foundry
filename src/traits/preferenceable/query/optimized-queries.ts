import { PreferenceDocumentSchema, type PreferenceDocument, type PreferenceValue } from '@/schemas/preferences/preference-document.js';
import TimeService from '@/services/time/index.js';

export interface QueryResultRow {
  [column: string]: unknown;
}

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export interface PreferenceQueryClient {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
}

export interface PreferenceDocumentLocator {
  readonly userId: string;
  readonly tenantId?: string | null;
}

export interface PreferenceDocumentRecord {
  readonly document: PreferenceDocument;
  readonly preferenceMutations: number;
  readonly updatedAt: string;
}

export interface PreferenceDocumentRepository {
  fetchDocument(locator: PreferenceDocumentLocator): Promise<PreferenceDocumentRecord | null>;
}

export interface PreferenceQueryServiceOptions {
  readonly tableName?: string;
}

export interface PreferenceContainmentQueryOptions extends PreferenceDocumentLocator {
  readonly path: readonly string[];
  readonly expected: PreferenceValue;
}

export interface PreferenceDocumentRow extends QueryResultRow {
  tenant_id: string | null;
  user_id: string;
  data: PreferenceDocument;
  preference_mutations: number;
  version: string;
  updated_at: string | Date;
}

interface QueryPayload {
  sql: string;
  params: unknown[];
}

export class PreferenceQueryService implements PreferenceDocumentRepository {
  private readonly tableName: string;
  private readonly selectColumns = [
    'tenant_id',
    'user_id',
    'data',
    'preference_mutations',
    'version',
    'updated_at',
  ];

  constructor(
    private readonly client: PreferenceQueryClient,
    options: PreferenceQueryServiceOptions = {}
  ) {
    this.tableName = options.tableName ?? 'preferences.user_preferences';
  }

  async fetchDocument(locator: PreferenceDocumentLocator): Promise<PreferenceDocumentRecord | null> {
    const query = this.buildSelectQuery(locator);
    const result = await this.client.query<PreferenceDocumentRow>(query.sql, query.params);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.normalizeRow(row);
  }

  async containsPreference(options: PreferenceContainmentQueryOptions): Promise<boolean> {
    const query = this.buildContainmentQuery(options);
    const result = await this.client.query<QueryResultRow>(query.sql, query.params);
    return result.rowCount > 0;
  }

  buildContainmentQuery(options: PreferenceContainmentQueryOptions): QueryPayload {
    if (!options.path.length) {
      throw new Error('path is required for containment queries');
    }
    const params: unknown[] = [];
    const conditions = this.buildLocatorConditions(options, params);
    const payloadObject = buildContainmentPayload(options.path, options.expected);
    const payloadParam = this.pushParam(params, JSON.stringify(payloadObject));
    const sql = `SELECT 1 FROM ${this.tableName} WHERE ${conditions.join(' AND ')} AND data @> ${payloadParam}::jsonb LIMIT 1`;
    return { sql, params };
  }

  private buildSelectQuery(locator: PreferenceDocumentLocator): QueryPayload {
    if (!locator.userId) {
      throw new Error('userId is required to query preferences');
    }
    const params: unknown[] = [];
    const conditions = this.buildLocatorConditions(locator, params);
    const sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
    return { sql, params };
  }

  private buildLocatorConditions(locator: PreferenceDocumentLocator, params: unknown[]): string[] {
    const conditions: string[] = [];
    const userParam = this.pushParam(params, locator.userId);
    conditions.push(`user_id = ${userParam}`);
    if (locator.tenantId) {
      const tenantParam = this.pushParam(params, locator.tenantId);
      conditions.push(`tenant_id = ${tenantParam}`);
    }
    return conditions;
  }

  private normalizeRow(row: PreferenceDocumentRow): PreferenceDocumentRecord {
    const document = PreferenceDocumentSchema.parse(row.data);
    const updatedAt = TimeService.toIsoString(TimeService.fromDatabase(row.updated_at));
    return {
      document,
      preferenceMutations: Number(row.preference_mutations ?? 0),
      updatedAt,
    } satisfies PreferenceDocumentRecord;
  }

  private pushParam(params: unknown[], value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }
}

export function buildContainmentPayload(path: readonly string[], expected: PreferenceValue): Record<string, unknown> {
  if (path.length === 0) {
    throw new Error('Preference containment path must include at least one segment');
  }
  let payload: unknown = expected;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index]!;
    payload = { [segment]: payload };
  }
  return payload as Record<string, unknown>;
}
