import type { QueryResult, QueryResultRow } from 'pg';

import TimeService from '@/services/time/index.js';

/**
 * Minimal query executor contract so runtime services can operate with any
 * pg-compatible client (Pool, PoolClient, or transactional client wrappers).
 *
 * The executor intentionally mirrors {@link QueryResult} to keep the
 * implementation lightweight and focused on prepared statements.
 */
export interface SqlExecutor {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}

export interface RuntimeLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export function cloneParams(params?: readonly unknown[]): unknown[] | undefined {
  if (!params || params.length === 0) {
    return undefined;
  }
  return [...params];
}

export function nowIso(): string {
  return TimeService.toIsoString(TimeService.nowSystem());
}
